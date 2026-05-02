import json
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

# Đường dẫn Import gốc từ thư mục AI_Core
from Api.schemas.chat_schema import ChatRequest, ChatResponse
from graph import run_graph, run_graph_stream

# Để tách file API riêng, FastAPI cung cấp thư viện APIRouter
router = APIRouter()
_DEBUG_LOG_PATH = "/Users/macos/Document/Project/ClawFlow/.cursor/debug-de0ba6.log"


def _debug_log(run_id: str, hypothesis_id: str, location: str, message: str, data: dict) -> None:
    try:
        payload = {
            "sessionId": "de0ba6",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    try:
        # Ở đây ta quy định session_id của Frontend truyền lên chính là thread_id của LangGraph
        result = await run_graph(
            query=req.message, 
            user_id=req.user_id,
            thread_id=req.session_id,
            integrations=req.integrations,
            task_status=req.task_status or "running",
            draft_payload=req.draft_payload or "",
            system_context=req.system_context
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
        # region agent log
        _debug_log(
            run_id=f"chat_stream:{req.session_id}",
            hypothesis_id="H6",
            location="AI_Core/Api/chat.py:73",
            message="chat_stream_entry",
            data={"has_integrations": bool(req.integrations), "message_len": len(req.message or "")},
        )
        # endregion
        try:
            async for piece in run_graph_stream(
                query=req.message,
                user_id=req.user_id,
                thread_id=req.session_id,
                integrations=req.integrations,
                task_status=req.task_status or "running",
                draft_payload=req.draft_payload or "",
                system_context=req.system_context,
            ):
                if not piece:
                    continue
                # region agent log
                if isinstance(piece, dict):
                    chunk = str(piece.get("chunk") or "")
                    if "PASS" in chunk or "FAIL" in chunk or "Lý do:" in chunk or "Gợi ý:" in chunk:
                        _debug_log(
                            run_id=f"chat_stream:{req.session_id}",
                            hypothesis_id="H7",
                            location="AI_Core/Api/chat.py:89",
                            message="piece_contains_reviewer_markers",
                            data={
                                "type": str(piece.get("type") or ""),
                                "node": str(piece.get("node") or ""),
                                "chunk_preview": chunk[:220],
                            },
                        )
                # endregion
                if isinstance(piece, dict):
                    yield _sse_line(piece)
                elif isinstance(piece, str) and piece:
                    yield _sse_line({"type": "chunk", "chunk": piece})
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

