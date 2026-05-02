from __future__ import annotations

from typing import Any

from Api.schemas.refine_system_prompt_schema import (
    RefineSystemPromptRequest,
    RefineSystemPromptResponse,
)
from fastapi import APIRouter, HTTPException
from Utils.gemini_client import gemini_client

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





router = APIRouter()

@router.post("/refine-system-prompt", response_model=RefineSystemPromptResponse)
async def refine_system_prompt(req: RefineSystemPromptRequest) -> RefineSystemPromptResponse:
    try:
        user_block = REFINE_HUMAN_PREFIX.format(raw=req.systemPromptOfUser.strip())
        
        gemini_resp = await gemini_client.generate_content_async(
            model="gemini-3.1-flash-lite-preview",
            contents=[user_block],
            system_instruction=SYSTEM_REFINER,
            temperature=0.7
        )
        
        text = (gemini_resp.text or "").strip()
        
        return RefineSystemPromptResponse(
            message="Tối ưu hệ thống prompt thành công",
            data=text,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
