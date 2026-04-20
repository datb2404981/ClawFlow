"""Memory nodes: bootstrap (load) và writer (save). Cả 2 đều deterministic - không dùng LLM."""
from __future__ import annotations

from langchain_core.runnables import RunnableConfig

from Tools.tool_memory import (
    Get_Core_Profile,
    Get_Thread_Context,
    Save_Thread_Context,
)
from Utils.intent import extract_rule
from Utils.messages import last_human_text
from state import ClawFlowState


async def memory_bootstrap_node(state: ClawFlowState, config: RunnableConfig):
    """LOAD: Gọi thẳng 2 tool bằng Python, cache vào State.
    Chỉ chạy khi cache chưa có (memory_loaded != True).
    """
    profile = await Get_Core_Profile.ainvoke({}, config=config)
    rules = await Get_Thread_Context.ainvoke({}, config=config)

    return {
        "core_profile": str(profile),
        "thread_rules": str(rules),
        "memory_loaded": True,
    }


async def memory_writer_node(state: ClawFlowState, config: RunnableConfig):
    """WRITE: Bóc luật từ câu user → save DB → refresh cache.
    Không tạo AIMessage → không phình lịch sử chat.
    """
    rule = extract_rule(last_human_text(state))
    if not rule:
        return {}

    await Save_Thread_Context.ainvoke({"rule_or_skill": rule}, config=config)
    new_rules = await Get_Thread_Context.ainvoke({}, config=config)

    return {
        "thread_rules": str(new_rules),
        "memory_loaded": True,
    }
