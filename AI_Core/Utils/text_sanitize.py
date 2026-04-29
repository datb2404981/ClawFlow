"""Chuẩn hoá text assistant (không phụ thuộc LangChain)."""
from __future__ import annotations

import re

# Model đôi khi gõ sai: <thoughtEm>, <Thought> — bắt mọi thẻ mở bắt đầu bằng "<thought"
_THOUGHT_FULL_RE = re.compile(
    r"<thought[^>]*>.*?</thought>", re.DOTALL | re.IGNORECASE
)
_THOUGHT_OPEN_ONLY_RE = re.compile(
    r"<thought[^>]*>.*", re.DOTALL | re.IGNORECASE
)

# Model/reviewer đôi khi dính PASS/FAIL ở cuối câu trả lời (vd "...tôi.PASS")
_TRAIL_PASS_RE = re.compile(r"\.PASS\s*$", re.IGNORECASE)
_TRAIL_FAIL_RE = re.compile(r"\.FAIL\s*$", re.IGNORECASE)
_TRAIL_WS_PASS_RE = re.compile(r"[\s\t]+PASS\s*$", re.IGNORECASE)
_TRAIL_WS_FAIL_RE = re.compile(r"[\s\t]+FAIL\s*$", re.IGNORECASE)
_TRAIL_NL_PASS_RE = re.compile(r"\n+\s*PASS\s*$", re.IGNORECASE)
_TRAIL_NL_FAIL_RE = re.compile(r"\n+\s*FAIL\s*$", re.IGNORECASE)


def _strip_trailing_review_echo(text: str) -> str:
    """Bỏ PASS/FAIL lặt vẹt ở cuối (echo từ luồng reviewer / model)."""
    t = (text or "").rstrip()
    if not t:
        return t
    for _ in range(4):
        before = t
        t = _TRAIL_PASS_RE.sub("", t)
        t = _TRAIL_FAIL_RE.sub("", t)
        t = _TRAIL_WS_PASS_RE.sub("", t)
        t = _TRAIL_WS_FAIL_RE.sub("", t)
        t = _TRAIL_NL_PASS_RE.sub("", t)
        t = _TRAIL_NL_FAIL_RE.sub("", t)
        t = t.rstrip()
        if t == before:
            break
    return t


def strip_thought(text: str) -> str:
    """Xoá mọi biến thể của khối <thought>.

    Xử lý 3 trường hợp:
    - <thought>...</thought>  (đầy đủ)
    - Thiếu </thought> ở cuối → xoá từ <thought> đến hết.
    - Thiếu <thought> đầu, chỉ có </thought> ở đâu đó → xoá mọi thứ đến hết </thought>.
    """
    if not text:
        return text

    cleaned = _THOUGHT_FULL_RE.sub("", text)

    if re.search(r"<thought", cleaned, re.IGNORECASE) and not re.search(
        r"</thought>", cleaned, re.IGNORECASE
    ):
        cleaned = _THOUGHT_OPEN_ONLY_RE.sub("", cleaned)

    # Còn sót kiểu <thoughtEm ... (thiếu `>` hoặc không khớp regex trên)
    while True:
        lower = cleaned.lower()
        idx = lower.find("<thought")
        if idx == -1:
            break
        end_tag = lower.find("</thought>", idx)
        if end_tag != -1:
            cleaned = (cleaned[:idx] + cleaned[end_tag + len("</thought>") :]).strip()
            continue
        chunk = cleaned[idx:]
        dbl = chunk.find("\n\n")
        if dbl != -1:
            cleaned = (cleaned[:idx] + chunk[dbl + 2 :]).lstrip()
            continue
        cleaned = cleaned[:idx].rstrip()
        break

    lower = cleaned.lower()
    close_idx = lower.rfind("</thought>")
    if close_idx != -1:
        cleaned = cleaned[close_idx + len("</thought>") :]

    return cleaned.strip()


def sanitize_assistant_text(text: str) -> str:
    """Chuẩn hoá nội dung hiển thị cho user: bỏ khối <thought> (và biến thể)."""
    return _strip_trailing_review_echo(strip_thought(text or "")).strip()
