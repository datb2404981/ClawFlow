"""Leader Agent node - Trưởng nhóm điều phối."""
import re
import uuid
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

from Agents.leader_agent import GEMINI_MODEL_LEADER, SYSTEM_PROMPT_LEADER
from Tools.tool_browser import tool_browsers
from Tools.tool_delegate import delegate_to_integration
from Tools.tool_gmail import read_gmail_tool
from Utils.gemini_client import gemini_client

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
)
from Utils.text_sanitize import sanitize_assistant_text_keep_thought
from state import ClawFlowState


def _clean_integration_markers(text: str) -> str:
    """Loại bỏ markers nội bộ 【DỮ LIỆU THẬT TỪ API】 khỏi output hiển thị cho user."""
    t = text or ""
    t = re.sub(r"【DỮ LIỆU THẬT TỪ API[^】]*】\n?", "", t)
    t = re.sub(r"【/DỮ LIỆU THẬT】\n?", "", t)
    return t.strip()


def _strip_fake_tool_calls(text: str) -> str:
    """Loại bỏ tool call giả mà Qwen viết bằng text thay vì dùng function calling.
    Ví dụ: 'delegate_to_integration {"task_description": "..."}'
    """
    t = text or ""
    # Xóa ACTION: blocks
    t = re.sub(r'(?:^|\n)\s*ACTION\s*:\s*\n?', '\n', t, flags=re.IGNORECASE)
    # Xóa THOUGHT: blocks
    t = re.sub(r'(?:^|\n)\s*THOUGHT\s*:.*', '', t, flags=re.IGNORECASE)
    # Xóa USER: blocks (echo)
    t = re.sub(r'(?:^|\n)\s*USER\s*:.*', '', t, flags=re.IGNORECASE)
    # Xóa các dòng chứa tool call giả
    t = re.sub(
        r'(?:^|\n)\s*(?:delegate_to_integration|Delegate_To_Content_Agent|read_gmail_tool)\s*\{[^}]*\}\s*',
        '\n', t, flags=re.IGNORECASE
    )
    # Xóa các khối 【TÁC PHẨM】, 【THÔNG BÁO】, 【NHIỆM VỤ...】, 【THÔNG TIN ĐÃ TRÍCH DẪN】
    t = re.sub(r'【[^】]{1,50}】\s*\n?', '', t)
    # Xóa dòng trống liên tiếp
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()


