"""Leader Agent node - Trưởng nhóm điều phối."""
from __future__ import annotations

import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from Agents.leader_agent import leader_agent, SYSTEM_PROMPT_LEADER
from Utils.intent import (
    detect_about_user_query,
    detect_recall_name_question,
    detect_recall_role_question,
    find_fact_in_rules,
    read_known_fact,
    rules_has_intent_match,
)
from Utils.messages import (
    has_memory_tool_call,
    is_memory_tool_msg,
    last_human_text,
    last_human_text_excluding_internal,
    msg_attr,
    sanitize_assistant_text,
)
from state import ClawFlowState


HISTORY_WINDOW = 8

# Nest `tasks.service` luôn kết compiled prompt bằng khối này — chỉ đoạn sau
# mới là câu user thật; fast-path regex không được quét cả RAG (false positive).
_NHIEM_VU_MARKER = "### NHIỆM VỤ CỦA BẠN (TỪ NGƯỜI DÙNG):"


def _user_question_for_fast_path(state: ClawFlowState) -> str:
    blob = last_human_text_excluding_internal(state) or ""
    idx = blob.rfind(_NHIEM_VU_MARKER)
    if idx == -1:
        return blob.strip()
    return blob[idx + len(_NHIEM_VU_MARKER) :].strip()


def _trim_history(messages: list) -> list:
    """Chuẩn bị history gọn cho Llama 8B:
    1) Bỏ SystemMessage cũ (sẽ gắn prompt mới ở ngoài).
    2) Bỏ message của memory_agent & memory tool.
    3) Giữ HumanMessage, AIMessage text thuần.
    4) Với tool round-trip (AIMessage tool_calls + ToolMessage): chỉ giữ khi thuộc về
       HumanMessage CUỐI CÙNG (turn đang xử lý). Các round-trip cũ → bỏ để tránh
       nhồi context Tavily qua nhiều turn.
    5) Cắt cửa sổ: chỉ giữ HISTORY_WINDOW HumanMessage gần nhất kèm AIMessage đi sau.
    """
    cleaned: list = []
    for m in messages:
        if isinstance(m, SystemMessage):
            continue
        if is_memory_tool_msg(m) or has_memory_tool_call(m):
            continue
        if msg_attr(m, "additional_kwargs", {}).get("source_agent") == "memory_agent":
            continue
        cleaned.append(m)

    last_human_idx = -1
    for i in range(len(cleaned) - 1, -1, -1):
        if isinstance(cleaned[i], HumanMessage):
            last_human_idx = i
            break

    pruned: list = []
    for i, m in enumerate(cleaned):
        if isinstance(m, ToolMessage):
            if i > last_human_idx:
                pruned.append(m)
            continue
        if isinstance(m, AIMessage) and getattr(m, "tool_calls", None):
            if i > last_human_idx:
                pruned.append(m)
            continue
        pruned.append(m)

    human_indices = [i for i, m in enumerate(pruned) if isinstance(m, HumanMessage)]
    if len(human_indices) > HISTORY_WINDOW:
        cut_from = human_indices[-HISTORY_WINDOW]
        pruned = pruned[cut_from:]

    return pruned


def _fast_recall_answer(user_text: str, thread_rules: str) -> str | None:
    """Trả lời tức thì (không qua LLM) cho các câu hồi ký đã có câu trả lời
    trong thread_rules. Tránh việc Llama 8B đi gọi Search_Tavily để tra tên user.
    """
    if detect_recall_name_question(user_text):
        name = read_known_fact(thread_rules, "Tên người dùng")
        if name:
            return f"Dạ, anh tên là **{name}**. Em có giúp được gì tiếp không ạ?"
        return (
            "Dạ em chưa được anh cho biết tên. Anh giới thiệu giúp em với, "
            "ví dụ: “Tui tên là …” nhé."
        )

    if detect_recall_role_question(user_text):
        role = read_known_fact(thread_rules, "Vai trò của bạn (AI)") or read_known_fact(
            thread_rules, "Vai trò của bạn"
        )
        if role:
            return f"Dạ, em là **{role}** của anh ạ."
        return (
            "Dạ em là trợ lý AI của ClawFlow. Anh có thể giao cho em một vai trò "
            "cụ thể bằng câu “Bạn là …” nhé."
        )
    return None


