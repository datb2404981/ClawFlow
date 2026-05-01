from typing import Annotated
from langchain_core.tools import tool, InjectedToolArg
from langchain_core.runnables import RunnableConfig
import urllib.request
import urllib.error
import urllib.parse
import json
import base64
import re


def _clean_text(raw: str) -> str:
    import html
    text = html.unescape(raw)
    # Giữ lại các thẻ xuống dòng phổ biến trước khi xóa HTML
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p>", "\n\n", text)
    text = re.sub(r"(?i)</div>", "\n", text)
    # Xóa toàn bộ HTML tags còn lại
    text = re.sub(r"<[^>]+>", "", text)
    # Chuẩn hóa khoảng trắng ngang (không ảnh hưởng tới \n)
    text = re.sub(r"[ \t]+", " ", text)
    # Giới hạn số dòng trống liên tiếp
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _decode_body(payload: dict) -> str:
    """Trích xuất nội dung text từ payload Gmail (hỗ trợ multipart)."""
    # Trường hợp 1: body nằm trực tiếp trong payload
    body_data = payload.get("body", {}).get("data")
    if body_data:
        try:
            decoded = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
            return _clean_text(decoded)
        except Exception:
            pass

    # Trường hợp 2: multipart → tìm phần text/plain hoặc text/html
    parts = payload.get("parts", [])
    text_body = ""
    html_body = ""

    for part in parts:
        mime = part.get("mimeType", "")
        part_data = part.get("body", {}).get("data")

        if mime == "text/plain" and part_data:
            try:
                decoded = base64.urlsafe_b64decode(part_data).decode("utf-8", errors="replace")
                text_body = _clean_text(decoded)
            except Exception:
                pass
        elif mime == "text/html" and part_data:
            try:
                raw_html = base64.urlsafe_b64decode(part_data).decode("utf-8", errors="replace")
                html_body = _clean_text(raw_html)
            except Exception:
                pass
        elif "multipart" in mime:
            # Đệ quy cho multipart lồng
            nested = _decode_body(part)
            if nested:
                return nested

    return text_body or html_body


@tool
def read_gmail_tool(
    query: str = "",
    max_results: int = 5,
    config: Annotated[RunnableConfig, InjectedToolArg] = None,
) -> str:
    """Đọc email từ tài khoản Gmail của người dùng.
    Hữu ích khi người dùng yêu cầu kiểm tra thư mới, đọc email từ ai đó hoặc tìm kiếm email.
    Args:
        query: Chuỗi tìm kiếm Gmail (vd: 'is:unread', 'from:sếp', 'subject:họp'). Mặc định để trống để lấy thư mới nhất.
        max_results: Số lượng email tối đa cần lấy. Mặc định là 5.
    """
    cfg = config or {}
    integrations = (cfg.get("configurable") or {}).get("integrations") or {}
    gmail_conn = integrations.get("gmail") or {}

    # Kiểm tra kết nối
    if not gmail_conn.get("connected"):
        return (
            "⚠️ Gmail chưa được kết nối. Anh vui lòng vào **Cài đặt → Integrations** "
            "và nhấn **Connect** bên cạnh Gmail để uỷ quyền truy cập nhé."
        )

    access_token = gmail_conn.get("access_token")
    if not access_token:
        return (
            "⚠️ Gmail đã được kết nối nhưng chưa có token hợp lệ. "
            "Anh vui lòng vào **Cài đặt → Integrations**, ngắt kết nối Gmail và kết nối lại để làm mới token."
        )

    try:
        url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults={max_results}"
        if query:
            url += f"&q={urllib.parse.quote(query)}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())

        messages = data.get("messages", [])
        if not messages:
            return f"Không tìm thấy email nào khớp với tìm kiếm '{query}'."

        result = []
        for msg in messages:
            msg_id = msg["id"]
            # format=full để lấy toàn bộ nội dung email (không chỉ metadata)
            detail_url = (
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}"
                "?format=full"
            )
            detail_req = urllib.request.Request(
                detail_url, headers={"Authorization": f"Bearer {access_token}"}
            )
            try:
                with urllib.request.urlopen(detail_req) as detail_res:
                    detail_data = json.loads(detail_res.read().decode())
                headers = detail_data.get("payload", {}).get("headers", [])
                subject = next((h["value"] for h in headers if h["name"] == "Subject"), "(Không chủ đề)")
                sender = next((h["value"] for h in headers if h["name"] == "From"), "(Không rõ)")
                date = next((h["value"] for h in headers if h["name"] == "Date"), "(Không rõ ngày)")
                
                # Lấy nội dung đầy đủ email thay vì chỉ snippet
                body = _decode_body(detail_data.get("payload", {}))
                # Giới hạn để tránh vượt token limit
                if len(body) > 1500:
                    body = body[:1500] + "... (nội dung bị cắt do quá dài)"
                
                if not body:
                    body = detail_data.get("snippet", "(Không có nội dung)")
                
                # Format blockquote for body
                blockquote_body = "\n".join([f"> {line}" for line in body.split("\n")])
                
                result.append(
                    f"### 📧 Thư số {len(result)+1}: {subject}\n"
                    f"- **👤 Từ:** `{sender}`\n"
                    f"- **📅 Ngày:** `{date}`\n\n"
                    f"**📝 Nội dung:**\n\n"
                    f"{blockquote_body}\n\n"
                    f"---\n"
                )
            except Exception as e:
                result.append(f"Lỗi khi đọc chi tiết email {msg_id}: {str(e)}")

        return "\n".join(result)

    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode()
        except Exception:
            pass
        if e.code == 401:
            return (
                "❌ Token Gmail đã hết hạn (401 Unauthorized). "
                "Anh vào **Cài đặt → Integrations**, ngắt kết nối và kết nối lại Gmail để làm mới token nhé."
            )
        return f"Lỗi HTTP khi gọi Google Gmail API: {e.code} - {e.reason}. Chi tiết: {body}"
    except Exception as e:
        return f"Lỗi khi gọi Google Gmail API: {str(e)}"
