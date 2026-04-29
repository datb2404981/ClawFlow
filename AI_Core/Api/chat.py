import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

# Đường dẫn Import gốc từ thư mục AI_Core
from Api.schemas.chat_schema import ChatRequest, ChatResponse
from graph import run_graph, run_graph_stream

# Để tách file API riêng, FastAPI cung cấp thư viện APIRouter
router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    try:
        # Ở đây ta quy định session_id của Frontend truyền lên chính là thread_id của LangGraph
        result = await run_graph(
            query=req.message, 
            user_id=req.user_id,
            thread_id=req.session_id
        )
        
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


def _sse_line(obj: dict) -> bytes:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode("utf-8")


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """SSE: mỗi dòng `data: {"chunk":"..."}`; cuối `data: {"done":true}` hoặc `{"error":"..."}`."""

    async def event_gen():
        try:
            async for piece in run_graph_stream(
                query=req.message,
                user_id=req.user_id,
                thread_id=req.session_id,
            ):
                if piece:
                    yield _sse_line({"chunk": piece})
            yield _sse_line({"done": True})
        except Exception as e:
            import traceback

            traceback.print_exc()
            yield _sse_line({"error": str(e)})

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