# ---------------------------------------------------------------------------
# FAST-PATH cho câu hỏi thuộc tính (địa điểm / học / làm / tuổi / sở thích).
# Mỗi entry: (regex, label_trong_rules, positive_reply_builder, topic_cho_câu_chặn)
# Khi match intent:
#   - rules có value → dùng positive_reply_builder(value)
#   - rules rỗng     → trả câu "em chưa biết về <topic>" (CHẶN LLM bịa Tavily)
# ---------------------------------------------------------------------------
def _pos_age(v: str) -> str:
    return f"Dạ, anh **{v} tuổi** (theo thông tin anh đã dặn em trước đó ạ)."


def _pos_school(v: str) -> str:
    return f"Dạ, anh học tại **{v}** (theo thông tin anh đã cho em biết ạ)."


def _pos_work(v: str) -> str:
    return f"Dạ, anh làm việc tại **{v}** (theo thông tin anh đã cho em biết ạ)."


def _pos_location(v: str) -> str:
    return f"Dạ, anh đang ở **{v}** (theo thông tin anh đã cho em biết ạ)."


def _pos_hobby(v: str) -> str:
    return f"Dạ, sở thích của anh là **{v}** (theo thông tin anh đã cho em biết ạ)."


def _pos_company(v: str) -> str:
    return f"Dạ, công ty của anh là **{v}** (theo thông tin anh đã cho em biết ạ)."


def _pos_project_with_deadline(v: str, deadline: str | None) -> str:
    if deadline:
        return (
            f"Dạ, dự án của anh là **{v}**, deadline còn **{deadline}** "
            f"(theo thông tin anh đã cho em biết ạ)."
        )
    return f"Dạ, dự án của anh là **{v}** (theo thông tin anh đã cho em biết ạ)."


# Mỗi entry: (regex, label_trong_rules, positive_reply_builder, topic_cho_câu_chặn)
_ATTR_QUESTION_MAP: list[tuple[re.Pattern, str, callable, str]] = [
    (re.compile(r"(?i)\b(m[ấa]y|bao\s+nhi[êe]u)\s+tu[ổo]i\b"),
     "Tuổi", _pos_age, "tuổi"),
    (re.compile(r"(?i)\bh[ọo]c\b.*\bđâu\b|\bđâu\b.*\bh[ọo]c\b|\bh[ọo]c\s+tr[ưu][ờo]ng\s+(n[àa]o|g[ìi])\b"),
     "Học tại", _pos_school, "trường anh học"),
    # Câu "công ty tui tên gì / công ty của tui là gì" → ưu tiên đọc label "Công ty"
    (re.compile(r"(?i)\bc[ôo]ng\s+ty\b.{0,30}?\b(n[àa]o|g[ìi]|t[êe]n)\b"),
     "Công ty", _pos_company, "công ty của anh"),
    (re.compile(r"(?i)\bl[àa]m(?:\s+vi[ệe]c)?\b.*\bđâu\b|\bđâu\b.*\bl[àa]m\b"),
     "Làm việc tại", _pos_work, "nơi anh làm việc"),
    (re.compile(r"(?i)\b(ở|đang\s+ở|s[ốo]ng)\b.*\bđâu\b|\bđâu\b.*\b(ở|s[ốo]ng)\b|\bở\s+đâu\b"),
     "Địa điểm", _pos_location, "nơi anh ở"),
    (re.compile(r"(?i)\bth[íi]ch\s+(?:ăn|chơi|đọc|xem|làm)\s+g[ìi]\b|\bs[ởo]\s+th[íi]ch\b"),
     "Sở thích", _pos_hobby, "sở thích"),
]


# Pattern hỏi dự án (có thể kèm deadline)
_PROJECT_QUESTION_RE = re.compile(
    r"(?i)\bd[ựu]\s+[áa]n\b.{0,30}?\b(n[àa]o|g[ìi]|t[êe]n)\b"
)
_DEADLINE_QUESTION_RE = re.compile(
    r"(?i)\b(deadline|h[ạa]n\s+ch[óo]t|m[ấa]y\s+ng[àa]y|bao\s+nhi[êe]u\s+ng[àa]y)\b"
)


