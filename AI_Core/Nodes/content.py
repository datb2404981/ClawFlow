"""Content Agent node - Chuyên gia viết/định dạng nội dung."""
from __future__ import annotations

from langchain_core.messages import SystemMessage

from Agents.content_agent import content_agent, SYSTEM_PROMPT_CONTENT
from state import ClawFlowState
from Utils.messages import sanitize_assistant_text


async def content_agent_node(state: ClawFlowState):
    non_system = [m for m in state["messages"] if not isinstance(m, SystemMessage)]
    messages = [SystemMessage(content=SYSTEM_PROMPT_CONTENT)] + non_system
    response = await content_agent.ainvoke(messages)

    if isinstance(response.content, str):
        response.content = sanitize_assistant_text(response.content)

    if response.additional_kwargs is None:
        response.additional_kwargs = {}
    response.additional_kwargs["source_agent"] = "content_agent"
    return {"messages": [response]}
