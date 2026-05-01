"""Unit test nhẹ cho strip_thought / sanitize_assistant_text (không cần pytest)."""
from __future__ import annotations

import sys
from pathlib import Path

AI_CORE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_CORE_DIR))

from Utils.text_sanitize import sanitize_assistant_text, strip_thought  # noqa: E402


def _run() -> None:
    assert strip_thought("<thought>a</thought>Hi") == "Hi"
    assert strip_thought("<THOUGHT>x\n</THOUGHT>\nXin chào") == "Xin chào"
    assert strip_thought("<thought>chưa đóng") == ""

    raw = "<thought>nội bộ</thought>\n\nCâu trả lời cho user."
    assert sanitize_assistant_text(raw) == "Câu trả lời cho user."

    assert sanitize_assistant_text("  plain  ") == "plain"

    assert sanitize_assistant_text("Xin chào.PASS") == "Xin chào"
    assert sanitize_assistant_text("Kết quả\nPASS") == "Kết quả"
    assert sanitize_assistant_text("OK PASS") == "OK"
    assert sanitize_assistant_text("CT3)PASS") == "CT3)"

    # Echo reviewer: FAIL + Lý do/Gợi ý (VI) — cắt tới cuối hoặc tới đoạn retry
    leak_vi = (
        "Mở app Email.\n\nFAIL\n\nLý do: không đúng.\n\nGợi ý: sửa lại."
    )
    # Rubric dính đầu tin (không có \n trước FAIL)
    leak_fail_first = (
        "FAIL\n\nLý do: Câu trả lời từ AI đã đề xuất tìm hiểu thêm.\n\n"
        "Gợi ý: Trả lời người dùng bằng cách gợi ý Gmail."
    )
    out_ff = sanitize_assistant_text(leak_fail_first)
    assert "FAIL" not in out_ff and "Lý do" not in out_ff and "Gợi ý" not in out_ff
    assert "FAIL" not in sanitize_assistant_text(leak_vi)
    assert "Lý do" not in sanitize_assistant_text(leak_vi)
    assert "Mở app Email" in sanitize_assistant_text(leak_vi)

    leak_bang = "Chúc bạn thành công!FAIL\n\nLý do: x\n\nGợi ý: y"
    out_b = sanitize_assistant_text(leak_bang)
    assert "FAIL" not in out_b and "Lý do" not in out_b
    assert "Chúc bạn thành công" in out_b
    leak_after_paren = (
        "Xin chào! Hiện tại em chưa thấy mail.(FAIL\n\nLý do: thiếu dữ liệu.\n\nGợi ý: hỏi lại.)"
    )
    out_p = sanitize_assistant_text(leak_after_paren)
    assert "FAIL" not in out_p and "Lý do" not in out_p and "Gợi ý" not in out_p
    assert "Xin chào! Hiện tại em chưa thấy mail." in out_p

    leak_zh = "Phần tốt.\n\nFAIL\n\n理由：bad\n\n建议：fix"
    out_z = sanitize_assistant_text(leak_zh)
    assert "理由" not in out_z and "建议" not in out_z
    assert "Phần tốt" in out_z

    leak_retry = (
        "Lần 1.\n\nFAIL\n\nLý do: a\n\nGợi ý: b\n\n"
        "Em xin kiểm tra lại: lần 2 sạch."
    )
    out_r = sanitize_assistant_text(leak_retry)
    assert "FAIL" not in out_r and "Lý do" not in out_r
    assert "Lần 1" in out_r and "Em xin kiểm tra" in out_r


if __name__ == "__main__":
    _run()
    print("test_sanitize_messages: OK")
