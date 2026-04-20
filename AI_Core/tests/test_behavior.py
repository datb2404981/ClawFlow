"""Bộ test hành vi hội thoại (E2E) cho ClawFlow.

Tập trung 3 câu hỏi anh đang lo:
    1. **KHÔNG BỊA**      — AI chưa biết thì nói "em chưa có thông tin",
                             TUYỆT ĐỐI không sinh ra trường ĐH, số tuổi, công ty.
    2. **NHỚ**            — User đã khai → hỏi lại AI phải trả đúng.
    3. **NGẦM HIỂU**       — User đề cập gián tiếp (vd hỏi thời tiết Cần Thơ)
                             → hỏi suy luận, AI phải kéo được info từ history.

Chạy:
    cd AI_Core
    python -m tests.test_behavior

Mỗi scenario dùng 1 thread_id riêng (clean slate), cleanup ở cuối.
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Iterable

AI_CORE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_CORE_DIR))

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

load_dotenv(AI_CORE_DIR / ".env")

from graph import app_api, client  # noqa: E402

# =========================================================================
# PRETTY PRINT
# =========================================================================
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"


def title(text: str):
    print(f"\n{CYAN}{BOLD}{'═' * 72}\n  {text}\n{'═' * 72}{RESET}")


def subtitle(text: str):
    print(f"\n{CYAN}── {text} ──{RESET}")


def check(label: str, ok: bool, detail: str = "") -> bool:
    tag = f"{GREEN}✅ PASS{RESET}" if ok else f"{RED}❌ FAIL{RESET}"
    extra = f"  {DIM}{detail}{RESET}" if detail else ""
    print(f"  {tag}  {label}{extra}")
    return ok


def chat_print(role: str, text: str):
    color = YELLOW if role == "USER" else GREEN
    prefix = f"{color}[{role}]{RESET}"
    lines = (text or "").splitlines() or [""]
    print(f"  {prefix} {lines[0]}")
    for l in lines[1:]:
        print(f"         {l}")


# =========================================================================
# HELPERS
# =========================================================================
async def send(
    user_id: str,
    thread_id: str,
    text: str,
    *,
    verbose: bool = True,
) -> tuple[str, dict]:
    """Gửi 1 câu, trả về (reply_text, full_state_values)."""
    config = {"configurable": {"user_id": user_id, "thread_id": thread_id}}
    payload = {"messages": [HumanMessage(content=text)]}
    if verbose:
        chat_print("USER", text)
    t0 = time.time()
    result = await app_api.ainvoke(payload, config=config)
    dt = time.time() - t0
    reply_msg = next(
        (m for m in reversed(result["messages"]) if isinstance(m, AIMessage) and m.content),
        None,
    )
    reply = reply_msg.content if reply_msg else ""
    if verbose:
        chat_print("AI  ", reply)
        print(f"         {DIM}(took {dt:.1f}s){RESET}")
    return reply, result


def contains_any(text: str, needles: Iterable[str]) -> bool:
    low = (text or "").lower()
    return any(n.lower() in low for n in needles)


def contains_all(text: str, needles: Iterable[str]) -> bool:
    low = (text or "").lower()
    return all(n.lower() in low for n in needles)


def count_tool_calls(state: dict, tool_name: str, since_index: int = 0) -> int:
    n = 0
    for m in state.get("messages", [])[since_index:]:
        if isinstance(m, ToolMessage) and m.name == tool_name:
            n += 1
    return n


def cleanup(user_id: str, thread_ids: list[str]):
    client["clawflaw_core_api"]["users"].delete_one({"user_id": user_id})
    if thread_ids:
        db = client["clawflaw_ai_brain"]
        db["thread_contexts"].delete_many({"thread_id": {"$in": thread_ids}})
        # MongoDBSaver lưu vào 2 collection này:
        db["checkpoints"].delete_many({"thread_id": {"$in": thread_ids}})
        db["checkpoint_writes"].delete_many({"thread_id": {"$in": thread_ids}})


# Từ khóa "AI thừa nhận không biết" — một trong các cụm này xuất hiện → OK
_IDK_MARKERS = [
    "chưa có",
    "chưa biết",
    "chưa nắm",
    "chưa rõ",
    "em chưa",
    "không biết",
    "chưa có thông tin",
    "anh cho em biết",
    "anh cho em xin",
    "xin lỗi",
]

# Từ khóa BỊA điển hình — nếu xuất hiện trong câu trả lời KHI AI không có info
# → fail. Đây là các cụm Llama 8B hay bịa.
_HALLUCINATION_NEEDLES = [
    "đại học quốc gia",
    "đại học bách khoa",
    "đại học kinh tế",
    "trường đại học",
    "đh quốc gia",
    "đh bách khoa",
    "fpt university",
    "rmit",
]


# =========================================================================
# SCENARIO 1 — KHÔNG BỊA
# =========================================================================
async def scenario_no_hallucination(user_id: str, thread_id: str) -> list[bool]:
    title("SCENARIO 1 · Không bịa thông tin chưa khai")
    results: list[bool] = []

    subtitle("Setup: user chỉ khai TÊN, không khai gì khác")
    await send(user_id, thread_id, "Xin chào, tui tên là Đạt.")

    subtitle("Hỏi các thông tin CHƯA khai → AI phải nói 'em chưa có'")
    for probe in [
        "Tui học ở đâu?",
        "Tui mấy tuổi?",
        "Tui làm việc ở công ty nào?",
    ]:
        reply, _ = await send(user_id, thread_id, probe)
        ok_admit = contains_any(reply, _IDK_MARKERS)
        ok_no_halluc = not contains_any(reply, _HALLUCINATION_NEEDLES)
        results.append(check(
            f"'{probe}' → AI thừa nhận chưa biết",
            ok_admit,
            reply[:90],
        ))
        results.append(check(
            f"'{probe}' → KHÔNG bịa trường/đại học/công ty",
            ok_no_halluc,
            "clean" if ok_no_halluc else f"LEAK: {reply[:120]}",
        ))

    return results


# =========================================================================
# SCENARIO 2 — NHỚ NHỮNG GÌ ĐÃ NÓI
# =========================================================================
async def scenario_memory_recall(user_id: str, thread_id: str) -> list[bool]:
    title("SCENARIO 2 · Nhớ những gì user đã khai (auto-extract attribute)")
    results: list[bool] = []

    subtitle("User khai 4 thuộc tính (tên / nơi ở / nơi học / tuổi)")
    await send(user_id, thread_id, "Tui tên là Đạt.")
    await send(user_id, thread_id, "Tui ở Cần Thơ.")
    await send(user_id, thread_id, "Tui học ĐH Cần Thơ.")
    await send(user_id, thread_id, "Tui 25 tuổi.")

    subtitle("Kiểm tra rules đã có 4 label tương ứng trong MongoDB")
    doc = client["clawflaw_ai_brain"]["thread_contexts"].find_one({"thread_id": thread_id})
    rules = " | ".join(doc.get("context_rules", [])) if doc else ""
    results.append(check("DB có label 'Địa điểm: Cần Thơ'",
                         "Cần Thơ" in rules and "Địa điểm" in rules, rules[:120]))
    results.append(check("DB có label 'Học tại: ĐH Cần Thơ'",
                         "Học tại" in rules, rules[:120]))
    results.append(check("DB có label 'Tuổi: 25'",
                         "Tuổi: 25" in rules or "Tuổi:25" in rules, rules[:120]))

    subtitle("Hỏi lại — AI phải trả đúng")
    reply, _ = await send(user_id, thread_id, "Tui tên gì?")
    results.append(check("Hỏi tên → trả 'Đạt'",
                         "Đạt" in reply or "đạt" in reply.lower(), reply[:90]))

    reply, _ = await send(user_id, thread_id, "Tui đang ở đâu?")
    results.append(check("Hỏi nơi ở → trả 'Cần Thơ'",
                         "Cần Thơ" in reply or "cần thơ" in reply.lower(), reply[:90]))

    reply, _ = await send(user_id, thread_id, "Tui học ở đâu?")
    results.append(check("Hỏi nơi học → trả 'Cần Thơ' (không bịa trường khác)",
                         ("Cần Thơ" in reply or "cần thơ" in reply.lower())
                         and not contains_any(reply, ["bách khoa", "quốc gia", "rmit", "fpt"]),
                         reply[:90]))

    reply, _ = await send(user_id, thread_id, "Tui bao nhiêu tuổi?")
    results.append(check("Hỏi tuổi → trả '25'",
                         "25" in reply, reply[:90]))

    return results


# =========================================================================
# SCENARIO 3 — FAST-PATH tên / vai trò (deterministic, không qua LLM)
# =========================================================================
async def scenario_fast_path(user_id: str, thread_id: str) -> list[bool]:
    title("SCENARIO 3 · Fast-path recall tên + vai trò (bypass LLM)")
    results: list[bool] = []

    subtitle("User khai tên + gán vai trò cho AI")
    await send(user_id, thread_id, "xin chào, tui là Đạt, bạn là trợ lý cá nhân của tui.")

    subtitle("Các biến thể câu hỏi tên — phải trả 'Đạt' nhất quán")
    for q in ["Tui tên là gì?", "Tên tui là gì vậy?", "Bạn có nhớ tên tui không?"]:
        reply, _ = await send(user_id, thread_id, q)
        results.append(check(f"'{q}' → có 'Đạt'",
                             "Đạt" in reply or "đạt" in reply.lower(),
                             reply[:90]))

    subtitle("Hỏi vai trò — phải mention 'trợ lý cá nhân'")
    reply, _ = await send(user_id, thread_id, "Bạn là ai của tui?")
    results.append(check("Hỏi vai trò → có 'trợ lý'",
                         "trợ lý" in reply.lower(),
                         reply[:90]))

    return results


# =========================================================================
# SCENARIO 4 — NGẦM HIỂU TỪ CONTEXT
# =========================================================================
async def scenario_implicit_understanding(user_id: str, thread_id: str) -> list[bool]:
    title("SCENARIO 4 · Ngầm hiểu — suy luận từ lịch sử chat")
    results: list[bool] = []

    subtitle("User KHÔNG khai địa điểm, chỉ hỏi thời tiết Cần Thơ")
    await send(user_id, thread_id, "xin chào, tui là Đạt.")
    await send(user_id, thread_id, "trời hôm nay nóng quá, bạn coi thời tiết ở Cần Thơ sao?")

    subtitle("Hỏi 'tui đang ở đâu?' — AI phải kéo được 'Cần Thơ' từ history")
    reply, _ = await send(user_id, thread_id, "vậy hiện tại tui đang ở đâu?")
    mentions_ct = ("Cần Thơ" in reply) or ("cần thơ" in reply.lower())
    asks_confirm = contains_any(reply, ["phải không", "đúng không", "xác nhận", "có phải", "đúng chứ"])
    admits_idk_only = contains_any(reply, _IDK_MARKERS) and not mentions_ct

    results.append(check(
        "AI nhắc 'Cần Thơ' (đã suy luận từ history)",
        mentions_ct,
        reply[:120],
    ))
    results.append(check(
        "AI KHÔNG chỉ nói 'em chưa có' (vì history đã có gợi ý)",
        not admits_idk_only,
        "OK" if not admits_idk_only else f"leak: {reply[:100]}",
    ))
    results.append(check(
        "AI KHÔNG bịa địa điểm khác ngoài Cần Thơ",
        not contains_any(reply, ["hà nội", "sài gòn", "tp.hcm", "đà nẵng", "huế"])
        or mentions_ct,
        reply[:120],
    ))

    return results


# =========================================================================
# SCENARIO 5 — Không gọi Tavily cho info cá nhân
# =========================================================================
async def scenario_no_tavily_for_personal(user_id: str, thread_id: str) -> list[bool]:
    title("SCENARIO 5 · Không dùng Tavily để tra info cá nhân")
    results: list[bool] = []

    subtitle("User khai công ty + dự án")
    await send(user_id, thread_id, "Tui là Đạt, công ty của tui tên là ClawFlow.")
    await send(user_id, thread_id, "Dự án tui đang làm tên Phoenix, deadline còn 3 ngày.")

    subtitle("Hỏi lại — phải trả đúng, KHÔNG gọi Search_Tavily")
    reply, state = await send(user_id, thread_id, "Công ty tui tên gì?")
    tavily_calls = count_tool_calls(state, "Search_Tavily")
    results.append(check(
        "Trả có 'ClawFlow'",
        "ClawFlow" in reply or "clawflow" in reply.lower(),
        reply[:90],
    ))
    results.append(check(
        "KHÔNG gọi Search_Tavily cho câu info cá nhân",
        tavily_calls == 0,
        f"tavily_calls_cumulative={tavily_calls}",
    ))

    reply, _ = await send(user_id, thread_id, "Dự án tui tên gì, còn mấy ngày nữa deadline?")
    results.append(check(
        "Trả có 'Phoenix' + '3'",
        ("Phoenix" in reply or "phoenix" in reply.lower()) and "3" in reply,
        reply[:120],
    ))

    return results


# =========================================================================
# ENTRY
# =========================================================================
async def main():
    if not os.getenv("MONGO_URI"):
        print(f"{RED}❌ Thiếu MONGO_URI trong .env{RESET}")
        return

    user_id = f"test_behavior_{uuid.uuid4().hex[:8]}"
    threads = {
        "s1": f"test_s1_{uuid.uuid4().hex[:6]}",
        "s2": f"test_s2_{uuid.uuid4().hex[:6]}",
        "s3": f"test_s3_{uuid.uuid4().hex[:6]}",
        "s4": f"test_s4_{uuid.uuid4().hex[:6]}",
        "s5": f"test_s5_{uuid.uuid4().hex[:6]}",
    }
    print(f"{YELLOW}🔧 user_id={user_id}")
    for k, v in threads.items():
        print(f"        thread_{k}={v}")
    print(RESET)

    all_results: list[bool] = []
    try:
        all_results += await scenario_no_hallucination(user_id, threads["s1"])
        all_results += await scenario_memory_recall(user_id, threads["s2"])
        all_results += await scenario_fast_path(user_id, threads["s3"])
        all_results += await scenario_implicit_understanding(user_id, threads["s4"])
        all_results += await scenario_no_tavily_for_personal(user_id, threads["s5"])
    finally:
        passed = sum(all_results)
        total = len(all_results)
        title("TỔNG KẾT")
        color = GREEN if passed == total else (YELLOW if passed >= total * 0.7 else RED)
        print(f"  {color}{BOLD}{passed}/{total} assertion PASS{RESET}")

        print(f"\n{YELLOW}🧹 Cleanup…{RESET}")
        cleanup(user_id, list(threads.values()))
        print(f"{GREEN}Done.{RESET}")


if __name__ == "__main__":
    asyncio.run(main())
