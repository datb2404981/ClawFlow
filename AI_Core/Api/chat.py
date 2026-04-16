from fastapi import APIRouter, HTTPException
from datetime import datetime

# Đường dẫn Import gốc từ thư mục AI_Core
from Api.schemas.chat_schema import ChatRequest, ChatResponse
from Agents.leader_agent import leader_agent

# Để tách file API riêng, FastAPI cung cấp thư viện APIRouter
router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    try:
        # Gửi cái `req.message` (chuỗi text) cho leader đọc và chờ phản hồi
        result = leader_agent.invoke(req.message)
        
        # Trả về Response khi có kết quả từ AI
        return ChatResponse(
            status="success",
            reply=result.content,
            error=None,
            agent_used=["leader_agent"]
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