def _rescue_text_tool_call(response) -> bool:
    """Khi Qwen viết tool call bằng TEXT thay vì function calling,
    parse nó và gắn thành tool_call thật vào response.

    Trả về True nếu đã rescue thành công.
    """
    import json as _json
    import uuid as _uuid

    content = str(getattr(response, "content", ""))
    if not content:
        return False

    # Đã có tool_calls thật → không cần rescue
    if getattr(response, "tool_calls", None):
        return False

    # Pattern: delegate_to_integration {"key": "value"}
    # hoặc: ACTION:\n delegate_to_integration {"key": "value"}
    pattern = re.search(
        r'delegate_to_integration\s*(\{[^}]+\})',
        content, flags=re.IGNORECASE
    )
    if not pattern:
        return False

    # Parse JSON args
    try:
        raw_args = _json.loads(pattern.group(1))
    except Exception:
        raw_args = {}

    # Chuẩn hóa args → task_description
    task_desc = (
        raw_args.get("task_description")
        or raw_args.get("action")
        or raw_args.get("query")
        or "Đọc email mới nhất"
    )

    call_id = f"call_{_uuid.uuid4().hex[:12]}"
    response.tool_calls = [{
        "id": call_id,
        "name": "delegate_to_integration",
        "args": {"task_description": task_desc},
    }]
    response.content = ""
    print(f"[leader] RESCUE: text-based tool call → real tool_call "
          f"(task_description='{task_desc[:60]}')")
    return True


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
    """Chuẩn bị history gọn:
    1) Bỏ SystemMessage cũ.
    2) Bỏ message của memory_agent & memory tool.
    3) Với tool round-trip (AIMessage tool_calls + ToolMessage): chỉ giữ khi thuộc về
       HumanMessage CUỐI CÙNG (turn đang xử lý).
    4) ĐẶC BIỆT: Bỏ các AIMessage cũ có chứa 【DỮ LIỆU THẬT TỪ API】 để tránh AI bị "ám ảnh" 
       bởi kết quả email cũ khi user đã chuyển sang câu hỏi khác.
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
        # Giữ lại các ToolMessage và AIMessage(tool_calls) CHỈ nễu chúng thuộc turn cuối
        if isinstance(m, ToolMessage) or (isinstance(m, AIMessage) and getattr(m, "tool_calls", None)):
            if i > last_human_idx:
                pruned.append(m)
            continue
        
        # Nếu là AIMessage thông thường của turn cũ mà chứa dữ liệu API -> Bỏ qua
        if isinstance(m, AIMessage) and i < last_human_idx:
            content = str(getattr(m, "content", ""))
            if "【DỮ LIỆU THẬT TỪ API" in content or "📧 **Tóm tắt email" in content:
                print(f"[leader] Trimming old API result message at index {i}")
                continue

        pruned.append(m)

    # Cắt cửa sổ HISTORY_WINDOW
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


async def leader_agent_node(state: ClawFlowState, config: RunnableConfig):
    """Leader đọc core_profile & thread_rules từ State (không còn phải parse text)."""
    total = len(state.get("messages", []))
    valid_history = _trim_history(state["messages"])
    thread_rules = state.get("thread_rules") or ""
    core_profile = state.get("core_profile") or ""

    integrations = config.get("configurable", {}).get("integrations", {})

    # Debug: kiểm tra xem kết quả Integration có trong history không
    has_integration_result = any(
        "【DỮ LIỆU THẬT TỪ API" in str(getattr(m, "content", ""))
        for m in valid_history
    )

    print(
        f"[leader] total_msgs={total} | valid_history={len(valid_history)} | "
        f"profile={'Y' if core_profile else 'N'} "
        f"rules={'Y' if thread_rules else 'N'} | "
        f"gmail_connected={'Y' if integrations.get('gmail', {}).get('connected') else 'N'} "
        f"has_token={'Y' if integrations.get('gmail', {}).get('access_token') else 'N'} | "
        f"gmail_granted={'Y' if integrations.get('gmail', {}).get('gmail_action_granted') else 'N'} | "
        f"has_integration_result={'Y' if has_integration_result else 'N'}"
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

    # ━━━ KIỂM TRA QUYỀN TRUY CẬP GMAIL (HUMAN-IN-THE-LOOP) ━━━
    # Nếu user muốn đọc/gửi mail nhưng chưa được cấp quyền qua Action Card (gmail_action_granted)
    # thì CHỈ được phép hỏi xin phép, KHÔNG được gọi tool.
    gmail_granted = integrations.get("gmail", {}).get("gmail_action_granted", False)
    email_keywords = ["mail", "email", "gmail", "thư", "hộp thư", "inbox", "đọc mail", "gửi mail"]
    user_asking_email = any(kw in user_text.lower() for kw in email_keywords)
    
    if user_asking_email and not gmail_granted:
        print("[leader] GMAIL_PERMISSION_REQUIRED → Trả câu xin phép (Action Plan format)")
        permission_msg = AIMessage(
            content=(
                "Dạ, em thấy anh muốn thao tác với Gmail. Để bảo mật, anh vui lòng xác nhận "
                "cho phép em truy cập vào hộp thư của anh nhé! "
                "(Anh có thể bấm nút **Đồng ý** ở thông báo phía dưới ạ).\n\n"
                '<!--CF_ACTION_PLAN_START-->{"requires_human": true, "actions": [{"type": "request_permission", "label": "Đồng ý truy cập Gmail"}]}<!--CF_ACTION_PLAN_END-->'
            ),
            additional_kwargs={"source_agent": "leader_agent"},
        )
        return {"messages": [permission_msg]}

    # Bắt đầu xây dựng Prompt
    # 1. System Prompt cứng từ Python
    prompt_parts = [SYSTEM_PROMPT_LEADER]
    
    # 2. System Context mềm từ NestJS (Skills, RAG, System Guard, etc.)
    system_context = state.get("system_context")
    if system_context:
        prompt_parts.append(system_context)

    # 3. Trạng thái Task & Draft
    task_status = state.get("task_status", "running")
    draft_payload = state.get("draft_payload", "")
    
    status_block = f"[TRẠNG THÁI HỆ THỐNG]\n• Task Status: {task_status}"
    if task_status == "waiting_execute_approval":
        status_block += f"\n• Draft Data: {draft_payload}"
    prompt_parts.append(status_block)

    # 4. Profile & Rules (nếu chưa có trong system_context)
    if not system_context:
        if core_profile:
            prompt_parts.append(f"[HỒ SƠ NGƯỜI DÙNG]\n{core_profile}")
        if thread_rules:
            prompt_parts.append(f"[LUẬT RIÊNG PHÒNG CHAT]\n{thread_rules}")

    combined_system_prompt = "\n\n".join(prompt_parts)
    messages = [SystemMessage(content=combined_system_prompt)] + valid_history

    # ━━━ BYPASS: Có kết quả Integration → KHÔNG gọi LLM, trả thẳng cho user ━━━
    # Qwen 7B quá yếu: bịa nội dung, viết tiếng Trung, không tuân thủ prompt.
    # Giải pháp: bypass hoàn toàn, dùng dữ liệu thật từ API trả thẳng.
    # CHỈ BYPASS 1 LẦN DUY NHẤT: dùng flag để tránh lặp khi Reviewer kick back.
    already_bypassed = state.get("has_bypassed_integration", False)
    if has_integration_result and not already_bypassed:
        print("[leader] BYPASS LLM: trả thẳng integration result cho user (1 lần duy nhất)")
        integration_data = ""
        for m in reversed(valid_history):
            content = str(getattr(m, "content", ""))
            if "【DỮ LIỆU THẬT TỪ API" in content:
                integration_data = content
                break

        # Dọn dẹp markers nội bộ
        clean = _clean_integration_markers(integration_data)
        clean = _strip_fake_tool_calls(clean)
        clean = clean.strip()

        if not clean:
            clean = "Không nhận được dữ liệu từ API. Vui lòng thử lại."

        bypass_msg = AIMessage(
            content=clean,
            additional_kwargs={"source_agent": "leader_agent"},
        )
        return {"messages": [bypass_msg], "has_bypassed_integration": True}

    active_tools = list(tool_browsers)
    from Tools.tool_gmail_send import draft_gmail_tool
    # Nạp trực tiếp tool cho LLM tự chọn
    active_tools.append(read_gmail_tool)
    active_tools.append(draft_gmail_tool)
    active_tools.append(delegate_to_integration)

    # Gọi Gemini API trực tiếp thay vì qua LangChain Ollama
    gemini_resp = await gemini_client.generate_content_async(
        model=GEMINI_MODEL_LEADER,
        contents=messages,
        tools=active_tools,
        temperature=0.1
    )

    # Chuyển đổi phản hồi của Gemini về AIMessage để giữ tương thích với Graph
    content = gemini_resp.text or ""
    tool_calls = []
    
    if gemini_resp.candidates and gemini_resp.candidates[0].content.parts:
        for part in gemini_resp.candidates[0].content.parts:
            if part.function_call:
                tool_calls.append({
                    "name": part.function_call.name,
                    "args": part.function_call.args,
                    "id": f"call_{uuid.uuid4().hex[:12]}"
                })
    
    response = AIMessage(content=content, tool_calls=tool_calls)

    # ━━━ RESCUE: Chuyển đổi text tool call nếu có ━━━
    _rescue_text_tool_call(response)

    # ━━━ QUAN TRỌNG: Khi có tool_call → XÓA text content ━━━
    # Qwen luôn viết text kèm tool_call ("sẽ kiểm tra... đã kiểm tra... không phát hiện")
    # Đây là text BỊA TRƯỚC khi tool chạy → phải xóa để tránh hiển thị cho user.
    if response.tool_calls:
        has_delegate = any(
            tc.get("name") == "delegate_to_integration" for tc in response.tool_calls
        )
        if has_delegate:
            print(f"[leader] tool_call=delegate_to_integration → XÓA text content "
                f"({len(response.content)} chars bị bỏ)")
            response.content = ""
        else:
            # Tool khác (web_search, etc): giữ thought nếu có, xóa phần còn lại
            if isinstance(response.content, str) and "<thought" in response.content.lower():
                # Giữ thought block
                import re as _re
                thought_match = _re.search(
                    r"(<thought[^>]*>.*?</thought>)", response.content,
                    flags=_re.DOTALL | _re.IGNORECASE
                )
                response.content = thought_match.group(1) if thought_match else ""
            else:
                response.content = ""

    # Bổ sung: Lấy reasoning từ metadata nếu model hỗ trợ (Gemini/DeepSeek native)
    reasoning = response.additional_kwargs.get("reasoning_content") or response.additional_kwargs.get("thought")
    if reasoning and isinstance(reasoning, str) and isinstance(response.content, str):
        if "<thought" not in response.content.lower() and "<thought" not in reasoning.lower():
            response.content = f"<thought>\n{reasoning}\n</thought>\n\n{response.content}"

    if isinstance(response.content, str):
        response.content = sanitize_assistant_text_keep_thought(response.content)
        # Loại bỏ markers nội bộ khỏi output hiển thị cho user
        response.content = _clean_integration_markers(response.content)
        # Loại bỏ tool call giả nếu model viết bằng text
        response.content = _strip_fake_tool_calls(response.content)

    if not response.content.strip() and not response.tool_calls:
        response.content = (
            "Hệ thống AI đã tiếp nhận. Anh/Chị muốn em thực hiện cụ thể việc gì? "
            "(Kèm dữ liệu nếu có nhé!)"
        )

    if response.additional_kwargs is None:
        response.additional_kwargs = {}
    response.additional_kwargs["source_agent"] = "leader_agent"
    return {"messages": [response]}
