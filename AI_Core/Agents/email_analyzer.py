"""Email Analyzer — Sử dụng Pydantic Structured Output để ép JSON chuẩn 100%.

Thay vì dùng System Prompt "năn nỉ" AI xuất JSON (hay hỏng hay thiếu),
dùng `with_structured_output(PydanticModel)` để LangChain + Gemini
BẮT BUỘC trả về đúng schema, không bao giờ sai format.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# ━━━ Timezone Việt Nam ━━━
_VN_TZ = timezone(timedelta(hours=7))

# ━━━ Model configuration (GA stable) ━━━
GEMINI_MODEL_EMAIL_ANALYZER = "gemini-3.1-flash-lite-preview"


# ═══════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS — "Khuôn đúc" cho AI, không thể sai format
# ═══════════════════════════════════════════════════════════

class EmailActionPayload(BaseModel):
    """Payload chung cho mọi loại action."""
    # Dùng cho reply_email
    to: Optional[str] = Field(default=None, description="Địa chỉ email người nhận (chỉ phần email, bỏ tên hiển thị)")
    subject: Optional[str] = Field(default=None, description="Tiêu đề email trả lời (bắt đầu bằng 'Re: ')")
    body: Optional[str] = Field(default=None, description="Nội dung email trả lời soạn sẵn, lịch sự, chuyên nghiệp, tiếng Việt. Ký tên cuối thư.")
    # Dùng cho create_calendar_event
    summary: Optional[str] = Field(default=None, description="Tên sự kiện Calendar")
    startTime: Optional[str] = Field(default=None, description="Thời gian bắt đầu (ISO 8601, timezone +07:00)")
    endTime: Optional[str] = Field(default=None, description="Thời gian kết thúc (ISO 8601, timezone +07:00)")
    description: Optional[str] = Field(default=None, description="Mô tả sự kiện")


class EmailAction(BaseModel):
    """Một đề xuất hành động cho một email cụ thể."""
    email_index: int = Field(description="Index của email mà action này liên quan đến (bắt đầu từ 1)")
    type: Literal["reply_email", "create_calendar_event"] = Field(
        description=(
            "BẮT BUỘC chọn: 'reply_email' (nếu là mail công việc/cá nhân từ người thật) "
            "HOẶC 'create_calendar_event' (nếu là thư thông báo/newsletter/hệ thống)."
        )
    )
    label: str = Field(description="Mô tả ngắn gọn hành động, ví dụ: 'Trả lời mail từ Nguyễn Văn A'")
    payload: EmailActionPayload = Field(description="Dữ liệu chi tiết cho hành động")


class EmailSummary(BaseModel):
    """Tóm tắt một email."""
    index: int = Field(description="Số thứ tự email (bắt đầu từ 1)")
    subject: str = Field(description="Chủ đề email")
    from_address: str = Field(
        alias="from",
        description="Địa chỉ email người gửi (chỉ phần email, bỏ tên hiển thị)"
    )
    priority: Literal["high", "normal"] = Field(
        description=(
            "high = mail công việc/cá nhân từ người thật (cần reply). "
            "normal = thư thông báo/newsletter/hệ thống (cần tạo calendar)."
        )
    )
    summary: str = Field(description="Tóm tắt nội dung email trong 1-2 câu, đi thẳng vào trọng tâm")

    class Config:
        populate_by_name = True


class EmailAnalysisResult(BaseModel):
    """Kết quả phân tích toàn bộ email — Schema chính."""
    summaries: List[EmailSummary] = Field(description="Danh sách tóm tắt từng email")
    actions: List[EmailAction] = Field(
        description=(
            "Danh sách đề xuất hành động. MỖI email PHẢI có ít nhất 1 action: "
            "mail công việc → reply_email, mail thông báo → create_calendar_event. "
            "CHỈ bỏ trống nếu email là spam hoàn toàn vô giá trị."
        )
    )


# ═══════════════════════════════════════════════════════════
# SYSTEM PROMPT — Hướng dẫn phân loại (kết hợp với Pydantic schema)
# ═══════════════════════════════════════════════════════════

SYSTEM_PROMPT_EMAIL_ANALYZER = """Bạn là một Trợ lý phân tích email thông minh. Nhiệm vụ của bạn:

1. **Tóm tắt nhanh** MỌI email (1-2 câu, đi thẳng vào trọng tâm).
2. **Phân loại** mỗi email và **tạo hành động tương ứng**.

NGÀY HIỆN TẠI: {current_date}

