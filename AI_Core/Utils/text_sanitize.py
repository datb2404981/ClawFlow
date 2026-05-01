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
_TRAIL_TOKEN_PASS_FAIL_RE = re.compile(
    r"(?<![A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9_])(PASS|FAIL)\s*$",
    re.IGNORECASE,
)
_FAIL_REASON_ANYWHERE_RE = re.compile(
    r"(^|[^A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9_])!?\s*FAIL\s*\n+\s*Lý do:[\s\S]*$",
    re.IGNORECASE,
)
_FAIL_REASON_ZH_ANYWHERE_RE = re.compile(
    r"(^|[^A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9_])!?\s*FAIL\s*\n*\s*理由\s*[：:\uFF1A][\s\S]*$",
    re.IGNORECASE,
)
_TRAIL_REVIEW_BLOCK_RE = re.compile(
    r"(?:^|\n)\s*(?:PASS|FAIL)\s*\n+\s*Câu trả lời đã đáp ứng yêu cầu của người dùng bằng cách:[\s\S]*$",
    re.IGNORECASE,
)
_REDACTED_REASONING_RE = re.compile(
    r"<redacted_reasoning>.*?</redacted_reasoning>", re.DOTALL | re.IGNORECASE
)
_THINKING_WRAP_RE = re.compile(
    r"<thinking>.*?</thinking>", re.DOTALL | re.IGNORECASE
)
# `</thought` thiếu `>` rồi dính chữ (vd `</thoughtChào`)
_THOUGHT_CLOSE_MALFORMED_RE = re.compile(
    r"</thought(?=[A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9\[])",
    re.IGNORECASE,
)


def _normalize_thought_tags(text: str) -> str:
    t = text or ""
    t = _THOUGHT_CLOSE_MALFORMED_RE.sub("</thought>\n\n", t)
    t = re.sub(r"</thought>\s*</thought>", "</thought>", t, flags=re.IGNORECASE)
    return t


def _strip_model_internal_blocks(text: str) -> str:
    """Bỏ khối reasoning nội bộ (thường tiếng Trung) trước khi strip <thought>."""
    t = text or ""
    t = _REDACTED_REASONING_RE.sub("", t)
    t = _THINKING_WRAP_RE.sub("", t)
    # Một số weight dùng thẻ think (backslash + think)
    _open = chr(92) + "<" + "think" + ">"
    _close = chr(92) + "<" + "/" + "think" + ">"
    t = re.sub(
        re.escape(_open) + r".*?" + re.escape(_close),
        "",
        t,
        flags=re.DOTALL | re.IGNORECASE,
    )
    return t


