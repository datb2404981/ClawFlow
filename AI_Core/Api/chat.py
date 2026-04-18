from fastapi import APIRouter, HTTPException
from datetime import datetime

# Đường dẫn Import gốc từ thư mục AI_Core
from Api.schemas.chat_schema import ChatRequest, ChatResponse
from graph import run_graph

# Để tách file API riêng, FastAPI cung cấp thư viện APIRouter
router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    try:
        result = await run_graph(req.message, user_id=req.session_id)
        
        return ChatResponse(
            status="success",
            reply=result, 
            error=None,
            agent_used=["leader_agent (LangGraph)"]
        )

    except Exception as e:
        import traceback
        traceback.print_exc() # In lỗi chi tiết ra Terminal cho dân Dev dễ đọc
        
        # Trả về mã lỗi 500 và gói nó vào Response Schema mà ta đã định nghĩa
        return ChatResponse(
            status="error",
            reply=None,
            error=f"Lỗi AI Core: {str(e)}",
            agent_used=None
        )

