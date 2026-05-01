"""Tool gửi / reply email qua Gmail API."""
from __future__ import annotations

from typing import Annotated

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolArg, tool

import urllib.request
import urllib.error
import json
import base64
import email.utils


@tool
def send_gmail_tool(
    to: str,
    subject: str,
    body: str,
    reply_to_message_id: str = "",
    config: Annotated[RunnableConfig, InjectedToolArg] = None,
) -> str:
    """Gửi email hoặc reply email qua Gmail API.

    Args:
        to: Địa chỉ email người nhận.
        subject: Tiêu đề email.
        body: Nội dung email (plain text).
        reply_to_message_id: (Tùy chọn) Message-ID gốc nếu đây là reply.
    """
    cfg = config or {}
    integrations = (cfg.get("configurable") or {}).get("integrations") or {}
    gmail_conn = integrations.get("gmail") or {}

    if not gmail_conn.get("connected"):
        return "⚠️ Gmail chưa được kết nối. Vui lòng kết nối trong Cài đặt → Integrations."

    access_token = gmail_conn.get("access_token")
    if not access_token:
        return "⚠️ Token Gmail không hợp lệ. Vui lòng kết nối lại Gmail."

    if not to:
        return "❌ Thiếu địa chỉ email người nhận."

    # Xây dựng raw email theo RFC 2822
    headers = [
        f"To: {to}",
        f"Subject: =?utf-8?B?{base64.b64encode(subject.encode('utf-8')).decode()}?=",
        'Content-Type: text/plain; charset="UTF-8"',
        "MIME-Version: 1.0",
    ]

    if reply_to_message_id:
        headers.append(f"In-Reply-To: {reply_to_message_id}")
        headers.append(f"References: {reply_to_message_id}")

    raw_email = "\r\n".join(headers) + "\r\n\r\n" + body
    encoded = (
        base64.urlsafe_b64encode(raw_email.encode("utf-8"))
        .decode("ascii")
        .rstrip("=")
    )

    try:
        url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
        data = json.dumps({"raw": encoded}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())

        return f"✅ Đã gửi email thành công tới **{to}** (Message ID: {result.get('id', 'N/A')})"

    except urllib.error.HTTPError as e:
        body_err = ""
        try:
            body_err = e.read().decode()
        except Exception:
            pass
        if e.code == 401:
            return "❌ Token Gmail hết hạn. Vui lòng kết nối lại Gmail trong Cài đặt."
        return f"❌ Lỗi gửi email: HTTP {e.code} - {body_err[:200]}"
    except Exception as e:
        return f"❌ Lỗi gửi email: {str(e)}"
