from langgraph.graph import StateGraph, START, END
from langchain_core.messages import AnyMessage, ToolMessage, SystemMessage
from typing import TypedDict, Annotated
import operator

from Agents.leader_agent import leader_agent, SYSTEM_PROMPT
from Tools.tool_browser import tool_by_name

# 1. Định nghĩa State
class ClawFlowState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    user_id: str
    current_task: str
    active_roles: list[str]


# 2. Node: Agent - Gọi LLM và quyết định
async def agent_node(state: ClawFlowState):
    # Nếu là tin nhắn đầu tiên, thêm system prompt vào
    messages = state["messages"]
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT_LEADER)] + messages
    response = await leader_agent.ainvoke(messages)
    return {"messages": [response]}


# 3. Node: Tools - Thực thi tool và trả về kết quả
async def tools_node(state: ClawFlowState):
    last_message = state["messages"][-1]
    results = []
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool = tool_by_name[tool_name]
        print(f"   🔧 Gọi tool: {tool_name} | Args: {str(tool_call['args'])[:60]}...")
        result = await tool.ainvoke(tool_call["args"])
        results.append(ToolMessage(content=str(result), tool_call_id=tool_call["id"]))
    return {"messages": results}


# 4. Conditional Edge: Agent quyết định đi đâu tiếp
def should_continue(state: ClawFlowState):
    last = state["messages"][-1]
    if last.tool_calls:
        return "tools"
    return END


# 5. Xây dựng Graph
graph = StateGraph(ClawFlowState)
graph.add_node("agent", agent_node)
graph.add_node("tools", tools_node)

graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", "agent")   # Sau khi chạy tool → quay lại agent đánh giá

# 6. Compile
app = graph.compile()


# 7. Hàm chạy graph (dùng ở chat.py)
async def run_graph(query: str, user_id: str = "default") -> str:
    from langchain_core.messages import HumanMessage
    result = await app.ainvoke({
        "messages": [HumanMessage(content=query)],
        "user_id": user_id
    })
    return result["messages"][-1].content
