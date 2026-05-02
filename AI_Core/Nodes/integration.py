"""Integration Agent Node — xử lý DETERMINISTIC (không dùng LLM).

Khi Leader gọi delegate_to_integration, node này phân tích yêu cầu
và TRỰC TIẾP tạo tool_call cho tool phù hợp (read_gmail_tool, v.v.),
không cần qua mô hình ngôn ngữ → nhanh hơn, đáng tin hơn.

Khi tool đã trả kết quả (ToolMessage), node tổng hợp và gửi
text thuần về leader_agent để Leader đúc kết cho user.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime

from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

from state import ClawFlowState


def _find_delegate_task(messages: list) -> str | None:
    """Tìm nội dung ủy quyền từ ToolMessage gần nhất của delegate_to_integration."""
    for m in reversed(messages):
        if isinstance(m, ToolMessage) and m.name == "delegate_to_integration":
            return str(m.content or "")
    return None


def _find_tool_result(messages: list) -> str | None:
    """Tìm kết quả tool (read_gmail_tool, v.v.) từ ToolMessage gần nhất."""
    for m in reversed(messages):
        if isinstance(m, ToolMessage) and m.name != "delegate_to_integration":
            return str(m.content or "")
    return None


def _detect_tool_to_call(task: str) -> tuple[str, dict]:
    """Phân tích task description và quyết định gọi tool nào.
    Returns: (tool_name, tool_args)
    """
    # Quyền quyết định đã được chuyển sang LeaderAgent (LLM) hoặc các node khác.
    # Hàm này hiện tại chỉ trả về mặc định nếu pha 1 vẫn được gọi mà không có logic ngoài.
    return "read_gmail_tool", {"query": "", "max_results": 5}


async def integration_agent_node(state: ClawFlowState, config: RunnableConfig):
    """Integration Agent Node — DETERMINISTIC, không dùng LLM.

    Hai pha:
    1) Lần gọi đầu (sau delegate): phân tích task → tạo tool_call.
    2) Lần gọi sau (sau tool result): đọc kết quả → trả text về Leader.
    """
    messages = state.get("messages", [])

    # Kiểm tra xem đã có kết quả tool chưa (pha 2)
    last_msg = messages[-1] if messages else None

    # Pha 2: Tool đã chạy xong, trả kết quả về Leader
    if isinstance(last_msg, ToolMessage) and last_msg.name != "delegate_to_integration":
        tool_result = str(last_msg.content or "")
        tool_name = last_msg.name or "unknown"
        print(f"[integration] Pha 2: Nhận kết quả từ {tool_name}, "
              f"trả {len(tool_result)} ký tự về Leader")

        # Kiểm tra nếu là thông báo lỗi
        is_error = tool_result.startswith("⚠️") or tool_result.startswith("❌")

        if is_error or tool_name != "read_gmail_tool":
            intro = "📋 **Kết quả từ hệ thống:**\n\n"
            tagged_result = (
                "【DỮ LIỆU THẬT TỪ API - BẮT BUỘC TRÍCH DẪN NGUYÊN VĂN, KHÔNG ĐƯỢC THÊM/BỚT/SỬA ĐỔI】\n"
                f"{'' if is_error else intro}{tool_result}\n"
                "【/DỮ LIỆU THẬT】"
            )
            summary = AIMessage(
                content=tagged_result,
                additional_kwargs={"source_agent": "integration_agent"},
            )
            return {"messages": [summary]}
        
        # Nếu là kết quả email thật -> gọi Gemini phân tích
        from Agents.email_analyzer import analyze_emails
        user_name = state.get("core_profile", "")
        
        try:
            analysis_result = await analyze_emails(tool_result, user_name)
        except Exception as e:
            print(f"[integration] Email analysis failed: {str(e)}. Falling back to raw text.")
            analysis_result = {"summaries": [], "actions": [], "parse_error": True}

        if analysis_result.get("parse_error"):
            # Lỗi JSON -> fallback
            tagged_result = (
                "【DỮ LIỆU THẬT TỪ API - BẮT BUỘC TRÍCH DẪN NGUYÊN VĂN, KHÔNG ĐƯỢC THÊM/BỚT/SỬA ĐỔI】\n"
                f"📧 **Dưới đây là email mới nhất trong hộp thư của bạn:**\n\n{tool_result}\n"
                "【/DỮ LIỆU THẬT】"
            )
        else:
            summaries = analysis_result.get("summaries", [])
            actions = analysis_result.get("actions", [])

            md_parts = ["📧 **Tóm tắt email hôm nay:**\n"]
            for s in summaries:
                prio = "🔴" if s.get("priority") == "high" else "📌"
                md_parts.append(f"{prio} **{s.get('subject', '')}** — từ {s.get('from', '')}")
                md_parts.append(f"> {s.get('summary', '')}\n")

            if actions:
                md_parts.append("---\n💡 **Đề xuất hành động:**\n")
                for a in actions:
                    icon = "✉️" if a.get("type") == "reply_email" else "📅"
                    md_parts.append(f"- {icon} **{a.get('label', '')}**")
                
                # Thêm action plan contract
                import json
                action_plan = {
                    "requires_human": True,
                    "actions": actions
                }
                action_json = json.dumps(action_plan, ensure_ascii=False)
                md_parts.append(f"\n<!--CF_ACTION_PLAN_START-->\n{action_json}\n<!--CF_ACTION_PLAN_END-->")

            tagged_result = (
                "【DỮ LIỆU THẬT TỪ API - BẮT BUỘC TRÍCH DẪN NGUYÊN VĂN, KHÔNG ĐƯỢC THÊM/BỚT/SỬA ĐỔI】\n"
                f"{chr(10).join(md_parts)}\n"
                "【/DỮ LIỆU THẬT】"
            )

        summary = AIMessage(
            content=tagged_result,
            additional_kwargs={"source_agent": "integration_agent"},
        )
        return {"messages": [summary]}

    # Pha 1: Phân tích task và tạo tool_call
    delegate_task = _find_delegate_task(messages)
    if not delegate_task:
        print("[integration] Pha 1: Không tìm thấy delegate task, fallback text")
        fallback = AIMessage(
            content="Không tìm thấy yêu cầu ủy quyền. Vui lòng thử lại.",
            additional_kwargs={"source_agent": "integration_agent"},
        )
        return {"messages": [fallback]}

    tool_name, tool_args = _detect_tool_to_call(delegate_task)

    # Trường hợp chưa hỗ trợ (Calendar, Drive, Notion)
    if tool_name is None:
        msg = tool_args.get("message", "Chức năng này chưa được hỗ trợ.")
        print(f"[integration] Pha 1: Unsupported → {msg[:80]}")
        tagged = (
            "【DỮ LIỆU THẬT TỪ API - BẮT BUỘC TRÍCH DẪN NGUYÊN VĂN, KHÔNG ĐƯỢC THÊM/BỚT/SỬA ĐỔI】\n"
            f"{msg}\n"
            "【/DỮ LIỆU THẬT】"
        )
        unsupported_msg = AIMessage(
            content=tagged,
            additional_kwargs={"source_agent": "integration_agent"},
        )
        return {"messages": [unsupported_msg]}

    call_id = f"call_{uuid.uuid4().hex[:12]}"

    print(f"[integration] Pha 1: delegate_task='{delegate_task[:80]}' → "
          f"tool={tool_name}, args={tool_args}")

    # Tạo AIMessage với tool_calls — hệ thống sẽ tự route sang tools_node
    ai_msg = AIMessage(
        content="",
        tool_calls=[{
            "id": call_id,
            "name": tool_name,
            "args": tool_args,
        }],
        additional_kwargs={"source_agent": "integration_agent"},
    )
    return {"messages": [ai_msg]}
