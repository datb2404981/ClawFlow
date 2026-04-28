"""ClawFlow Graph - lắp ráp tất cả node và router thành luồng chạy."""
from __future__ import annotations

from langchain_core.messages import HumanMessage
from langgraph.graph import END, START, StateGraph

from Nodes.content import content_agent_node
from Nodes.leader import leader_agent_node
from Nodes.memory import memory_bootstrap_node, memory_writer_node
from Nodes.tools import tools_node
from Nodes.reviewer import reviewer_node
from Routers.router import (
    after_writer_router,
    content_router,
    entry_router,
    leader_router,
    tools_router,
    review_router,
)
from state import MEMORY_TOOL_NAMES, ClawFlowState, client, db_saver  # noqa: F401 (re-export)


# =========================================================================
# BUILD GRAPH
# =========================================================================
graph = StateGraph(ClawFlowState)

graph.add_node("memory_bootstrap", memory_bootstrap_node)
graph.add_node("memory_writer", memory_writer_node)
graph.add_node("leader_agent", leader_agent_node)
graph.add_node("content_agent", content_agent_node)
graph.add_node("tools", tools_node)
graph.add_node("reviewer", reviewer_node)

graph.add_conditional_edges(
    START,
    entry_router,
    {
        "memory_writer": "memory_writer",
        "memory_bootstrap": "memory_bootstrap",
        "leader_agent": "leader_agent",
    },
)

graph.add_edge("memory_bootstrap", "leader_agent")

graph.add_conditional_edges(
    "memory_writer",
    after_writer_router,
    {
        "memory_bootstrap": "memory_bootstrap",
        "leader_agent": "leader_agent",
    },
)

graph.add_conditional_edges(
    "leader_agent",
    leader_router,
    {
        "tools": "tools",
        "content_agent": "content_agent",
        "reviewer": "reviewer",
    },
)

graph.add_conditional_edges(
    "content_agent",
    content_router,
    {
        "tools": "tools",
        "reviewer": "reviewer",
    },
)

graph.add_conditional_edges(
    "tools",
    tools_router,
    {
        "leader_agent": "leader_agent",
        "content_agent": "content_agent",
        "reviewer": "reviewer",
    },
)

graph.add_conditional_edges(
    "reviewer",
    review_router,
    {
        "leader_agent": "leader_agent",
        END: END,
    },
)


# =========================================================================
# COMPILE
# =========================================================================
# `app`     : cho LangGraph Studio (Studio tự gắn checkpointer của nó)
# `app_api` : cho API backend thật — PHẢI dùng bản này để có MongoDB persistence
app = graph.compile()
app_api = graph.compile(checkpointer=db_saver)


# =========================================================================
# ENTRY POINT CHO API
# =========================================================================
async def run_graph(query: str, user_id: str, thread_id: str = "1") -> str:
    """Chạy 1 turn. thread_id = session_id do frontend truyền lên.

    Lưu ý theo chuẩn LangGraph v1:
    - thread_id / user_id đặt trong `config.configurable` để checkpointer dùng.
    - Payload state CHỈ nhét delta (messages mới). Các field khác do các node ghi
      và checkpointer tự merge theo reducer (operator.add cho messages).
    """
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
        }
    }
    payload = {"messages": [HumanMessage(content=query)]}
    result = await app_api.ainvoke(payload, config=config)
    return result["messages"][-1].content
