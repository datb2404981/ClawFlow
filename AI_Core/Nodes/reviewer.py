from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage
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

    # Nếu vừa thực thi tool (kết quả tool-call), hoặc số lượng tool call đang được xử lý,
    # reviewer không có đủ ngữ cảnh để phán xét — bỏ qua để tránh vòng lặp sai.
    if state.get("tool_call_count", 0) > 0:
        review_count = state.get("review_count", 0) + 1
        return {"review_count": review_count}

    # Câu trả lời liên quan đến hướng dẫn kết nối tích hợp (Gmail/Calendar/...)
    # thì không cần review — đây là đáp án hợp lệ khi tool báo lỗi chưa kết nối.
    _INTEGRATION_PHRASES = (
        "cài đặt → integrations",
        "cài đặt → integration",
        "settings/integrations",
        "cài đặt → kết nối",
        "chưa được kết nối",
        "chưa kết nối",
        "token gmail",
        "access_token",
        "connect gmail",
        "đã cấp quyền",
        "đồng ý truy cập",
        "xác nhận cấp quyền",
        "hành động đã được thực hiện",
    )
    final_lower = final_answer.lower()
    if any(p in final_lower for p in _INTEGRATION_PHRASES):
        review_count = state.get("review_count", 0) + 1
        return {"review_count": review_count}

    # Draft mode contract: Backend cần marker action plan.
    # Nếu phát hiện marker thì bỏ qua review để tránh reviewer trả hint FAIL.
    ACTION_PLAN_START = "<!--CF_ACTION_PLAN_START-->"
    ACTION_PLAN_END = "<!--CF_ACTION_PLAN_END-->"
    if ACTION_PLAN_START in final_answer and ACTION_PLAN_END in final_answer:
        review_count = state.get("review_count", 0) + 1
        return {"review_count": review_count}

    prompt = f"""Bạn là một KIỂM DUYỆT VIÊN (REVIEWER) nghiêm ngặt.
Nhiệm vụ của bạn là kiểm tra xem CÂU TRẢ LỜI CỦA AI có giải quyết được YÊU CẦU GỐC CỦA NGƯỜI DÙNG hay không.

YÊU CẦU GỐC (có thể kèm tài liệu kho RAG): {original_query}

CÂU TRẢ LỜI CỦA AI (đã bỏ khối suy nghĩ nội bộ): {final_answer}

Luật:
1. Nếu câu trả lời đã ĐẦY ĐỦ, CHÍNH XÁC và ĐÚNG số liệu từ tài liệu kho/RAG → Trả về DUY NHẤT một từ: PASS (không kèm lý do).
2. LỖI NGHIÊM TRỌNG (BẮT BUỘC ĐÁNH RỚT - FAIL): Nếu AI chỉ HỨA HẸN hoặc BÁO TRƯỚC là "sẽ đọc", "đợi một chút để em dùng công cụ đọc", "đang tiến hành kiểm tra" mà KHÔNG CÓ KẾT QUẢ THẬT SỰ → Trả về chữ: FAIL kèm lý do "Chỉ hứa hẹn mà chưa thực sự gọi công cụ. Yêu cầu chạy tool ngay lập tức."
3. Nếu câu trả lời LỖI, THIẾU SÓT hoặc TỪ CHỐI LÀM VIỆC sai trái → Trả về chữ: FAIL kèm theo lý do cực ngắn.
CHỈ TRẢ VỀ "PASS" HOẶC "FAIL ...". KHÔNG CHÀO HỎI, KHÔNG GIẢI THÍCH DÀI DÒNG.
"""

    # LLM dùng để review (Sử dụng Gemini 1.5 Flash để ổn định nhất)
    GEMINI_MODEL_REVIEWER = "gemini-3.1-flash-lite-preview"
    from Utils.gemini_client import gemini_client

    gemini_resp = await gemini_client.generate_content_async(
        model=GEMINI_MODEL_REVIEWER,
        contents=[original_query, final_answer],
        system_instruction=prompt,
        temperature=0.2
    )
    feedback = (gemini_resp.text or "").strip().upper()

    review_count = state.get("review_count", 0) + 1

    if feedback.startswith("PASS"):
        return {"review_count": review_count}
    else:
        # Tiền tố nội bộ — Frontend lọc không hiển thị
        hint = (
            "[SYSTEM FEEDBACK] Câu trả lời trước chưa đạt yêu cầu! "
            "Vui lòng đọc kỹ lại YÊU CẦU GỐC và tạo ra câu trả lời ĐẦY ĐỦ hơn. "
            "Sử dụng thông tin từ RAG/Bộ nhớ nếu có. Không lặp lại lỗi cũ. "
            "TUYỆT ĐỐI KHÔNG đề cập đến thông báo [SYSTEM FEEDBACK] này trong nội dung bạn viết ra."
        )
        return {
            "review_count": review_count,
            "messages": [HumanMessage(content=hint)],
        }
