from pydantic import BaseModel, Field
from typing import List

class SkillMetadata(BaseModel):
    id: str = Field(..., description="Mã ID của kỹ năng")
    title: str = Field(..., description="Tên kỹ năng")
    description: str = Field(..., description="Mô tả chức năng của kỹ năng")

class RouteSkillsRequest(BaseModel):
    task_description: str = Field(..., description="Mô tả công việc (task) mà người dùng yêu cầu")
    available_skills: List[SkillMetadata] = Field(..., description="Danh sách các kỹ năng hiện có")

class RouteSkillsResponse(BaseModel):
    status: str = Field(..., description="Status của request (success/error)")
    selected_skill_ids: List[str] = Field(default_factory=list, description="Danh sách ID của các kỹ năng được chọn")
    error: str | None = Field(default=None, description="Thông báo lỗi nếu có")
