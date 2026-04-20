import os

import certifi
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from pymongo import MongoClient

load_dotenv()

client = MongoClient(
    os.getenv("MONGO_URI"),
    tlsCAFile=certifi.where(),
    retryWrites=True,
    retryReads=True,
    serverSelectionTimeoutMS=20000,
)


def _get_ids(config: RunnableConfig) -> tuple[str | None, str | None]:
    """Bóc user_id & thread_id từ config.configurable do graph nạp vào."""
    cfg = (config or {}).get("configurable", {}) or {}
    return cfg.get("user_id"), cfg.get("thread_id")


@tool
def Get_Core_Profile(config: RunnableConfig) -> str:
    """Lấy hồ sơ GỐC của người dùng hiện tại (tự động xác định theo phiên).
    - Cung cấp: Tên, email, vai trò (role), quyền hạn, gói dịch vụ.
    - LLM KHÔNG cần và KHÔNG được truyền user_id — hệ thống tự xử lý.
    """
    user_id, _ = _get_ids(config)
    if not user_id:
        return "Lỗi hệ thống: Không xác định được user_id trong phiên này."

    db = client["clawflaw_core_api"]
    profile = (
        db["users"].find_one({"user_id": user_id})
        or db["users"].find_one({"_id": user_id})
    )

    if not profile:
        return f"Không tìm thấy hồ sơ gốc cho user_id={user_id}. Có thể chưa đồng bộ Backend."

    profile.pop("_id", None)
    profile.pop("password", None)
    profile.pop("hashed_password", None)

    return f"HỒ SƠ TỪ BACKEND (user_id={user_id}): {str(profile)}"


@tool
def Save_Thread_Context(rule_or_skill: str, config: RunnableConfig) -> str:
    """Lưu cấu hình/kỹ năng/SOP/vai trò CHỈ áp dụng cho phòng chat hiện tại.
    - LLM chỉ cần truyền `rule_or_skill` (nội dung luật).
    - thread_id hệ thống tự xác định, KHÔNG cần truyền.
    Ví dụ: rule_or_skill = "Quy trình viết báo: B1 nghiên cứu; B2 outline; B3 viết; B4 SEO"
    """
    _, thread_id = _get_ids(config)
    if not thread_id:
        return "Lỗi hệ thống: Không xác định được thread_id hiện tại."

    db = client["clawflaw_ai_brain"]
    db["thread_contexts"].update_one(
        {"thread_id": thread_id},
        {"$addToSet": {"context_rules": rule_or_skill}},
        upsert=True,
    )
    return f"Đã lưu luật cho phòng chat [{thread_id}]: {rule_or_skill}"


@tool
def Get_Thread_Context(config: RunnableConfig) -> str:
    """Lấy toàn bộ thiết lập/luật/vai trò RIÊNG của phòng chat hiện tại.
    - LLM KHÔNG cần truyền thread_id — hệ thống tự lấy.
    """
    _, thread_id = _get_ids(config)
    if not thread_id:
        return "Lỗi hệ thống: Không xác định được thread_id hiện tại."

    db = client["clawflaw_ai_brain"]
    ctx = db["thread_contexts"].find_one({"thread_id": thread_id})

    if not ctx or not ctx.get("context_rules"):
        return f"Phòng chat [{thread_id}] đang dùng hình hài mặc định (chưa có thiết lập riêng)."

    rules = "\n- ".join(ctx["context_rules"])
    return f"THIẾT LẬP RIÊNG CỦA PHÒNG [{thread_id}]:\n- {rules}"


tool_memories = [Get_Core_Profile, Save_Thread_Context, Get_Thread_Context]
tool_by_name = {t.name: t for t in tool_memories}
