from pydantic import BaseModel,Field
from typing import Optional, List
from datetime import datetime

# 1. Định nghĩa Contract Đầu vào
class ChatRequest(BaseModel):
    user_id: str = Field(..., description="ID của người dùng đăng nhập")
    session_id: str = Field(..., description="ID của phòng chat (thread) hiện tại")
    message: str = Field(
    ...,
    min_length=1,
    description="Message from user")
    
    file_url: Optional[str] = Field(
      default=None,
      description = "URL of the file(PDF,Audio,Image) to be processed"
    )

    integrations: Optional[dict] = Field(
      default=None,
      description="Integration connection states and tokens from Backend"
    )

    task_status: Optional[str] = Field(
        default="running",
        description="Current status of the task (e.g. waiting_execute_approval)"
    )

    draft_payload: Optional[str] = Field(
        default="",
        description="JSON string of the current draft/action plan"
    )

    system_context: Optional[str] = Field(
        default=None,
        description="System instructions, skills, and context from Backend"
    )


# 2. Định nghĩa Contract Đầu ra
class ChatResponse(BaseModel):
    status: str = Field(
      ...,
      description = "Status of the request"
    )

    reply : Optional[str] = Field(
      default=None,
      description = "Reply from AI"
    )

    error : Optional[str] = Field(
      default=None,
      description = "Error message if any"
    )

    agent_used: Optional[List[str]]= Field(
      default=None,
      description = "Agent used to process the request"
    )

    timestamp: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp of the request"
    )