BẮT BUỘC TRẢ VỀ DUY NHẤT CHUỖI JSON. TUYỆT ĐỐI KHÔNG ĐƯỢC sinh ra bất kỳ văn bản diễn giải, chào hỏi hay giải thích nào bên ngoài khối JSON.

══════════════════════════════════════════════════════
QUY TẮC PHÂN LOẠI VÀ TẠO HÀNH ĐỘNG (BẮT BUỘC):
══════════════════════════════════════════════════════
Mỗi email đọc được, bạn phải phân loại vào 1 trong 2 nhóm:

1. Nhóm "Mail Công việc/Cá nhân" (Personal/Work Thread):
   - Dấu hiệu: Email từ người thật gửi (hỏi đáp, giao việc, xin lỗi, ứng tuyển...).
   - priority: "high"
   - Hành động: Tạo action type="reply_email". Soạn sẵn nội dung trả lời lịch sự, chuyên nghiệp, bằng tiếng Việt. Ký tên cuối thư.

2. Nhóm "Mail Thông báo" (Notification/System Mail):
   - Dấu hiệu: Thư tự động, bản tin, nhắc lịch hẹn, thông báo sự kiện.
   - priority: "normal"
   - Hành động: Tạo action type="create_calendar_event". Tự suy luận tiêu đề sự kiện và thời gian (ISO 8601, +07:00).

TUYỆT ĐỐI KHÔNG ĐƯỢC bỏ trống mảng actions trừ khi đó là spam hoàn toàn vô giá trị.

QUY TẮC BỔ SUNG:
- Trích xuất email người gửi: chỉ lấy phần email, bỏ tên hiển thị.
- Thời gian Calendar: ISO 8601 với timezone +07:00.
- Nội dung reply: lịch sự, chuyên nghiệp, tiếng Việt."""


def _extract_email_address(from_field: str) -> str:
    """Trích xuất email từ trường From: 'Tên <email@example.com>' → 'email@example.com'"""
    match = re.search(r'<([^>]+)>', from_field)
    if match:
        return match.group(1)
    # Trường hợp chỉ có email không có tên
    match = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', from_field)
    if match:
        return match.group(0)
    return from_field.strip()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def analyze_emails(raw_email_text: str, user_name: str = "") -> dict:
    """Phân tích email bằng Pydantic Structured Output.

    Dùng `with_structured_output` để ÉP Gemini trả về đúng schema,
    không bao giờ bị JSON sai format hay thiếu trường.

    Args:
        raw_email_text: Nội dung email thô từ read_gmail_tool
        user_name: Tên người dùng (để ký tên reply)

    Returns:
        dict với keys: summaries, actions
    """
    print("[email_analyzer] Đang phân tích email với Pydantic Structured Output...")
    current_date = datetime.now(_VN_TZ).strftime("%d/%m/%Y %H:%M")
    system_prompt = SYSTEM_PROMPT_EMAIL_ANALYZER.format(current_date=current_date)

    user_prompt = f"Phân tích các email sau:\n\n{raw_email_text}"
    if user_name:
        user_prompt += f"\n\nTên người dùng (để ký tên reply): {user_name}"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GENAI_API_KEY")

    # ━━━ BÍ KÍP SENIOR: with_structured_output ━━━
    # Thay vì "năn nỉ" AI xuất JSON rồi cầu trời parse được,
    # ta dùng Pydantic schema ép khuôn 100%. AI BẮT BUỘC trả đúng format.
    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL_EMAIL_ANALYZER,
        temperature=0.2,
        google_api_key=api_key,
    )
    structured_llm = llm.with_structured_output(EmailAnalysisResult)

    try:
        result: EmailAnalysisResult = await structured_llm.ainvoke(messages)
        print(f"[email_analyzer] ✅ Structured output: {len(result.summaries)} summaries, {len(result.actions)} actions")

        # Convert Pydantic model → dict (tương thích code cũ ở integration.py)
        return {
            "summaries": [
                {
                    "index": s.index,
                    "subject": s.subject,
                    "from": s.from_address,
                    "priority": s.priority,
                    "summary": s.summary,
                }
                for s in result.summaries
            ],
            "actions": [
                {
                    "email_index": a.email_index,
                    "type": a.type,
                    "label": a.label,
                    "payload": {
                        k: v for k, v in a.payload.model_dump().items() if v is not None
                    },
                }
                for a in result.actions
            ],
        }
    except Exception as e:
        print(f"[email_analyzer] ❌ Structured output failed: {str(e)}")
        # Nếu structured output cũng fail → trả fallback an toàn
        return {"summaries": [], "actions": [], "parse_error": True}
