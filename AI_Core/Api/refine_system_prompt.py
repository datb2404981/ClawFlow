from __future__ import annotations

from typing import Any

from Api.schemas.refine_system_prompt_schema import (
    RefineSystemPromptRequest,
    RefineSystemPromptResponse,
)
from fastapi import APIRouter, HTTPException
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from ollama_config import OLLAMA_BASE_URL

router = APIRouter()

# Một lần cho cả process (tương tự leader_agent.py)
_refine_model = init_chat_model(
    model="llama3.1",
    model_provider="ollama",
    base_url=OLLAMA_BASE_URL,
    temperature=0.7,
)

# Vai trò + quy tắc; input thô gửi riêng HumanMessage để tránh lặp placeholder gây lệch model
SYSTEM_REFINER = """Bạn là 'ClawFlow Refine System Prompt' — chuyên tối ưu system prompt cho ứng dụng.

Nhiệm vụ: đọc system prompt thô ở tin nhắn người dùng, rồi viết lại bản tối ưu: rõ ràng, cấu trúc, giữ mục tiêu nghiệp vụ, có thể thêm cấm/làm rõ biên, nhưng không bịa thông tin user chưa giao.

Nghiêm cấm:
- Không lặp nguyên văn cả prompt thô mà tự nhận là "đã tối ưu" nếu bản chưa thay đổi; phải thực sự chỉnh sửa/điều sửa theo tối ưu hóa.
- Không bao thêm câu chuyện, không giải thích từng bước, không mở bài/kết bài dài dòng ngoài nội dung system prompt.

Chỉ trả lại ĐÚNG MỘT khối văn bản — chính là system prompt sau tối ưu, thuần văn bản, không quấn thêm markdown mô tả bên ngoài (nếu prompt gốc cần markdown bên trong thì vẫn ghi trong bản tối ưu, nhưng không thêm mục "Kết quả" hay "Dưới đây là...")."""

REFINE_HUMAN_PREFIX = """
Dưới đây là INPUT (system prompt thô) cần bạn tối ưu. Toàn bộ nội dung giữa HAI dòng === là input, không tự tưởng tượng thêm.

===INPUT (system prompt thô)===
{raw}
===KẾT THÚC INPUT===

Trả lời duy nhất: nội dung system prompt sau khi tối ưu (một văn bản, không bao khác).
""".strip()


def _message_content_to_str(content: str | list[str] | list[Any] | None) -> str:
    """AIMessage / provider có thể trả content: str, hoặc list (tool/multimodal)."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out: list[str] = []
        for block in content:
            if isinstance(block, str):
                out.append(block)
            elif isinstance(block, dict):
                t = block.get("text")
                if isinstance(t, str):
                    out.append(t)
                elif t is not None:
                    out.append(str(t))
            else:
                out.append(str(block))
        return "\n".join(s.strip() for s in out if s)
    return str(content)


def _extract_text_from_result(msg: BaseMessage) -> str:
    if isinstance(msg, AIMessage):
        return _message_content_to_str(msg.content)
    c = getattr(msg, "content", None)
    if c is not None:
        return _message_content_to_str(c)
    return str(msg)


@router.post("/refine-system-prompt", response_model=RefineSystemPromptResponse)
async def refine_system_prompt(req: RefineSystemPromptRequest) -> RefineSystemPromptResponse:
    try:
        user_block = REFINE_HUMAN_PREFIX.format(raw=req.systemPromptOfUser.strip())
        out = await _refine_model.ainvoke(
            [
                SystemMessage(content=SYSTEM_REFINER),
                HumanMessage(content=user_block),
            ],
        )
        text = _extract_text_from_result(out).strip()
        return RefineSystemPromptResponse(
            message="Tối ưu hệ thống prompt thành công",
            data=text,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
