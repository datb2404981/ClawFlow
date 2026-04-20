"""Helpers đọc/filter message cho cả 2 trường hợp: object và dict (LangGraph Studio)."""
from __future__ import annotations

import re
from typing import Any

from langchain_core.messages import HumanMessage, ToolMessage

from state import MEMORY_TOOL_NAMES

_THOUGHT_FULL_RE = re.compile(r"<thought>.*?</thought>", re.DOTALL | re.IGNORECASE)
_THOUGHT_OPEN_ONLY_RE = re.compile(r"<thought>.*", re.DOTALL | re.IGNORECASE)
_THOUGHT_CLOSE_PREFIX_RE = re.compile(r"^\s*(?:<[^>]*)?</thought>", re.IGNORECASE)


def strip_thought(text: str) -> str:
    """Xoá mọi biến thể của khối <thought>.

    Xử lý 3 trường hợp:
    - <thought>...</thought>  (đầy đủ)
    - Thiếu </thought> ở cuối → xoá từ <thought> đến hết.
    - Thiếu <thought> đầu, chỉ có </thought> ở đâu đó → xoá mọi thứ đến hết </thought>.
    """
    if not text:
        return text

    cleaned = _THOUGHT_FULL_RE.sub("", text)

    if "<thought>" in cleaned.lower() and "</thought>" not in cleaned.lower():
        cleaned = _THOUGHT_OPEN_ONLY_RE.sub("", cleaned)

    lower = cleaned.lower()
    close_idx = lower.rfind("</thought>")
    if close_idx != -1:
        cleaned = cleaned[close_idx + len("</thought>"):]

    return cleaned.strip()


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
