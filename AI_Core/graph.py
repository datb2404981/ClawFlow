from langgraph.graph import StateGraph, START, END
from langchain_core.messages import AnyMessage, ToolMessage, SystemMessage
from typing import TypedDict, Annotated
import operator

from Agents.leader_agent import leader_agent, SYSTEM_PROMPT_LEADER
from Agents.content_agent import content_agent, SYSTEM_PROMPT_CONTENT

# Import và đổi tên biến để không bị trùng
from Tools.tool_browser import tool_by_name as browser_tools
from Tools.tool_content import tool_by_name as content_tools

# Gộp tất cả thành 1 biến
ALL_TOOLS = {**browser_tools, **content_tools}
class ClawFlowState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    user_id: str
    current_task: str
    active_roles: list[str]


# 2. Node: Agent - Gọi LLM và quyết định
async def leader_agent_node(state: ClawFlowState):
    # Lọc SystemMessage cũ, inject prompt của LEADER
    non_system = [m for m in state["messages"] if not isinstance(m, SystemMessage)]
    messages = [SystemMessage(content=SYSTEM_PROMPT_LEADER)] + non_system
    response = await leader_agent.ainvoke(messages)
    return {"messages": [response]}

async def content_agent_node(state: ClawFlowState):
    # Lọc SystemMessage cũ của Leader, inject prompt của CONTENT AGENT
    non_system = [m for m in state["messages"] if not isinstance(m, SystemMessage)]
    messages = [SystemMessage(content=SYSTEM_PROMPT_CONTENT)] + non_system
    response = await content_agent.ainvoke(messages)
    return {"messages": [response]}


# 3. Node: Tools - Thực thi tool và trả về kết quả
async def tools_node(state: ClawFlowState):
    last_message = state["messages"][-1]
    results = []
    # Gọi nhiều tool 1 lúc nếu LLM yêu cầu
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        
        # Tra cứu tool từ KHO TỔNG
        if tool_name not in ALL_TOOLS:
            print(f"⚠️ Tool {tool_name} không tồn tại!")
            continue
            
        tool = ALL_TOOLS[tool_name]
        print(f"   🔧 Gọi tool: {tool_name} | Args: {str(tool_call['args'])[:60]}...")
        result = await tool.ainvoke(tool_call["args"])
        results.append(ToolMessage(content=str(result), tool_call_id=tool_call["id"]))
        
    return {"messages": results}


# 4. Conditional Edge: Agent Router quyết định đi đâu tiếp
def leader_router(state: ClawFlowState):
    last = state["messages"][-1]
    
    # Nếu Leader gọi bất kỳ Tool nào (kể cả tool Tìm kiếm hay tool Bàn giao)
    if last.tool_calls:
        return "tools"
        
    # Trả lời bình thường → Kết thúc
    return END

def content_router(state: ClawFlowState):
    last = state["messages"][-1]
    if last.tool_calls:
        return "tools"
    return END

def tools_router(state: ClawFlowState):
    last = state["messages"][-1]
    # Kiểm tra xem Tool cuối cùng vừa chạy có phải là tool "Bàn giao" không
    if "ĐÃ CHUYỂN GIAO CHO CONTENT AGENT" in str(last.content):
        return "content_agent"
    
    # Các tool bình thường (tìm mạng, lấy link) thì quay về Leader
    return "leader_agent"

# 5. Xây dựng Graph
graph = StateGraph(ClawFlowState)
graph.add_node("leader_agent", leader_agent_node)
graph.add_node("content_agent", content_agent_node)
graph.add_node("tools", tools_node)

# Vẽ đường đi ban đầu
graph.add_edge(START, "leader_agent")

graph.add_conditional_edges("leader_agent", leader_router, 
    {"tools": "tools",
    END: END})
graph.add_conditional_edges("content_agent", content_router, 
    {"tools": "tools",
    END: END})

# Công tắc thông minh sau khi Tool chạy xong
graph.add_conditional_edges(
    "tools", 
    tools_router,
    {
        "content_agent": "content_agent",
        "leader_agent": "leader_agent"
    }
)

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
