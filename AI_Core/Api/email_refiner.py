from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from Utils.gemini_client import gemini_client
import re

# 1. Schema (Cấu trúc dữ liệu đầu vào/ra)
class RefineEmailRequest(BaseModel):
    emailBody: str

class RefineEmailResponse(BaseModel):
    message: str
    data: str

# 2. System Prompt chuyên biệt cho việc hành chính (Viết Mail)
SYSTEM_EMAIL_REFINER = """Bạn là 'ClawFlow Email Assistant'.
Nhiệm vụ: Viết lại bản nháp email của người dùng một cách chuyên nghiệp.

QUY TẮC SỐNG CÒN (STRICT RULES):
1. CHỈ TRẢ VỀ nội dung email. KHÔNG MỘT TỪ NÀO KHÁC.
2. KHÔNG thêm câu chào đầu như "Chắc chắn rồi", "Tôi đã sửa xong", "Dưới đây là kết quả".
3. KHÔNG sử dụng Markdown code block (không dùng ký tự ```).
4. KHÔNG bịa đặt thêm thông tin người, tên, hoặc thời gian nếu nháp gốc không có.

Nếu bạn vi phạm các quy tắc trên, hệ thống sẽ bị lỗi nghiêm trọng."""

REFINE_EMAIL_PREFIX = """
Hãy tối ưu bản nháp email dưới đây:

===NHÁP EMAIL THÔ===
{raw}
===KẾT THÚC NHÁP===

Chỉ trả về nội dung email đã tối ưu.
""".strip()

router = APIRouter()

# 3. Mở Endpoint (Đường dẫn) hứng request từ NestJS
@router.post("/refine-email", response_model=RefineEmailResponse)
async def refine_email(req: RefineEmailRequest) -> RefineEmailResponse:
    try:
        # Bọc chữ của user vào Prompt
        user_block = REFINE_EMAIL_PREFIX.format(raw=req.emailBody.strip())
        
        # Gọi mô hình AI xử lý
        gemini_resp = await gemini_client.generate_content_async(
            model="gemma-4-31b-it",
            contents=[user_block],
            system_instruction=SYSTEM_EMAIL_REFINER,
            temperature=0.7 # Độ sáng tạo vừa phải để văn phong tự nhiên
        )
        
        # 1. Lấy kết quả thô từ AI
        raw_text = (gemini_resp.text or "").strip()
        print(f"[EmailRefiner] Raw response: '{raw_text}'")

        # 2. Xử lý hậu kỳ (Post-processing): Cắt bỏ dấu Markdown (nếu có)
        # Sử dụng Regex linh hoạt hơn để bắt code block ngay cả khi có khoảng trắng thừa
        clean_text = re.sub(r'^.*?```[a-zA-Z]*\s*\n?', '', raw_text, flags=re.DOTALL)
        clean_text = re.sub(r'\n?\s*```.*?$', '', clean_text, flags=re.DOTALL)
        clean_text = clean_text.strip("`").strip()

        # Nếu sau khi gọt mà bị rỗng hoàn toàn, trả về raw_text để tránh mất dữ liệu
        if not clean_text:
            clean_text = raw_text

        # 3. Cắt bỏ các câu chào hỏi thừa thãi (nếu có xuống dòng phân tách rõ ràng)
        prefixes = ("Dưới đây là", "Chắc chắn rồi", "Đây là", "Kết quả tối ưu")
        if clean_text.startswith(prefixes):
            parts = clean_text.split('\n', 1)
            if len(parts) > 1 and parts[1].strip():
                clean_text = parts[1].strip()
        
        return RefineEmailResponse(
            message="Tối ưu email thành công",
            data=clean_text,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
