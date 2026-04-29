"""Các router quyết định luồng đi giữa các node."""
from __future__ import annotations

from langgraph.graph import END

from Utils.intent import detect_personal_fact, detect_save_intent
from Utils.messages import last_human_text_excluding_internal, msg_attr
from state import CONTENT_TOOL_NAMES, ClawFlowState

# Nest compile task: khối RAG trong Human — chuyển Content định dạng câu trả lời.
_RAG_MARKERS = (
    "### DỮ LIỆU TÀI LIỆU KHO",
    "DỮ LIỆU TÀI LIỆU KHO (RAG CONTEXT)",
    "RAG CONTEXT",
    "### ƯU TIÊN NGUỒN TRI THỨC",
    "ƯU TIÊN NGUỒN TRI THỨC WORKSPACE",
)


def _last_turn_has_workspace_rag(state: ClawFlowState) -> bool:
    blob = last_human_text_excluding_internal(state) or ""
    upper = blob.upper()
    return any(m.upper() in upper for m in _RAG_MARKERS)


def entry_router(state: ClawFlowState):
    """Quyết định turn này vào đâu.
    Thứ tự ưu tiên:
    1) User muốn LƯU luật / giới thiệu tên / gán vai trò cho AI → memory_writer.
    2) Cache chưa có                                             → memory_bootstrap.
    3) Còn lại                                                   → thẳng Leader.
    """
    from Utils.messages import last_human_text

    text = last_human_text(state)
    if detect_save_intent(text) or detect_personal_fact(text):
        return "memory_writer"
    if state.get("memory_loaded"):
        return "leader_agent"
    return "memory_bootstrap"


def after_writer_router(state: ClawFlowState):
    """Sau khi ghi luật: thiếu profile thì bootstrap, đủ rồi thì Leader."""
    if not state.get("core_profile"):
        return "memory_bootstrap"
    return "leader_agent"


def leader_router(state: ClawFlowState):
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    content = str(getattr(last, "content", ""))
    if "Hãy viết" in content or "viết báo cáo" in content.lower():
        return "content_agent"
    if _last_turn_has_workspace_rag(state):
        return "content_agent"
    return "reviewer"


def content_router(state: ClawFlowState):
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "reviewer"


def tools_router(state: ClawFlowState):
    """Tool của agent nào chạy xong → trả về đúng agent đó."""
    # CHỐNG LOOP (Recursion Limit)
    if state.get("tool_call_count", 0) >= 5:
        # Thay vì treo, ép chạy qua Reviewer để kết thúc phiên làm việc
        return "reviewer"

    last = state["messages"][-1]
    tool_name = msg_attr(last, "name", "")
    if tool_name in CONTENT_TOOL_NAMES:
        return "content_agent"
    return "leader_agent"


def review_router(state: ClawFlowState):
    """Quyết định đi đâu sau khi Review."""
    review_count = state.get("review_count", 0)
    last_msg = state["messages"][-1]
    c = str(getattr(last_msg, "content", "") or "")
    internal_fail = c.startswith("[ClawFlow-internal-review]")
    legacy_feedback = "SYSTEM FEEDBACK" in c
    if c and (internal_fail or legacy_feedback):
        if review_count >= 3:
            return END
        return "leader_agent"  # Ép leader xử lý lại
    return END
