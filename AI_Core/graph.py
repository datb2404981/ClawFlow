"""ClawFlow Graph - lắp ráp tất cả node và router thành luồng chạy."""
from __future__ import annotations

import json
import re
import time
import traceback
from langchain_core.messages import AIMessageChunk, HumanMessage, AIMessage
from langgraph.graph import END, START, StateGraph

from Nodes.content import content_agent_node
from Nodes.leader import leader_agent_node
from Nodes.integration import integration_agent_node
from Nodes.memory import memory_bootstrap_node, memory_writer_node
from Nodes.tools import tools_node
from Nodes.reviewer import reviewer_node
from Routers.router import (
    after_writer_router,
    content_router,
    entry_router,
    leader_router,
    integration_router,
    tools_router,
    review_router,
)
from mongo_client import client, db_saver  # noqa: F401 (re-export cho ui)
from state import MEMORY_TOOL_NAMES, ClawFlowState
from Utils.messages import sanitize_assistant_text
from Utils.text_sanitize import sanitize_assistant_text_keep_thought

_DEBUG_LOG_PATH = "/Users/macos/Document/Project/ClawFlow/.cursor/debug-de0ba6.log"
_DEBUG_SESSION_ID = "de0ba6"


def _debug_log(run_id: str, hypothesis_id: str, location: str, message: str, data: dict) -> None:
    try:
        payload = {
            "sessionId": _DEBUG_SESSION_ID,
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass

def _unpack_messages_stream_item(
    item: object,
) -> tuple[AIMessageChunk | AIMessage | None, dict]:
    """LangGraph v2: {type: messages, data: (chunk, meta)}; v1: (chunk, meta) hoặc ("messages", (...))."""
    if isinstance(item, dict) and item.get("type") == "messages":
        data = item.get("data")
        if isinstance(data, tuple) and data:
            head = data[0]
            meta = data[1] if len(data) > 1 and isinstance(data[1], dict) else {}
            if isinstance(head, (AIMessageChunk, AIMessage)):
                return head, meta
        return None, {}
    if isinstance(item, tuple) and item:
        if (
            len(item) == 2
            and item[0] == "messages"
            and isinstance(item[1], tuple)
        ):
            inner = item[1]
            if inner and isinstance(inner[0], (AIMessageChunk, AIMessage)):
                meta = (
                    inner[1]
                    if len(inner) > 1 and isinstance(inner[1], dict)
                    else {}
                )
                return inner[0], meta
        head = item[0]
        if isinstance(head, (AIMessageChunk, AIMessage)):
            meta = item[1] if len(item) > 1 and isinstance(item[1], dict) else {}
            return head, meta
    return None, {}


async def _astream_messages_tokens(compiled, payload, config):
    try:
        async for it in compiled.astream(
            payload,
            config=config,
            stream_mode="messages",
            version="v2",
        ):
            yield it
    except TypeError:
        async for it in compiled.astream(
            payload,
            config=config,
            stream_mode="messages",
        ):
            yield it


# =========================================================================
# BUILD GRAPH
# =========================================================================
graph = StateGraph(ClawFlowState)

graph.add_node("memory_bootstrap", memory_bootstrap_node)
graph.add_node("memory_writer", memory_writer_node)
graph.add_node("leader_agent", leader_agent_node)
graph.add_node("integration_agent", integration_agent_node)
graph.add_node("content_agent", content_agent_node)
graph.add_node("tools", tools_node)
graph.add_node("reviewer", reviewer_node)

graph.add_conditional_edges(
    START,
    entry_router,
    {
        "memory_writer": "memory_writer",
        "memory_bootstrap": "memory_bootstrap",
        "leader_agent": "leader_agent",
    },
)

graph.add_edge("memory_bootstrap", "leader_agent")

graph.add_conditional_edges(
    "memory_writer",
    after_writer_router,
    {
        "memory_bootstrap": "memory_bootstrap",
        "leader_agent": "leader_agent",
    },
)

graph.add_conditional_edges(
    "leader_agent",
    leader_router,
    {
        "tools": "tools",
        "content_agent": "content_agent",
        "reviewer": "reviewer",
        END: END,
    },
)

graph.add_conditional_edges(
    "content_agent",
    content_router,
    {
        "tools": "tools",
        "reviewer": "reviewer",
    },
)

graph.add_conditional_edges(
    "integration_agent",
    integration_router,
    {
        "tools": "tools",
        "leader_agent": "leader_agent",
    },
)

graph.add_conditional_edges(
    "tools",
    tools_router,
    {
        "leader_agent": "leader_agent",
        "integration_agent": "integration_agent",
        "content_agent": "content_agent",
        "reviewer": "reviewer",
    },
)

graph.add_conditional_edges(
    "reviewer",
    review_router,
    {
        "leader_agent": "leader_agent",
        END: END,
    },
)


# =========================================================================
# COMPILE
# =========================================================================
# `app`     : cho LangGraph Studio (Studio tự gắn checkpointer của nó)
# `app_api` : cho API backend thật — PHẢI dùng bản này để có MongoDB persistence
app = graph.compile()
app_api = graph.compile(checkpointer=db_saver)


# =========================================================================
# ENTRY POINT CHO API
# =========================================================================
async def run_graph(
    query: str, 
    user_id: str, 
    thread_id: str = "1", 
    integrations: dict = None,
    task_status: str = "running",
    draft_payload: str = "",
    system_context: str = None
) -> str:
    """Chạy 1 turn. thread_id = session_id do frontend truyền lên."""
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
            "integrations": integrations or {},
            "task_status": task_status,
            "draft_payload": draft_payload,
        }
    }
    payload = {
        "messages": [HumanMessage(content=query)],
        # Reset bộ đếm mỗi turn mới — tránh giá trị cũ từ checkpoint làm sai router.
        "tool_call_count": 0,
        "review_count": 0,
        "has_bypassed_integration": False,
        "gmail_permission_granted": (integrations or {}).get("gmail_action_granted", False),
        "integrations": integrations or {},
        "task_status": task_status,
        "draft_payload": draft_payload,
        "system_context": system_context,
    }
    result = await app_api.ainvoke(payload, config=config)
    last_msg = result["messages"][-1]
    raw = last_msg.content
    
    # Bổ sung: Lấy reasoning từ metadata nếu model hỗ trợ (Gemini/DeepSeek native)
    reasoning = last_msg.additional_kwargs.get("reasoning_content") or last_msg.additional_kwargs.get("thought")
    if reasoning and isinstance(reasoning, str) and isinstance(raw, str):
        if "<thought" not in raw.lower() and "<thought" not in reasoning.lower():
            raw = f"<thought>\n{reasoning}\n</thought>\n\n{raw}"

    if isinstance(raw, str):
        return sanitize_assistant_text(raw)
    return raw


