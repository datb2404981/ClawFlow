from __future__ import annotations
from langchain_core.messages import HumanMessage, AIMessage
from langchain_ollama import ChatOllama
import os
from state import ClawFlowState

async def reviewer_node(state: ClawFlowState):
    """
    Node đánh giá chất lượng câu trả lời trước khi kết thúc (Reflection).
    """
    messages = state.get("messages", [])
    if not messages:
        return {}

    # Tìm câu hỏi gốc của user
    original_query = ""
    for m in messages:
        if isinstance(m, HumanMessage):
            original_query = m.content
            break

    # Lấy câu trả lời cuối cùng của AI
    last_message = messages[-1]
    if not isinstance(last_message, AIMessage) or getattr(last_message, "tool_calls", None):
        # Nếu message cuối không phải text của AI (mà là tool call), thì bỏ qua review
        return {}

    final_answer = last_message.content

    # LLM dùng để review
    model_name = os.environ.get("OLLAMA_MODEL", "llama3.2:1b-instruct-fp16")
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    llm = ChatOllama(model=model_name, base_url=base_url)

    prompt = f"""Bạn là một KIỂM DUYỆT VIÊN (REVIEWER) nghiêm ngặt.
Nhiệm vụ của bạn là kiểm tra xem CÂU TRẢ LỜI CỦA AI có giải quyết được YÊU CẦU GỐC CỦA NGƯỜI DÙNG hay không.

YÊU CẦU GỐC: {original_query}

CÂU TRẢ LỜI CỦA AI: {final_answer}

Luật:
1. Nếu câu trả lời đã ĐẦY ĐỦ, CHÍNH XÁC và CÓ LÀM VIỆC, hãy trả về CHỈ MỘT TỪ: PASS
2. Nếu câu trả lời LỖI, THIẾU SÓT, TỪ CHỐI LÀM VIỆC (vd: "tôi không tìm thấy dữ liệu", "tôi không thể giúp") hoặc trả lời sai, hãy trả về chữ: FAIL kèm theo lý do vì sao và gợi ý AI sử dụng công cụ khác.
"""
    response = await llm.ainvoke(prompt)
    feedback = response.content.strip().upper()

    review_count = state.get("review_count", 0) + 1

    if feedback.startswith("PASS"):
        return {"review_count": review_count}
    else:
        # Bắt làm lại
        return {
            "review_count": review_count,
            "messages": [HumanMessage(content=f"[SYSTEM FEEDBACK - YÊU CẦU LÀM LẠI HOẶC THỬ TOOL KHÁC]: {response.content}")]
        }
