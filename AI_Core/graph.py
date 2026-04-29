"""ClawFlow Graph - lắp ráp tất cả node và router thành luồng chạy."""
from __future__ import annotations

from langchain_core.messages import AIMessageChunk, HumanMessage
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
from mongo_client import client, db_saver  # noqa: F401 (re-export cho ui)
from state import MEMORY_TOOL_NAMES, ClawFlowState
from Utils.messages import sanitize_assistant_text

def _unpack_messages_stream_item(
    item: object,
) -> tuple[AIMessageChunk | None, dict]:
    """LangGraph v2: {type: messages, data: (chunk, meta)}; v1: (chunk, meta) hoặc (\"messages\", (...))."""
    if isinstance(item, dict) and item.get("type") == "messages":
        data = item.get("data")
        if isinstance(data, tuple) and data:
            head = data[0]
            meta = data[1] if len(data) > 1 and isinstance(data[1], dict) else {}
            if isinstance(head, AIMessageChunk):
                return head, meta
        return None, {}
    if isinstance(item, tuple) and item:
        if (
            len(item) == 2
            and item[0] == "messages"
            and isinstance(item[1], tuple)
        ):
            inner = item[1]
            if inner and isinstance(inner[0], AIMessageChunk):
                meta = (
                    inner[1]
                    if len(inner) > 1 and isinstance(inner[1], dict)
                    else {}
                )
                return inner[0], meta
        head = item[0]
        if isinstance(head, AIMessageChunk):
            meta = item[1] if len(item) > 1 and isinstance(item[1], dict) else {}
            return head, meta
    return None, {}


async def _astream_messages_tokens(compiled, payload, config):
    try:
        async for it in compiled.astream(
            payload,
            config=config,
            stream_mode="messages",
            version="v2",
        ):
            yield it
    except TypeError:
        async for it in compiled.astream(
            payload,
            config=config,
            stream_mode="messages",
        ):
            yield it


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
    raw = result["messages"][-1].content
    if isinstance(raw, str):
        return sanitize_assistant_text(raw)
    return raw


async def run_graph_stream(
    query: str,
    user_id: str,
    thread_id: str = "1",
):
    """Stream từng đoạn nội dung assistant (token/chunk) cho SSE — chỉ emit phần đã qua sanitize (ẩn <thought>).

    Khi có `langgraph_node` trong metadata (stream v2): xoá buffer khi bắt đầu stream
    từ `content_agent` để UI không ghép bản Leader + bản Content.
    """
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
        }
    }
    payload = {"messages": [HumanMessage(content=query)]}
    buf = ""
    emitted_sanitized_len = 0
    prev_stream_node: str | None = None
    async for item in _astream_messages_tokens(app_api, payload, config):
        msg, meta = _unpack_messages_stream_item(item)
        if msg is None or not msg.content:
            continue
        node = (meta or {}).get("langgraph_node")
        if isinstance(node, str) and node == "content_agent" and prev_stream_node != "content_agent":
            buf = ""
            emitted_sanitized_len = 0
        if isinstance(node, str) and node:
            prev_stream_node = node
        c = msg.content
        if isinstance(c, str) and c:
            buf += c
        elif isinstance(c, list):
            for part in c:
                if isinstance(part, dict) and part.get("type") == "text":
                    t = part.get("text") or ""
                    if t:
                        buf += t
        san = sanitize_assistant_text(buf)
        if len(san) < emitted_sanitized_len:
            emitted_sanitized_len = len(san)
        if len(san) > emitted_sanitized_len:
            yield san[emitted_sanitized_len:]
            emitted_sanitized_len = len(san)