def _fast_attr_answer(user_text: str, thread_rules: str) -> str | None:
    """Xử lý câu hỏi thuộc tính:
    - Rules có value → trả thẳng giá trị.
    - Rules rỗng → CHẶN luôn bằng câu "em chưa biết về <topic>", không để
      LLM bịa bằng cách gọi Tavily/Browser với query nhảm.

    Riêng câu hỏi dự án (có thể kèm deadline) cần ghép 2 label "Dự án" +
    "Deadline" → xử lý riêng trước map chung.
    """
    text = user_text or ""

    if _PROJECT_QUESTION_RE.search(text):
        project = read_known_fact(thread_rules, "Dự án")
        deadline = read_known_fact(thread_rules, "Deadline") if _DEADLINE_QUESTION_RE.search(text) else None
        if project:
            return _pos_project_with_deadline(project, deadline)
        return (
            "Dạ, em chưa có thông tin về **dự án** của anh trong hồ sơ. "
            "Anh cho em biết để em ghi nhớ nhé (em sẽ lưu lại để lần sau khỏi hỏi lại)."
        )

    for pat, label, positive, topic in _ATTR_QUESTION_MAP:
        if pat.search(text):
            value = read_known_fact(thread_rules, label)
            # Fallback: hỏi "công ty" mà chưa có label "Công ty" → thử "Làm việc tại"
            if not value and label == "Công ty":
                value = read_known_fact(thread_rules, "Làm việc tại")
            if value:
                return positive(value)
            return (
                f"Dạ, em chưa có thông tin về **{topic}** trong hồ sơ. "
                f"Anh cho em biết để em ghi nhớ nhé (em sẽ lưu lại để lần sau khỏi hỏi lại)."
            )
    return None


# ---------------------------------------------------------------------------
# SUY LUẬN ĐỊA ĐIỂM TỪ HISTORY
# User hỏi "tui đang ở đâu" mà rules chưa có Địa điểm → scan history: nếu có
# câu user đã đề cập địa danh (vd: "thời tiết Cần Thơ") → đề xuất xác nhận.
# ---------------------------------------------------------------------------
_LOC_MENTION_RE = re.compile(
    r"\b(?:thời\s*tiết|ở|tại|đi|đến|tới|về|chơi\s+(?:ở|tại))\s+"
    r"([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){0,3})"
)
_LOC_QUERY_RE = re.compile(
    r"(?i)\b(?:tui|t[ôo]i|m[ìi]nh|em|anh|ch[ịi])\s+"
    r"(?:đang\s+)?(?:ở|s[ốo]ng)\s+đâu\b|\bở\s+đâu\b"
)


def _infer_location_from_history(messages: list) -> str | None:
    """Tìm địa danh proper-noun user từng đề cập (text gần nhất trước → cũ hơn)."""
    for m in reversed(messages):
        if not isinstance(m, HumanMessage):
            continue
        content = str(m.content or "")
        for match in _LOC_MENTION_RE.finditer(content):
            loc = match.group(1).strip()
            if loc and len(loc) >= 2:
                return loc
    return None


def _fast_location_infer(user_text: str, thread_rules: str, messages: list) -> str | None:
    """Chỉ chạy khi query là "tui ở đâu" mà rules KHÔNG có Địa điểm — lúc này
    mới cần suy luận từ history. Nếu rules đã có → để `_fast_attr_answer` lo.
    """
    if not _LOC_QUERY_RE.search(user_text or ""):
        return None
    if read_known_fact(thread_rules, "Địa điểm"):
        return None
    past = messages[:-1] if messages else []
    loc = _infer_location_from_history(past)
    if not loc:
        return None
    return (
        f"Dạ em thấy anh có nhắc đến **{loc}** trong lịch sử chat — "
        f"anh đang ở {loc} phải không ạ? Anh xác nhận để em ghi nhớ nhé."
    )


MIN_CONTEXT_LEN = 80


def _gather_haystack(messages: list, thread_rules: str) -> str:
    """Gộp rules + nội dung HumanMessage QUÁ KHỨ (không tính câu user đang
    hỏi) để guard kiểm tra: info đã xuất hiện trước đó chưa? Nếu tính cả
    câu hiện tại thì guard sẽ tự-khớp, mất tác dụng.
    """
    from langchain_core.messages import HumanMessage  # local import
    chunks = [thread_rules or ""]
    past = messages[:-1] if messages else []
    for m in past[-20:]:
        if isinstance(m, HumanMessage):
            chunks.append(str(m.content or ""))
    return "\n".join(c for c in chunks if c).strip()