def _strip_reviewer_fail_rubric_echo(text: str) -> str:
    """Gỡ khối echo reviewer: FAIL + Lý do/Gợi ý (VI), FAIL/理由/建议 (ZH), !FAIL + Lý do.

    Dùng lookahead đoạn mở lượt trả lời lại (Em xin / Em sẽ / Dựa trên thông tin) để không
    cắt mất phần trả lời hợp lệ sau rubric; nếu không có thì cắt tới cuối chuỗi.
    """
    t = text or ""
    if not t:
        return t
    # Đoạn bắt đầu đoạn assistant “sửa lại” — tránh dừng sớm trong Gợi ý (thường không có các mẫu này).
    _retry = r"\n\n(?:Em xin|Em sẽ|Dựa trên thông tin)\b"
    # Dùng *? (non-greedy): nếu dùng * với (?=…|\Z) thì \Z khớp ở cuối chuỗi và nuốt cả đoạn retry.
    # (?:^|\n) — model đôi khi dán rubric đầu tin: "FAIL\n\nLý do:" không có \n phía trước FAIL
    _pat_vi_fail = re.compile(
        rf"(^|[^A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9_])!?\s*FAIL\s*\n+\s*Lý do:[\s\S]*?(?={_retry}|\Z)",
        re.IGNORECASE | re.DOTALL,
    )
    _pat_bang_fail = re.compile(
        rf"(^|[^A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9_])!FAIL\s*\n+\s*Lý do:[\s\S]*?(?={_retry}|\Z)",
        re.IGNORECASE | re.DOTALL,
    )
    _pat_fail_zh = re.compile(
        rf"(^|[^A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9_])!?\s*FAIL\s*\n*\s*理由\s*[：:\uFF1A][\s\S]*?(?={_retry}|\Z)",
        re.IGNORECASE | re.DOTALL,
    )
    _pat_zh_reason_suggest = re.compile(
        rf"\n+\s*理由\s*[：:\uFF1A][\s\S]*?建议\s*[：:\uFF1A][\s\S]*?(?={_retry}|\Z)",
        re.DOTALL,
    )
    for _ in range(12):
        before = t
        t = _pat_vi_fail.sub(r"\1", t)
        t = _pat_bang_fail.sub(r"\1", t)
        t = _pat_fail_zh.sub(r"\1", t)
        t = _pat_zh_reason_suggest.sub("", t)
        if t == before:
            break
    # Sót !FAIL dính cuối câu (vd "thành công!FAIL") hoặc dòng cuối
    t = re.sub(r"!FAIL\s*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"([.!?…])!FAIL\b", r"\1", t, flags=re.IGNORECASE)
    t = _FAIL_REASON_ANYWHERE_RE.sub(r"\1", t)
    t = _FAIL_REASON_ZH_ANYWHERE_RE.sub(r"\1", t)
    return t.rstrip()


def _strip_reviewer_artifacts(text: str) -> str:
    """Gỡ nội dung lộ từ prompt / feedback reviewer."""
    t = (text or "").rstrip()
    if not t:
        return t
    t = _strip_reviewer_fail_rubric_echo(t)
    t = re.sub(r"\[SYSTEM FEEDBACK\][\s\S]*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\[ClawFlow-internal-review\][\s\S]*$", "", t, flags=re.IGNORECASE)
    for mk in (
        "Bạn là một KIỂM DUYỆT VIÊN (REVIEWER)",
        "Bạn là một KIỂM DUYỆT VIÊN",
        'CHỈ TRẢ VỀ "PASS" HOẶC "FAIL',
    ):
        i = t.find(mk)
        if i != -1:
            t = t[:i].rstrip()
    t = re.sub(
        r"\n{1,2}Luật:\s*\n?\s*1\.\s*Nếu câu trả lời[\s\S]*$",
        "",
        t,
        flags=re.IGNORECASE,
    )
    return t.rstrip()


def _strip_trailing_review_echo(text: str) -> str:
    """Bỏ PASS/FAIL lặt vẹt ở cuối (echo từ luồng reviewer / model)."""
    t = _strip_reviewer_artifacts(text or "")
    if not t:
        return t
    for _ in range(4):
        before = t
        t = _TRAIL_REVIEW_BLOCK_RE.sub("", t)
        t = _TRAIL_PASS_RE.sub("", t)
        t = _TRAIL_FAIL_RE.sub("", t)
        t = _TRAIL_WS_PASS_RE.sub("", t)
        t = _TRAIL_WS_FAIL_RE.sub("", t)
        t = _TRAIL_NL_PASS_RE.sub("", t)
        t = _TRAIL_NL_FAIL_RE.sub("", t)
        t = _TRAIL_TOKEN_PASS_FAIL_RE.sub("", t)
        t = re.sub(r"(\w)PASS\s*$", r"\1", t, flags=re.IGNORECASE)
        t = re.sub(r"(\w)FAIL\s*$", r"\1", t, flags=re.IGNORECASE)
        t = t.rstrip()
        if t == before:
            break
    return t


def strip_thought(text: str) -> str:
    """Xoá mọi biến thể của khối <thought>.

    Xử lý:
    - <thought>...</thought>  (đầy đủ)
    - Thiếu </thought> ở cuối → xoá từ <thought> đến hết.
    - Thẻ đóng </thought> mồ côi chỉ ở đầu chuỗi (sau khi không còn <thought mở).
    """
    if not text:
        return text

    text = _normalize_thought_tags(text)
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

    # Chỉ gỡ thẻ đóng mồ côi ở đầu — tránh rfind("</thought>") xóa nhầm cả phần trả lời
    # khi nội dung có chuỗi "</thought>" (ví dụ trích dẫn).
    lower = cleaned.lower()
    if "<thought" not in lower:
        while True:
            s = cleaned.lstrip()
            low = s.lower()
            if not low.startswith("</thought>"):
                break
            cleaned = s[len("</thought>") :].lstrip()

    return cleaned.strip()


def _strip_chinese_blocks(text: str) -> str:
    """Loại bỏ các đoạn tiếng Trung do Qwen tự sinh khi bị confused.
    Giữ lại tiếng Việt, tiếng Anh, emoji, và ký tự đặc biệt."""
    if not text:
        return text
    # Xóa các dòng/đoạn chứa toàn ký tự CJK (Trung/Nhật/Hàn)
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        # Đếm ký tự CJK trong dòng
        cjk_count = sum(1 for ch in line if "\u4e00" <= ch <= "\u9fff" or "\u3400" <= ch <= "\u4dbf")
        total_chars = sum(1 for ch in line if not ch.isspace())
        # Nếu > 40% dòng là CJK → bỏ dòng đó
        if total_chars > 0 and cjk_count / total_chars > 0.4:
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def sanitize_assistant_text(text: str) -> str:
    """Chuẩn hoá nội dung hiển thị cho user: bỏ khối <thought> (và biến thể)."""
    t = _strip_model_internal_blocks(text or "")
    t = _strip_chinese_blocks(t)
    return _strip_trailing_review_echo(strip_thought(t)).strip()


def sanitize_assistant_text_keep_thought(text: str) -> str:
    """Chuẩn hoá nội dung nhưng GIỮ khối <thought>...</thought> để frontend tách hiển thị.

    Dùng cho các luồng muốn quan sát suy nghĩ theo đúng marker thought/body.
    """
    t = _normalize_thought_tags(_strip_model_internal_blocks(text or ""))
    t = _strip_chinese_blocks(t)
    return _strip_trailing_review_echo(t).strip()
