from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import json
from langchain_core.messages import HumanMessage

# Đường dẫn Import gốc từ thư mục AI_Core
from Api.schemas.chat_schema import ChatRequest, ChatResponse
from graph import run_graph, app_api

# Để tách file API riêng, FastAPI cung cấp thư viện APIRouter
router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    try:
        result = await run_graph(
            query=req.message, 
            user_id=req.user_id,
            thread_id=req.session_id
        )
        return ChatResponse(status="success", reply=result, error=None, agent_used=["leader_agent"])
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ChatResponse(status="error", reply=None, error=f"Lỗi AI Core: {str(e)}", agent_used=None)

@router.post("/stream_chat")
async def stream_chat_with_ai(req: ChatRequest):
    """
    Endpoint phát luồng (Stream) dữ liệu theo chuẩn SSE.
    Sẽ báo cáo trạng thái của các Agent đang chạy, và kết thúc bằng kết quả.
    """
    async def event_generator():
        config = {"configurable": {"thread_id": req.session_id, "user_id": req.user_id}}
        payload = {"messages": [HumanMessage(content=req.message)]}
        
        try:
            async for output in app_api.astream(payload, config, stream_mode="updates"):
                for node_name, state_delta in output.items():
                    status_msg = f"Đang chạy qua node: {node_name}"
                    if node_name == "leader_agent":
                        status_msg = "Giám đốc AI đang suy nghĩ..."
                    elif node_name == "tools":
                        status_msg = "Đang tra cứu công cụ..."
                    elif node_name == "content_agent":
                        status_msg = "Đang hành văn soạn thảo..."
                    elif node_name == "reviewer":
                        status_msg = "Đang kiểm duyệt lại chất lượng..."
                    
                    # Phát event status
                    yield f"data: {json.dumps({'type': 'status', 'content': status_msg})}\n\n"
            
            # Kết thúc luồng, trả về text cuối cùng
            final_state = await app_api.aget_state(config)
            final_msg = final_state.values["messages"][-1].content
            yield f"data: {json.dumps({'type': 'done', 'content': final_msg})}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

