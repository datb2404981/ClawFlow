import json
import re

from fastapi import APIRouter
from Utils.gemini_client import gemini_client
from Api.schemas.route_schema import RouteSkillsRequest, RouteSkillsResponse

router = APIRouter()

@router.post("/route_skills", response_model=RouteSkillsResponse)
async def route_skills(req: RouteSkillsRequest):
    try:
        model_name = "gemini-3.1-flash-lite-preview"

        # Tránh lỗi nếu danh sách skill rỗng
        if not req.available_skills:
            return RouteSkillsResponse(status="success", selected_skill_ids=[])
        
        skills_str = "\n".join([f"- ID: {s.id}\n  Tên: {s.title}\n  Mô tả: {s.description}" for s in req.available_skills])
        
        prompt = f"""Bạn là một hệ thống định tuyến công cụ (Tool Router) cực kỳ thông minh.
Nhiệm vụ của bạn là đọc mô tả công việc của người dùng và chọn ra các công cụ phù hợp nhất từ danh sách bên dưới.

DANH SÁCH CÔNG CỤ HIỆN CÓ:
{skills_str}

CÔNG VIỆC CẦN LÀM:
{req.task_description}

HÃY PHÂN TÍCH VÀ TRẢ VỀ CHÍNH XÁC MỘT MẢNG JSON CÁC ID CỦA NHỮNG CÔNG CỤ CẦN THIẾT. 
Tuyệt đối không giải thích thêm. Nếu không cần công cụ nào, trả về mảng rỗng [].
ĐỊNH DẠNG BẮT BUỘC (Chỉ chứa JSON, không có markdown):
["id1", "id2"]
"""
        response = await gemini_client.generate_content_async(
            model=model_name,
            contents=[prompt],
            temperature=0.1
        )
        content = response.text or ""
        
        # Parse JSON: Xóa các markdown blocks nếu có
        content = re.sub(r'```json\n|\n```|```', '', content).strip()
        
        try:
            selected_ids = json.loads(content)
            if not isinstance(selected_ids, list):
                selected_ids = []
        except Exception:
            # Nếu model không trả về JSON chuẩn, thì coi như không dùng skill nào (An toàn)
            selected_ids = []
            
        return RouteSkillsResponse(status="success", selected_skill_ids=selected_ids)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return RouteSkillsResponse(status="error", error=str(e), selected_skill_ids=[])
