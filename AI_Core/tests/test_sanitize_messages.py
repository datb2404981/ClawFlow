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


if __name__ == "__main__":
    _run()
    print("test_sanitize_messages: OK")