async def run_graph_stream(
    query: str,
    user_id: str,
    thread_id: str = "1",
    integrations: dict = None,
    task_status: str = "running",
    draft_payload: str = "",
    system_context: str = None
):
    """Stream từng đoạn nội dung assistant (token/chunk) cho SSE."""
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
            "integrations": integrations or {},
            "task_status": task_status,
            "draft_payload": draft_payload,
        }
    }
    payload = {
        "messages": [HumanMessage(content=query)],
        # Reset bộ đếm mỗi turn mới — tránh giá trị cũ từ checkpoint làm sai router.
        "tool_call_count": 0,
        "review_count": 0,
        "has_bypassed_integration": False,
        "gmail_permission_granted": (integrations or {}).get("gmail_action_granted", False),
        "integrations": integrations or {},
        "system_context": system_context,
    }
    run_id = f"stream:{thread_id}"
    buf = ""
    emitted_sanitized_len = 0
    prev_stream_node: str | None = None
    emitted_tool_calls = set()

    try:
        async for item in _astream_messages_tokens(app_api, payload, config):
            msg, meta = _unpack_messages_stream_item(item)
            if msg is None:
                continue
            
            node = (meta or {}).get("langgraph_node")
        
            # 1. Phát hiện node mới
            if isinstance(node, str) and node and node != prev_stream_node:
                yield {"type": "status", "node": node, "status": "start"}
                if node in ["content_agent", "leader_agent", "integration_agent"]:
                    buf = ""
                    emitted_sanitized_len = 0
                prev_stream_node = node

            # 2. Phát hiện tool calls
            tcs = getattr(msg, "tool_calls", None)
            if tcs:
                for tc in tcs:
                    tc_id = tc.get("id")
                    if tc_id and tc_id not in emitted_tool_calls:
                        emitted_tool_calls.add(tc_id)
                        yield {
                            "type": "status", 
                            "node": node or prev_stream_node, 
                            "status": "tool_call", 
                            "tool": tc.get("name")
                        }

            # 3. Lọc nội dung (integration_agent là node nội bộ, không hiển thị cho user)
            if node in ["reviewer", "tools", "memory_bootstrap", "memory_writer", "integration_agent"]:
                _debug_log(
                    run_id,
                    "H1",
                    "AI_Core/graph.py:268",
                    "skip_non_user_node_chunk",
                    {"node": node},
                )
                continue

            # ==============================================================
            # BƯỚC LỌC ĐỘC (NÂNG CẤP): Xử lý cả Chunk lẫn tin nhắn cứng
            # ==============================================================
            # Nếu tin nhắn không phải là Chunk (mảnh nhỏ), ta bỏ qua để tránh lặp chữ
            # TUY NHIÊN: Nếu buf đang rỗng, ta cho phép tin nhắn Full Message lọt qua 
            # (Trường hợp AI trả lời ngay lập tức không qua stream)
            is_chunk = msg.__class__.__name__.endswith("Chunk")
            if not is_chunk:
                if len(buf) > 0:
                    continue 

            # Trích xuất reasoning và content
            reasoning = msg.additional_kwargs.get("reasoning_content") or msg.additional_kwargs.get("thought")
            c = msg.content
            
            if not c and not reasoning:
                continue

            if reasoning and isinstance(reasoning, str):
                # Nếu model đang trả reasoning tokens mà buf chưa có thẻ thought thì mở thẻ
                if "<thought" not in buf.lower():
                    buf = "<thought>\n" + buf
                buf += reasoning

            if c:
                # Nếu đang có thẻ thought mở mà bắt đầu có content thật thì đóng thẻ lại
                if "<thought" in buf.lower() and "</thought" not in buf.lower():
                    buf += "\n</thought>\n\n"
                    
                if isinstance(c, str):
                    buf += c
                elif isinstance(c, list):
                    for part in c:
                        if isinstance(part, dict) and part.get("type") == "text":
                            t = part.get("text") or ""
                            if t:
                                buf += t

            node_for_sanitize = node if isinstance(node, str) else prev_stream_node
            _debug_log(
                run_id,
                "H2",
                "AI_Core/graph.py:305",
                "before_sanitize_stream_buffer",
                {
                    "node_for_sanitize": node_for_sanitize,
                    "has_reasoning": bool(reasoning),
                    "has_content": bool(c),
                    "buf_has_review_markers": bool(
                        isinstance(buf, str)
                        and ("PASS" in buf or "FAIL" in buf or "Lý do:" in buf or "Gợi ý:" in buf)
                    ),
                },
            )
            if node_for_sanitize == "leader_agent":
                san = sanitize_assistant_text_keep_thought(buf)
            else:
                san = sanitize_assistant_text(buf)
            # Strip integration markers from stream output
            san = re.sub(r"【DỮ LIỆU THẬT TỪ API[^】]*】\n?", "", san)
            san = re.sub(r"【/DỮ LIỆU THẬT】\n?", "", san)
            san = re.sub(r'【[^】]{1,50}】\s*\n?', '', san)
            _debug_log(
                run_id,
                "H2",
                "AI_Core/graph.py:320",
                "after_sanitize_stream_buffer",
                {
                    "node_for_sanitize": node_for_sanitize,
                    "san_has_review_markers": bool(
                        isinstance(san, str)
                        and ("PASS" in san or "FAIL" in san or "Lý do:" in san or "Gợi ý:" in san)
                    ),
                    "san_has_thought_tag": bool(isinstance(san, str) and "<thought" in san.lower()),
                },
            )

            if len(san) < emitted_sanitized_len:
                emitted_sanitized_len = len(san)
            if len(san) > emitted_sanitized_len:
                yield {
                    "type": "chunk",
                    "chunk": san[emitted_sanitized_len:],
                    "node": node_for_sanitize,
                }
                emitted_sanitized_len = len(san)
    except Exception as e:
        # BẮT ĐƯỢC LỖI RỒI! In thẳng ra màn hình Terminal của AI_Core
        print(f"\n🚨 [CRITICAL ERROR] HỆ THỐNG LANGGRAPH BỊ SẬP:")
        print(f"Lỗi gốc: {str(e)}")
        traceback.print_exc() # In chi tiết dòng code bị lỗi bên trong Agent
        
        # Bắn một tín hiệu lỗi về cho NestJS để Frontend không bị treo
        # Làm sạch: CHỈ gửi thông báo thân thiện, KHÔNG lộ log nội bộ
        user_friendly_error = "Xin lỗi, hệ thống AI đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút."
        yield {
            "type": "chunk", 
            "chunk": f"\n\n{user_friendly_error}", 
            "node": "system_error"
        }
        # Đồng thời gửi event error riêng để NestJS bắt status
        yield {
            "type": "error",
            "error": f"[Hệ thống AI gặp sự cố nội bộ: {str(e)}]",
            "node": "system_error"
        }

