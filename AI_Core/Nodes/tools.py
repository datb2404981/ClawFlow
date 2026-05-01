"""Tool execution node - chạy các tool mà LLM agent yêu cầu."""
from __future__ import annotations

from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig

from state import ALL_TOOLS, ClawFlowState


_tool_executor = ToolNode(list(ALL_TOOLS.values()))


async def tools_node(state: ClawFlowState, config: RunnableConfig):
    """Chạy tool và truyền config (chứa integrations/access_token) cho tool."""
    response = await _tool_executor.ainvoke(state, config=config)
    tool_count = state.get("tool_call_count", 0) + 1
    return {"messages": response["messages"], "tool_call_count": tool_count}