def _unknown_fact_answer(user_text: str, haystack: str) -> str | None:
    """Chặn Llama bịa: câu hỏi về user mà haystack KHÔNG có info liên quan →
    trả deterministic "em chưa biết". Chỉ chặn cứng khi haystack CÒN NGẮN
    (đầu phiên). Khi đã đủ context, tin LLM đọc history để suy luận.
    """
    if not detect_about_user_query(user_text):
        return None
    if find_fact_in_rules(haystack, user_text):
        return None
    if rules_has_intent_match(haystack, user_text):
        return None
    if len(haystack) >= MIN_CONTEXT_LEN:
        return None
    return (
        "Dạ, em chưa có thông tin này trong hồ sơ của anh. "
        "Anh cho em biết để em ghi nhớ nhé (em sẽ lưu lại để lần sau khỏi phải hỏi)."
    )


async def leader_agent_node(state: ClawFlowState):
    """Leader đọc core_profile & thread_rules từ State (không còn phải parse text)."""
    total = len(state.get("messages", []))
    valid_history = _trim_history(state["messages"])
    thread_rules = state.get("thread_rules") or ""
    core_profile = state.get("core_profile") or ""

    print(
        f"[leader] total_msgs={total} | valid_history={len(valid_history)} | "
        f"profile={'Y' if core_profile else 'N'} "
        f"rules={'Y' if thread_rules else 'N'}"
    )

    user_text = _user_question_for_fast_path(state)
    quick = _fast_recall_answer(user_text, thread_rules)
    if quick is not None:
        print("[leader] FAST_PATH recall → skip LLM")
        fast_msg = AIMessage(
            content=quick,
            additional_kwargs={"source_agent": "leader_agent"},
        )
        return {"messages": [fast_msg]}

    # Thứ tự QUAN TRỌNG: infer location chạy TRƯỚC fast-path attribute.
    # Vì khi rules thiếu Địa điểm nhưng history có địa danh → muốn suy luận,
    # KHÔNG muốn _fast_attr_answer chặn cứng "em chưa biết".
    quick = _fast_location_infer(user_text, thread_rules, state.get("messages", []))
    if quick is not None:
        print("[leader] FAST_PATH infer_location → skip LLM")
        fast_msg = AIMessage(
            content=quick,
            additional_kwargs={"source_agent": "leader_agent"},
        )
        return {"messages": [fast_msg]}

    quick = _fast_attr_answer(user_text, thread_rules)
    if quick is not None:
        print("[leader] FAST_PATH attribute → skip LLM")
        fast_msg = AIMessage(
            content=quick,
            additional_kwargs={"source_agent": "leader_agent"},
        )
        return {"messages": [fast_msg]}

    haystack = _gather_haystack(state.get("messages", []), thread_rules)
    unknown = _unknown_fact_answer(user_text, haystack)
    if unknown is not None:
        print("[leader] UNKNOWN_FACT → trả 'em chưa biết', skip LLM")
        fast_msg = AIMessage(
            content=unknown,
            additional_kwargs={"source_agent": "leader_agent"},
        )
        return {"messages": [fast_msg]}

    prompt = SYSTEM_PROMPT_LEADER
    if core_profile or thread_rules:
        prompt += "\n\n[HỒ SƠ TỪ THỦ THƯ - BẮT BUỘC ĐỌC KỸ]"
        if core_profile:
            prompt += f"\n• Hồ sơ người dùng: {core_profile}"
        if thread_rules:
            prompt += f"\n• Luật riêng phòng này: {thread_rules}"

    messages = [SystemMessage(content=prompt)] + valid_history
    response = await leader_agent.ainvoke(messages)

    if isinstance(response.content, str):
        response.content = sanitize_assistant_text(response.content)

    if not response.content.strip() and not response.tool_calls:
        response.content = (
            "Hệ thống AI đã tiếp nhận. Anh/Chị muốn em thực hiện cụ thể việc gì? "
            "(Kèm dữ liệu nếu có nhé!)"
        )

    if response.additional_kwargs is None:
        response.additional_kwargs = {}
    response.additional_kwargs["source_agent"] = "leader_agent"
    return {"messages": [response]}
