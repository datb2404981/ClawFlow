"""Email Analyzer — Sử dụng Google Gemini API để phân tích email.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone, timedelta

from langchain_core.messages import HumanMessage, SystemMessage


from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from Utils.gemini_client import gemini_client

# Lấy timezone Việt Nam
_VN_TZ = timezone(timedelta(hours=7))

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
)
async def _invoke_analyzer(messages, system_instruction):
    return await gemini_client.generate_content_async(
        model="gemini-3.1-flash-lite-preview",
        contents=messages,
        system_instruction=system_instruction,
        temperature=0.2
    )

SYSTEM_PROMPT_EMAIL_ANALYZER = """Bạn là một Trợ lý phân tích email thông minh. Nhiệm vụ của bạn:

1. **Tóm tắt nhanh** MỌI email (1-2 câu, đi thẳng vào trọng tâm).
2. **Phát hiện email "High Actionable"** — email cần hành động:
   - Có câu hỏi trực tiếp cần trả lời
   - Yêu cầu thực hiện gì đó (gửi báo cáo, xác nhận, phản hồi...)
   - Mời họp / sự kiện có ngày giờ cụ thể
   - Đánh dấu URGENT / HIGH PRIORITY
3. Với email High Actionable, **đề xuất hành động cụ thể**:
   - `reply_email`: Soạn nháp email trả lời (lịch sự, chuyên nghiệp, tiếng Việt)
   - `create_calendar_event`: Trích xuất thông tin sự kiện (tên, ngày giờ, địa điểm)

NGÀY HIỆN TẠI: {current_date}

BẮT BUỘC trả về JSON hợp lệ theo đúng format sau (KHÔNG kèm markdown code block):
{{
  "summaries": [
    {{
      "index": 1,
      "subject": "Chủ đề email",
      "from": "người gửi",
      "priority": "high" | "normal",
      "summary": "Tóm tắt 1-2 câu"
    }}
  ],
  "actions": [
    {{
      "email_index": 1,
      "type": "reply_email",
      "label": "Mô tả ngắn hành động",
      "payload": {{
        "to": "email_nguoi_gui@example.com",
        "subject": "Re: Chủ đề gốc",
        "body": "Nội dung email trả lời soạn sẵn"
      }}
    }},
    {{
      "email_index": 2,
      "type": "create_calendar_event",
      "label": "Mô tả ngắn sự kiện",
      "payload": {{
        "summary": "Tên sự kiện",
        "startTime": "2026-05-15T08:30:00+07:00",
        "endTime": "2026-05-15T11:30:00+07:00",
        "description": "Mô tả sự kiện"
      }}
    }}
  ]
}}

QUY TẮC:
- `actions` chỉ chứa email High Actionable. Email thông thường (quảng cáo, thông báo chung) KHÔNG tạo action.
- Nội dung reply phải lịch sự, chuyên nghiệp, tiếng Việt. Ký tên cuối thư.
- Trích xuất email người gửi từ trường "Từ" (chỉ lấy phần email, bỏ tên hiển thị).
- Thời gian sự kiện Calendar phải ở định dạng ISO 8601 với timezone +07:00.
- Nếu KHÔNG có email nào cần hành động, trả `"actions": []`.
- CHỈ trả JSON, KHÔNG kèm giải thích hay markdown."""


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
    """Phân tích email bằng Gemini Flash.

    Args:
        raw_email_text: Nội dung email thô từ read_gmail_tool
        user_name: Tên người dùng (để ký tên reply)

    Returns:
        dict với keys: summaries, actions, raw_response
    """
    # Logic gọi AI Gemini API của em nằm ở đây
    print("Đang phân tích email...")
    current_date = datetime.now(_VN_TZ).strftime("%d/%m/%Y %H:%M")
    system_prompt = SYSTEM_PROMPT_EMAIL_ANALYZER.format(current_date=current_date)

    user_prompt = f"Phân tích các email sau:\n\n{raw_email_text}"
    if user_name:
        user_prompt += f"\n\nTên người dùng (để ký tên reply): {user_name}"

    messages = [HumanMessage(content=user_prompt)]

    response = await _invoke_analyzer(messages, system_prompt)
    # Lấy content ra từ Gemini response
    raw = (response.text or "").strip()

    # Parse JSON từ response
    # Gemini có thể wrap trong ```json ... ```
    json_text = raw
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw, re.DOTALL)
    if json_match:
        json_text = json_match.group(1).strip()

    try:
        result = json.loads(json_text)
    except json.JSONDecodeError:
        print(f"[email_analyzer] JSON parse failed. Raw response:\n{raw[:500]}")
        result = {"summaries": [], "actions": [], "parse_error": True}

    result["raw_response"] = raw
    return result
