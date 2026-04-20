"""Gradio UI cho ClawFlow — giữ phiên qua reload (BrowserState) và liệt kê phiên cũ
đã có checkpoint trong MongoDB.

Kiến trúc đơn giản để mai mốt lắp Backend thật:
- `thread_id` luôn có prefix `f"{USER_ID}__"` → query distinct theo prefix là ra
  đủ danh sách phiên của 1 user. Khi có backend auth, chỉ cần thay USER_ID hard-code
  bằng user_id thật từ session token, không cần sửa gì thêm.
"""
from __future__ import annotations

import os
import uuid

import certifi
import gradio as gr
import httpx
from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage
from pymongo import MongoClient

from graph import db_saver

load_dotenv()

API_URL = "http://127.0.0.1:8000/api/v1/chat"
USER_ID = "test_giamdoc_123"

# =========================================================================
# MONGO — chỉ dùng để LIST phiên. Persistence vẫn do MongoDBSaver lo.
# =========================================================================
_mongo = MongoClient(
    os.getenv("MONGO_URI"),
    tlsCAFile=certifi.where(),
    retryWrites=True,
    retryReads=True,
    serverSelectionTimeoutMS=8000,
)
_ckpt_coll = _mongo["clawflaw_ai_brain"]["checkpoints"]


def _new_session_id() -> str:
    return f"{USER_ID}__{uuid.uuid4().hex[:8]}"


def _list_sessions() -> list[str]:
    """Lấy các thread_id đã có checkpoint cho USER_ID, mới nhất lên đầu."""
    ids = _ckpt_coll.distinct(
        "thread_id", {"thread_id": {"$regex": f"^{USER_ID}__"}}
    )
    return sorted(ids, reverse=True)


def _load_history(session_id: str) -> list[tuple[str, str]]:
    """Đọc messages từ checkpoint mới nhất → convert thành list[(user, ai)]
    cho gr.ChatInterface (type tuples mặc định)."""
    if not session_id:
        return []
    cfg = {"configurable": {"thread_id": session_id}}
    try:
        tup = db_saver.get_tuple(cfg)
    except Exception as e:
        print(f"[ui] load_history error: {e}")
        return []
    if not tup or not tup.checkpoint:
        return []
    msgs = tup.checkpoint.get("channel_values", {}).get("messages", []) or []

    pairs: list[tuple[str, str]] = []
    pending_human: str | None = None
    for m in msgs:
        if isinstance(m, HumanMessage):
            pending_human = str(m.content or "")
        elif isinstance(m, AIMessage):
            if getattr(m, "tool_calls", None):
                continue
            if pending_human is None:
                continue
            ai_text = str(m.content or "").strip()
            if ai_text:
                pairs.append((pending_human, ai_text))
            pending_human = None
    return pairs


# =========================================================================
# HTTP — gọi API chat
# =========================================================================
async def chat_with_clawflow(message, history, session_id):
    payload = {
        "user_id": USER_ID,
        "session_id": session_id,
        "message": message,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        try:
            response = await client.post(API_URL, json=payload)
            data = response.json()
            return data.get("reply", "Lỗi: Không có dữ liệu trả về.")
        except Exception as e:
            return f"Lỗi không kết nối được với Server: {e}"


# =========================================================================
# EVENTS
# =========================================================================
def init_session(browser_val):
    """Load trang: đọc session_id từ localStorage. Nếu trống → tạo mới.
    Đồng thời nạp lại lịch sử chat của phiên đó từ MongoDB checkpoint.
    """
    sid = browser_val or _new_session_id()
    choices = _list_sessions()
    if sid not in choices:
        choices.insert(0, sid)
    history = _load_history(sid)
    return (
        sid,
        sid,
        gr.update(choices=choices, value=sid),
        history,
        f"**Phiên hiện tại:** `{sid}`",
    )


def on_reset():
    """Nút 'Phiên mới': tạo UUID mới, clear chatbox."""
    sid = _new_session_id()
    choices = _list_sessions()
    if sid not in choices:
        choices.insert(0, sid)
    return (
        sid,
        sid,
        gr.update(choices=choices, value=sid),
        [],
        f"**Phiên hiện tại:** `{sid}`",
    )


def on_pick(sid):
    """Chọn phiên cũ → load session_id vào state + đọc lịch sử chat từ checkpoint."""
    if not sid:
        return gr.update(), gr.update(), [], gr.update()
    history = _load_history(sid)
    return sid, sid, history, f"**Phiên hiện tại:** `{sid}`"


def on_refresh():
    """Nút refresh danh sách phiên."""
    return gr.update(choices=_list_sessions())


# =========================================================================
# UI
# =========================================================================
with gr.Blocks(title="ClawFlow AI - Multi-Agent System") as demo:
    gr.Markdown("# ClawFlow AI – Multi-Agent System")
    gr.Markdown(
        "Thủ lĩnh AI và Content Agent phối hợp. Phiên được lưu trong trình duyệt "
        "(localStorage) nên reload trang vẫn giữ lịch sử."
    )

    browser_state = gr.BrowserState(default_value=None, storage_key="claw_session_id")
    session_state = gr.State()
    session_label = gr.Markdown("**Phiên hiện tại:** _(đang tải...)_")

    with gr.Row():
        session_dd = gr.Dropdown(
            label="Phiên cũ (từ MongoDB checkpoint)",
            choices=[],
            interactive=True,
            scale=5,
        )
        refresh_btn = gr.Button("🔄 Tải lại", scale=1)
        reset_btn = gr.Button("➕ Phiên mới", variant="primary", scale=1)

    chat = gr.ChatInterface(
        fn=chat_with_clawflow,
        additional_inputs=[session_state],
    )

    demo.load(
        init_session,
        inputs=[browser_state],
        outputs=[browser_state, session_state, session_dd, chat.chatbot, session_label],
    )
    reset_btn.click(
        on_reset,
        outputs=[browser_state, session_state, session_dd, chat.chatbot, session_label],
    )
    session_dd.change(
        on_pick,
        inputs=[session_dd],
        outputs=[browser_state, session_state, chat.chatbot, session_label],
    )
    refresh_btn.click(on_refresh, outputs=[session_dd])


if __name__ == "__main__":
    demo.launch()
