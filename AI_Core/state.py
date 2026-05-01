"""State, và các hằng số dùng chung cho toàn Graph (không khởi tạo Mongo — xem mongo_client)."""
from __future__ import annotations

import operator
from typing import Annotated, Optional, TypedDict

from langchain_core.messages import AnyMessage

from Tools.tool_browser import tool_by_name as browser_tools
from Tools.tool_content import tool_by_name as content_tools
from Tools.tool_memory import tool_by_name as memory_tools
from Tools.tool_calculator import tool_by_name as calculator_tools
from Tools.tool_code import tool_by_name as code_tools
from Tools.tool_rag import tool_by_name as rag_tools
from Tools.tool_gmail import read_gmail_tool
from Tools.tool_gmail_send import send_gmail_tool
from Tools.tool_calendar import create_calendar_event_tool
from Tools.tool_delegate import delegate_to_integration

# =========================================================================
# STATE
# =========================================================================
class ClawFlowState(TypedDict, total=False):
    """Trạng thái phiên chat - LangGraph sẽ tự merge qua các turn."""
    messages: Annotated[list[AnyMessage], operator.add]
    user_id: str
    thread_id: str
    current_task: str
    active_roles: list[str]

    core_profile: Optional[str]
    thread_rules: Optional[str]
    memory_loaded: bool

    review_count: int
    tool_call_count: int
    has_bypassed_integration: bool


# =========================================================================
# TOOLS REGISTRY
# =========================================================================
gmail_tools = {
    "read_gmail_tool": read_gmail_tool,
    "delegate_to_integration": delegate_to_integration,
    "send_gmail_tool": send_gmail_tool,
    "create_calendar_event_tool": create_calendar_event_tool
}
ALL_TOOLS = {**browser_tools, **content_tools, **memory_tools, **calculator_tools, **code_tools, **rag_tools, **gmail_tools}
MEMORY_TOOL_NAMES = set(memory_tools.keys())
CONTENT_TOOL_NAMES = set(content_tools.keys())
