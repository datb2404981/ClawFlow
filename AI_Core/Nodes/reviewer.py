from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage
from langchain_ollama import ChatOllama

from ollama_config import OLLAMA_BASE_URL, OLLAMA_MODEL
from state import ClawFlowState
from Utils.messages import last_human_text_excluding_internal
from Utils.text_sanitize import sanitize_assistant_text

_REVIEW_QUERY_MAX_CHARS = 12000


async def reviewer_node(state: ClawFlowState):
    """
    Node đánh giá chất lượng câu trả lời trước khi kết thúc (Reflection).
    """
    messages = state.get("messages", [])
    if not messages:
        return {}

    # Lượt hiện tại: Human gần nhất (không phải hint nội bộ). Dùng Human *đầu* sẽ sai
    # khi checkpointer giữ nhiều turn — Human đầu có thể không chứa RAG/câu hỏi mới.
    original_query = last_human_text_excluding_internal(state)
    if len(original_query) > _REVIEW_QUERY_MAX_CHARS:
        original_query = (
            original_query[:_REVIEW_QUERY_MAX_CHARS]
            + "\n…[đã cắt bớt ngữ cảnh dài cho reviewer]"
        )

    # Lấy câu trả lời cuối cùng của AI
    last_message = messages[-1]
    if not isinstance(last_message, AIMessage) or getattr(last_message, "tool_calls", None):
        # Nếu message cuối không phải text của AI (mà là tool call), thì bỏ qua review
        return {}

    raw = last_message.content
    raw_str = raw if isinstance(raw, str) else str(raw)
    final_answer = sanitize_assistant_text(raw_str)

    # Draft mode contract: Backend cần marker action plan.
    # Nếu phát hiện marker thì bỏ qua review để tránh reviewer trả hint FAIL.
    ACTION_PLAN_START = "<!--CF_ACTION_PLAN_START-->"
    ACTION_PLAN_END = "<!--CF_ACTION_PLAN_END-->"
    if ACTION_PLAN_START in final_answer and ACTION_PLAN_END in final_answer:
        review_count = state.get("review_count", 0) + 1
        return {"review_count": review_count}

    # LLM dùng để review (cùng model Ollama với agent)
    llm = ChatOllama(model=OLLAMA_MODEL, base_url=OLLAMA_BASE_URL)

    prompt = f"""Bạn là một KIỂM DUYỆT VIÊN (REVIEWER) nghiêm ngặt.
Nhiệm vụ của bạn là kiểm tra xem CÂU TRẢ LỜI CỦA AI có giải quyết được YÊU CẦU GỐC CỦA NGƯỜI DÙNG hay không.

YÊU CẦU GỐC (có thể kèm tài liệu kho RAG): {original_query}

CÂU TRẢ LỜI CỦA AI (đã bỏ khối suy nghĩ nội bộ): {final_answer}

Luật:
1. Nếu trong YÊU CẦU GỐC có khối **DỮ LIỆU TÀI LIỆU KHO** / RAG mà câu trả lời trích đúng số liệu hoặc nội dung từ đó theo đúng câu hỏi → PASS.
2. Nếu câu trả lời đã ĐẦY ĐỦ, CHÍNH XÁC và CÓ LÀM VIỆC, hãy trả về CHỈ MỘT TỪ: PASS
3. Nếu câu trả lời LỖI, THIẾU SÓT, TỪ CHỐI LÀM VIỆC (vd: "tôi không tìm thấy dữ liệu", "tôi không thể giúp") trong khi RAG đã có thông tin liên quan, hoặc trả lời sai, hãy trả về chữ: FAIL kèm theo lý do và gợi ý ngắn.
"""
    response = await llm.ainvoke(prompt)
    feedback = response.content.strip().upper()

    review_count = state.get("review_count", 0) + 1

    if feedback.startswith("PASS"):
        return {"review_count": review_count}
    else:
        # Tiền tố nội bộ — Frontend lọc không hiển thị; không dùng chữ FAIL để tránh lộ như câu trả lời.
        hint = (
            "[ClawFlow-internal-review] Câu trả lời chưa đạt yêu cầu. "
            "Đọc lại yêu cầu gốc; ưu tiên nội dung trong RAG/tài liệu kho nếu có; "
            "dùng tool phù hợp (Tavily chỉ khi RAG không đủ). Không lặp cùng một lỗi."
        )
        return {
            "review_count": review_count,
            "messages": [HumanMessage(content=hint)],
        }
