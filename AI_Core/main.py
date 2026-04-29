import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

_APP_ROOT = Path(__file__).resolve().parent

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def _load_env_layers() -> None:
    """Luôn đọc `.env` cạnh `main.py` (AI_Core), kể cả cwd khác; không ghi đè biến đã có giá trị."""
    load_dotenv(_APP_ROOT / ".env", override=False)
    load_dotenv(override=False)


def _backfill_tracing_from_app_dotenv() -> None:
    """Docker/Compose có thể inject `LANGSMITH_API_KEY=` rỗng từ mẫu — khi đó load_dotenv không ghi đè; đọc file và lấp chỗ trống."""
    path = _APP_ROOT / ".env"
    if not path.is_file():
        return
    try:
        from dotenv import dotenv_values
    except ImportError:
        return
    vals = dotenv_values(path) or {}
    for name in (
        "LANGSMITH_API_KEY",
        "LANGCHAIN_API_KEY",
        "LANGSMITH_PROJECT",
        "LANGCHAIN_PROJECT",
        "LANGSMITH_ENDPOINT",
        "LANGCHAIN_ENDPOINT",
        "LANGSMITH_WORKSPACE_ID",
        "LANGCHAIN_WORKSPACE_ID",
    ):
        cur = (os.environ.get(name) or "").strip()
        if cur:
            continue
        v = (vals.get(name) or "").strip()
        if v:
            os.environ[name] = v


def _normalize_tracing_secret(value: str) -> str:
    """Chuẩn hóa API key / secret từ .env: BOM, ngoặc, xuống dòng thừa."""
    s = (value or "").strip().strip('"').strip("'")
    if s.startswith("\ufeff"):
        s = s[1:].strip()
    return s.replace("\n", "").replace("\r", "").strip()


def _sanitize_langsmith_workspace_env() -> None:
    """WORKSPACE_ID sai (vd. nhầm project id / trace id) thường gây 403 Forbidden trên ingest."""
    for var in ("LANGSMITH_WORKSPACE_ID", "LANGCHAIN_WORKSPACE_ID"):
        raw = _normalize_tracing_secret(os.environ.get(var) or "")
        if not raw:
            os.environ.pop(var, None)
            continue
        try:
            uuid.UUID(raw)
        except ValueError:
            print(
                f"[LangSmith] Cảnh báo: {var} không phải UUID workspace hợp lệ — đã gỡ để tránh 403.",
                flush=True,
            )
            os.environ.pop(var, None)
        else:
            os.environ[var] = raw


def _clear_langsmith_utils_caches() -> None:
    """get_env_var / get_tracer_project trong langsmith.utils dùng lru_cache — lần đọc ENDPOINT
    trước khi .env được áp dụng sẽ khóa URL mặc định US, ingest vẫn POST api.smith (403 với key EU)."""
    try:
        import langsmith.utils as ls_utils

        for attr in ("get_env_var", "get_tracer_project", "get_api_key"):
            fn = getattr(ls_utils, attr, None)
            if callable(fn) and hasattr(fn, "cache_clear"):
                fn.cache_clear()
    except Exception:
        pass


def _bootstrap_langsmith() -> None:
    """Đồng bộ biến LangChain/LangSmith; gửi trace đồng bộ trước khi HTTP trả (FastAPI)."""
    _sanitize_langsmith_workspace_env()

    smith_key = _normalize_tracing_secret(os.environ.get("LANGSMITH_API_KEY") or "")
    chain_key = _normalize_tracing_secret(os.environ.get("LANGCHAIN_API_KEY") or "")
    key = smith_key or chain_key
    if not key:
        print(
            "[LangSmith] Thiếu LANGSMITH_API_KEY / LANGCHAIN_API_KEY — không gửi trace. "
            "Đặt key trong Backend/.env (Docker) hoặc AI_Core/.env; xóa dòng LANGSMITH_API_KEY= rỗng nếu có.",
            flush=True,
        )
        return
    os.environ["LANGSMITH_API_KEY"] = key
    os.environ["LANGCHAIN_API_KEY"] = key

    off = ("false", "0", "no", "off")
    if (os.environ.get("LANGSMITH_TRACING") or "").strip().lower() in off:
        print("[LangSmith] LANGSMITH_TRACING=tắt — bỏ qua.", flush=True)
        return
    if (os.environ.get("LANGCHAIN_TRACING_V2") or "").strip().lower() in off:
        print("[LangSmith] LANGCHAIN_TRACING_V2=tắt — bỏ qua.", flush=True)
        return

    os.environ.setdefault("LANGSMITH_TRACING", "true")
    os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
    os.environ.setdefault("LANGCHAIN_CALLBACKS_BACKGROUND", "false")

    proj = (
        (os.environ.get("LANGSMITH_PROJECT") or "").strip()
        or (os.environ.get("LANGCHAIN_PROJECT") or "").strip()
    )
    if proj:
        os.environ.setdefault("LANGSMITH_PROJECT", proj)
        os.environ.setdefault("LANGCHAIN_PROJECT", proj)

    # Ưu tiên LANGSMITH_ENDPOINT rồi LANGCHAIN_ENDPOINT; luôn ghi đè cả hai cho trùng nhau.
    _ep_raw = (
        (os.environ.get("LANGSMITH_ENDPOINT") or "").strip()
        or (os.environ.get("LANGCHAIN_ENDPOINT") or "").strip()
    )
    if _ep_raw:
        _ep = _ep_raw.rstrip("/")
        os.environ["LANGSMITH_ENDPOINT"] = _ep
        os.environ["LANGCHAIN_ENDPOINT"] = _ep
    else:
        print(
            "[LangSmith] Cảnh báo: không thấy LANGSMITH_ENDPOINT hay LANGCHAIN_ENDPOINT trong môi trường — "
            "SDK sẽ dùng máy chủ US (api.smith.langchain.com). Org trên eu.smith.langchain.com cần: "
            "LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com (và cùng URL cho LANGCHAIN_ENDPOINT) "
            "trong Backend/.env rồi restart ai_core.",
            flush=True,
        )

    _proj = (
        os.environ.get("LANGSMITH_PROJECT")
        or os.environ.get("LANGCHAIN_PROJECT")
        or "default"
    )
    os.environ["LANGSMITH_PROJECT"] = _proj
    os.environ["LANGCHAIN_PROJECT"] = _proj

    _clear_langsmith_utils_caches()

    _cb = os.environ.get("LANGCHAIN_CALLBACKS_BACKGROUND", "false")
    _ep_log = (
        os.environ.get("LANGCHAIN_ENDPOINT")
        or os.environ.get("LANGSMITH_ENDPOINT")
        or "(mặc định US)"
    )
    print(
        f"[LangSmith] Tracing bật · project={_proj} · endpoint={_ep_log} · LANGCHAIN_CALLBACKS_BACKGROUND={_cb}",
        flush=True,
    )


_load_env_layers()
_backfill_tracing_from_app_dotenv()
_bootstrap_langsmith()

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
