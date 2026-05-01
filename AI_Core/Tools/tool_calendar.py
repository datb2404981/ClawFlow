"""Tool tạo sự kiện Google Calendar."""
from __future__ import annotations

from typing import Annotated

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolArg, tool

import urllib.request
import urllib.error
import json
from datetime import datetime


def _parse_datetime(dt_str: str) -> str:
    """Parse datetime string linh hoạt → ISO 8601."""
    dt_str = dt_str.strip()

    # Đã là ISO 8601 rồi
    if "T" in dt_str and ("+" in dt_str or "Z" in dt_str):
        return dt_str

    # Thử parse vài format phổ biến
    for fmt in [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y %H:%M:%S",
    ]:
        try:
            dt = datetime.strptime(dt_str, fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%S+07:00")
        except ValueError:
            continue

    # Fallback: trả nguyên
    return dt_str


@tool
def create_calendar_event_tool(
    summary: str,
    start_time: str,
    end_time: str,
    description: str = "",
    location: str = "",
    config: Annotated[RunnableConfig, InjectedToolArg] = None,
) -> str:
    """Tạo sự kiện trên Google Calendar.

    Args:
        summary: Tên/tiêu đề sự kiện.
        start_time: Thời gian bắt đầu (ISO 8601 hoặc dd/MM/yyyy HH:mm).
        end_time: Thời gian kết thúc (ISO 8601 hoặc dd/MM/yyyy HH:mm).
        description: (Tùy chọn) Mô tả chi tiết sự kiện.
        location: (Tùy chọn) Địa điểm sự kiện.
    """
    cfg = config or {}
    integrations = (cfg.get("configurable") or {}).get("integrations") or {}
    calendar_conn = integrations.get("google_calendar") or {}

    if not calendar_conn.get("connected"):
        return (
            "⚠️ Google Calendar chưa được kết nối. "
            "Vui lòng kết nối trong **Cài đặt → Integrations**."
        )

    access_token = calendar_conn.get("access_token")
    if not access_token:
        return "⚠️ Token Calendar không hợp lệ. Vui lòng kết nối lại."

    if not summary or not start_time or not end_time:
        return "❌ Thiếu thông tin sự kiện (tên, thời gian bắt đầu, thời gian kết thúc)."

    event = {
        "summary": summary,
        "start": {"dateTime": _parse_datetime(start_time)},
        "end": {"dateTime": _parse_datetime(end_time)},
    }
    if description:
        event["description"] = description
    if location:
        event["location"] = location

    try:
        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        data = json.dumps(event).encode("utf-8")
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

        link = result.get("htmlLink", "")
        return (
            f"✅ Đã tạo sự kiện **{summary}** thành công!\n"
            f"📅 Thời gian: {start_time} → {end_time}\n"
            f"🔗 [Xem trên Calendar]({link})"
        )

    except urllib.error.HTTPError as e:
        body_err = ""
        try:
            body_err = e.read().decode()
        except Exception:
            pass
        if e.code == 401:
            return "❌ Token Calendar hết hạn. Vui lòng kết nối lại trong Cài đặt."
        return f"❌ Lỗi tạo sự kiện: HTTP {e.code} - {body_err[:200]}"
    except Exception as e:
        return f"❌ Lỗi tạo sự kiện Calendar: {str(e)}"
