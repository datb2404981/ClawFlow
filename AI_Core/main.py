import os
import sys
import uuid
import logging
from pathlib import Path

from dotenv import load_dotenv

_APP_ROOT = Path(__file__).resolve().parent

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def _load_env_layers() -> None:
    """Luôn đọc `.env` cạnh `main.py` (AI_Core), kể cả cwd khác; không ghi đè biến đã có giá trị."""
    load_dotenv(_APP_ROOT / ".env", override=False)
    load_dotenv(override=False)

def _disable_langsmith_tracing() -> None:
    # Đã loại bỏ toàn bộ logic LangSmith để không gửi trace và không log lỗi 403 nữa.
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="ClawFlow AI Core",
    description="Lõi AI xử lý đa phương thức và agent cho dự án ClawFlow",
    version="1.0.0",
)

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    # Hiện tại cho phép tất cả, khi deploy thì đổi lại IP của Backend
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Móc API Chat từ file chat.py vào Server chính
from Api.chat import router as chat_router

app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])

# Móc API Refine System Prompt từ file refine_system_prompt.py vào Server chính
from Api.refine_system_prompt import router as refine_system_prompt_router

app.include_router(
    refine_system_prompt_router, prefix="/api/v1", tags=["Refine System Prompt"]
)

# Móc API Skill Router
from Api.route_skills import router as route_skills_router

app.include_router(route_skills_router, prefix="/api/v1", tags=["Skill Router"])


def _langsmith_public_status() -> dict:
    """Trạng thái để debug UI/ops — không trả API key."""
    key = (
        (os.environ.get("LANGSMITH_API_KEY") or "").strip()
        or (os.environ.get("LANGCHAIN_API_KEY") or "").strip()
    )
    if not key:
        return {
            "tracing_ready": False,
            "reason": "missing_api_key",
            "hint": "Đặt LANGSMITH_API_KEY trong Backend/.env hoặc AI_Core/.env; xóa dòng key rỗng nếu có.",
        }
    off = ("false", "0", "no", "off")
    sm_off = (os.environ.get("LANGSMITH_TRACING") or "").strip().lower() in off
    lc_off = (os.environ.get("LANGCHAIN_TRACING_V2") or "").strip().lower() in off
    if sm_off or lc_off:
        return {
            "tracing_ready": False,
            "reason": "tracing_disabled_by_env",
            "LANGSMITH_TRACING": os.environ.get("LANGSMITH_TRACING"),
            "LANGCHAIN_TRACING_V2": os.environ.get("LANGCHAIN_TRACING_V2"),
        }
    ws = (os.environ.get("LANGSMITH_WORKSPACE_ID") or os.environ.get("LANGCHAIN_WORKSPACE_ID") or "").strip()
    return {
        "tracing_ready": True,
        "project": os.environ.get("LANGSMITH_PROJECT")
        or os.environ.get("LANGCHAIN_PROJECT")
        or "default",
        "endpoint": os.environ.get("LANGSMITH_ENDPOINT")
        or os.environ.get("LANGCHAIN_ENDPOINT")
        or "https://api.smith.langchain.com (mặc định)",
        "callbacks_background": os.environ.get(
            "LANGCHAIN_CALLBACKS_BACKGROUND", "false"
        ),
        "workspace_id_configured": bool(ws),
    }


@app.get("/")
async def health_check():
    return {
        "status": "success",
        "message": "ClawFlow AI Core đang hoạt động tốt!",
        "langsmith": _langsmith_public_status(),
    }


if __name__ == "__main__":
    post = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    # Trong Docker: tắt reload tránh subprocess reloader lệch env / trace (UVICORN_RELOAD=false).
    reload = (os.getenv("UVICORN_RELOAD", "true").strip().lower() not in ("0", "false", "no", "off"))
    print(f"🚀 Server đang khởi chạy tại: http://{host}:{post} (reload={reload})", flush=True)
    uvicorn.run("main:app", host=host, port=post, reload=reload)
