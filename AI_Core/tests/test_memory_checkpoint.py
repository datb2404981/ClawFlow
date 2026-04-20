"""
Bộ test kiểm tra khả năng dùng Checkpoint & Memory dài hạn của ClawFlow Graph.

Chạy:
    cd AI_Core
    python -m tests.test_memory_checkpoint

Ý nghĩa các test:
    1. CHECKPOINT     - Cùng thread_id, AI phải nhớ được câu trước.
    2. MEMORY LOAD    - Turn 1 gọi memory tool, State có `core_profile` & `memory_loaded=True`.
    3. MEMORY SKIP    - Turn 2 cùng thread KHÔNG gọi memory tool nữa (đã cache).
    4. THREAD ISOLATE - Thread khác thì không nhiễm hồ sơ/luật của thread cũ.
    5. SAVE RULE      - Lưu luật riêng cho thread → DB ghi, cache invalidate.
    6. RELOAD RULE    - Sau save, turn kế tiếp State có luật mới.
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

# Cho phép `python -m tests.test_memory_checkpoint` chạy từ AI_Core/
AI_CORE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_CORE_DIR))

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage

load_dotenv(AI_CORE_DIR / ".env")

from graph import app_api, client, MEMORY_TOOL_NAMES  # noqa: E402


# =========================================================================
# HELPERS
# =========================================================================
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"


def title(text: str):
    print(f"\n{CYAN}{'═' * 70}\n  {text}\n{'═' * 70}{RESET}")


def check(label: str, ok: bool, detail: str = ""):
    tag = f"{GREEN}✅ PASS{RESET}" if ok else f"{RED}❌ FAIL{RESET}"
    extra = f" - {detail}" if detail else ""
    print(f"  {tag} {label}{extra}")
    return ok


def make_config(user_id: str, thread_id: str) -> dict:
    return {"configurable": {"user_id": user_id, "thread_id": thread_id}}


async def run_turn(user_id: str, thread_id: str, message: str) -> dict:
    """Gửi 1 câu, trả về state sau khi chạy."""
    config = make_config(user_id, thread_id)
    await app_api.ainvoke(
        {
            "messages": [HumanMessage(content=message)],
            "user_id": user_id,
            "thread_id": thread_id,
        },
        config=config,
    )
    snapshot = await app_api.aget_state(config)
    return snapshot.values


def count_memory_tool_calls_since(state: dict, from_index: int) -> int:
    """Đếm số lần tool của memory_agent được gọi kể từ index thứ `from_index` trong messages."""
    count = 0
    for m in state["messages"][from_index:]:
        if isinstance(m, ToolMessage) and m.name in MEMORY_TOOL_NAMES:
            count += 1
    return count


def seed_fake_user(user_id: str):
    """Chèn 1 record user giả lập vào clawflaw_core_api.users để Get_Core_Profile có data."""
    db = client["clawflaw_core_api"]
    db["users"].update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "name": "Huy Test",
                "email": "huy.test@clawflow.local",
                "role": "developer",
                "plan": "pro",
            }
        },
        upsert=True,
    )


def cleanup(user_id: str, thread_ids: list[str]):
    """Dọn data test sau khi chạy xong."""
    client["clawflaw_core_api"]["users"].delete_one({"user_id": user_id})
    if thread_ids:
        client["clawflaw_ai_brain"]["thread_contexts"].delete_many(
            {"thread_id": {"$in": thread_ids}}
        )
        client["clawflaw_ai_brain"]["agent_checkpoints"].delete_many(
            {"thread_id": {"$in": thread_ids}}
        )


# =========================================================================
# TEST SUITE
# =========================================================================
async def main():
    if not os.getenv("MONGO_URI"):
        print(f"{RED}❌ Thiếu MONGO_URI trong .env{RESET}")
        return

    user_id = f"test_user_{uuid.uuid4().hex[:8]}"
    thread_a = f"test_thread_A_{uuid.uuid4().hex[:6]}"
    thread_b = f"test_thread_B_{uuid.uuid4().hex[:6]}"

    print(f"{YELLOW}🔧 Setup: user_id={user_id}, thread_a={thread_a}, thread_b={thread_b}{RESET}")
    seed_fake_user(user_id)

    results: list[bool] = []

    try:
        # =============================================
        # TEST 1 - CHECKPOINT
        # =============================================
        title("TEST 1: Checkpoint (AI nhớ câu trước trong cùng thread)")
        state1 = await run_turn(user_id, thread_a, "Xin chào, tôi tên là Huy.")
        human_count_1 = sum(1 for m in state1["messages"] if isinstance(m, HumanMessage))

        state2 = await run_turn(user_id, thread_a, "Bạn có nhớ tên tôi không?")
        human_count_2 = sum(1 for m in state2["messages"] if isinstance(m, HumanMessage))

        results.append(check(
            "Checkpointer tích luỹ HumanMessage qua các turn",
            human_count_2 == human_count_1 + 1,
            f"turn1={human_count_1} HumanMsg, turn2={human_count_2} HumanMsg",
        ))

        last_ai = next(
            (m for m in reversed(state2["messages"]) if isinstance(m, AIMessage) and m.content),
            None,
        )
        results.append(check(
            "Turn 2 có AIMessage trả lời",
            last_ai is not None,
            (last_ai.content[:80] + "...") if last_ai and last_ai.content else "không có",
        ))

        # =============================================
        # TEST 2 - MEMORY LOAD (turn 1 đã cache)
        # =============================================
        title("TEST 2: Memory Load (sau turn 1, State đã cache profile + cờ)")
        results.append(check(
            "State.core_profile đã có dữ liệu",
            bool(state1.get("core_profile")),
            str(state1.get("core_profile", ""))[:80] + "...",
        ))
        results.append(check(
            "State.memory_loaded = True",
            state1.get("memory_loaded") is True,
            f"value={state1.get('memory_loaded')}",
        ))
        results.append(check(
            "State.thread_rules có giá trị (dù là 'chưa có luật riêng')",
            state1.get("thread_rules") is not None,
            str(state1.get("thread_rules", ""))[:60] + "...",
        ))

        # =============================================
        # TEST 3 - MEMORY SKIP (turn 2 không gọi memory tool)
        # =============================================
        title("TEST 3: Memory Skip (turn 2 KHÔNG gọi lại memory tool)")
        turn1_msg_count = len(state1["messages"])
        new_memory_calls = count_memory_tool_calls_since(state2, turn1_msg_count)
        results.append(check(
            "Turn 2 không phát sinh lệnh gọi memory tool",
            new_memory_calls == 0,
            f"số lần gọi memory tool ở turn 2 = {new_memory_calls}",
        ))

        # =============================================
        # TEST 4 - THREAD ISOLATE (thread_b không thấy data thread_a)
        # =============================================
        title("TEST 4: Thread Isolation (thread khác phải load lại từ đầu)")
        state_b1 = await run_turn(user_id, thread_b, "Hello từ phòng chat B.")
        # State của thread B phải riêng biệt. memory_loaded của B ban đầu nên là True sau turn đầu.
        results.append(check(
            "Thread B có state độc lập, memory_loaded=True sau turn đầu",
            state_b1.get("memory_loaded") is True,
            f"value={state_b1.get('memory_loaded')}",
        ))
        # Verify các HumanMessage của thread A KHÔNG xuất hiện ở thread B
        a_texts = [m.content for m in state1["messages"] if isinstance(m, HumanMessage)]
        b_texts = [m.content for m in state_b1["messages"] if isinstance(m, HumanMessage)]
        leak = any(t in b_texts for t in a_texts)
        results.append(check(
            "Thread B không rò rỉ HumanMessage của thread A",
            not leak,
            f"A texts={a_texts}, B texts={b_texts}",
        ))

        # =============================================
        # TEST 5 - SAVE RULE (lưu luật riêng cho thread_a)
        # =============================================
        title("TEST 5: Save_Thread_Context (lưu luật + invalidate cache)")
        await run_turn(
            user_id,
            thread_a,
            "Hãy ghi nhớ quy tắc cho phòng chat này: Luôn trả lời bằng tiếng Việt và kết thúc bằng chữ 'OK'.",
        )

        # Check DB có record
        ctx_doc = client["clawflaw_ai_brain"]["thread_contexts"].find_one({"thread_id": thread_a})
        rule_ok = bool(
            ctx_doc
            and ctx_doc.get("context_rules")
            and any("tiếng Việt" in r or "OK" in r for r in ctx_doc["context_rules"])
        )
        results.append(check(
            "DB `thread_contexts` có record chứa luật mới",
            rule_ok,
            f"rules={ctx_doc.get('context_rules') if ctx_doc else None}",
        ))

        # =============================================
        # TEST 6 - RELOAD RULE (turn kế tiếp, state có luật mới)
        # =============================================
        title("TEST 6: Reload Rule (cache đã invalidate → load lại luật mới)")
        state_after_save = await run_turn(
            user_id, thread_a, "Xác nhận bạn đã nhận luật."
        )
        rules_text = str(state_after_save.get("thread_rules", ""))
        results.append(check(
            "State.thread_rules sau save chứa nội dung luật mới",
            ("tiếng Việt" in rules_text) or ("OK" in rules_text),
            rules_text[:100] + "...",
        ))
        results.append(check(
            "State.memory_loaded = True sau khi reload",
            state_after_save.get("memory_loaded") is True,
            f"value={state_after_save.get('memory_loaded')}",
        ))

    finally:
        # =============================================
        # TỔNG KẾT
        # =============================================
        total = len(results)
        passed = sum(results)
        title("KẾT QUẢ")
        color = GREEN if passed == total else (YELLOW if passed > total // 2 else RED)
        print(f"  {color}{passed}/{total} test pass{RESET}")

        # Dọn data test
        print(f"\n{YELLOW}🧹 Cleanup data test...{RESET}")
        cleanup(user_id, [thread_a, thread_b])
        print(f"{GREEN}Done.{RESET}")


if __name__ == "__main__":
    asyncio.run(main())
