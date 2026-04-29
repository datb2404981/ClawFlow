"""Helpers đọc/filter message cho cả 2 trường hợp: object và dict (LangGraph Studio)."""
from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, ToolMessage

from state import MEMORY_TOOL_NAMES
from Utils.text_sanitize import sanitize_assistant_text, strip_thought

__all__ = [
    "sanitize_assistant_text",
    "strip_thought",
    "msg_attr",
    "is_memory_tool_msg",
    "has_memory_tool_call",
    "last_human_text",
    "last_human_text_excluding_internal",
]


def msg_attr(m: Any, key: str, default=None):
    """Đọc attribute an toàn trên cả dict-message lẫn Object-message."""
    if isinstance(m, dict):
        return m.get(key, default)
    return getattr(m, key, default)


def is_memory_tool_msg(m: Any) -> bool:
    """Message là ToolMessage của memory tool?"""
    m_type = "tool" if isinstance(m, ToolMessage) else msg_attr(m, "type", "")
    m_name = msg_attr(m, "name", "")
    return m_type == "tool" and m_name in MEMORY_TOOL_NAMES


def has_memory_tool_call(m: Any) -> bool:
    """AIMessage có gọi memory tool?"""
    tool_calls = msg_attr(m, "tool_calls", []) or []
    return any(tc.get("name") in MEMORY_TOOL_NAMES for tc in tool_calls)


def last_human_text(state: dict) -> str:
    """Nội dung HumanMessage mới nhất trong state (rỗng nếu không có)."""
    for m in reversed(state.get("messages", [])):
        if isinstance(m, HumanMessage):
            return str(m.content or "")
        if isinstance(m, dict) and m.get("type") == "human":
            return str(m.get("content", ""))
    return ""


def last_human_text_excluding_internal(state: dict) -> str:
    """Human gần nhất không phải hint nội bộ của reviewer (retry loop)."""
    for m in reversed(state.get("messages", [])):
        if isinstance(m, HumanMessage):
            c = str(m.content or "")
            if c.startswith("[ClawFlow-internal-review]"):
                continue
            return c
        if isinstance(m, dict) and m.get("type") == "human":
            c = str(m.get("content", ""))
            if c.startswith("[ClawFlow-internal-review]"):
                continue
            return c
    return ""
