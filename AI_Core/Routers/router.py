"""Các router quyết định luồng đi giữa các node."""
from __future__ import annotations

from langgraph.graph import END

from Utils.intent import detect_personal_fact, detect_save_intent
from Utils.messages import last_human_text, msg_attr
from state import CONTENT_TOOL_NAMES, ClawFlowState


def entry_router(state: ClawFlowState):
    """Quyết định turn này vào đâu.
    Thứ tự ưu tiên:
    1) User muốn LƯU luật / giới thiệu tên / gán vai trò cho AI → memory_writer.
    2) Cache chưa có                                             → memory_bootstrap.
    3) Còn lại                                                   → thẳng Leader.
    """
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
    
    # Nếu reviewer trả về FAIL -> nó sẽ thêm System Feedback vào message list
    if getattr(last_msg, "content", "") and "SYSTEM FEEDBACK" in str(last_msg.content):
        if review_count >= 3:
            return END
        return "leader_agent" # Ép leader xử lý lại
    return END
