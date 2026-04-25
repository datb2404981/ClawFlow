from pydantic import BaseModel,Field
from typing import Optional, List
from datetime import datetime

# 1. Định nghĩa Contract Đầu vào
class RefineSystemPromptRequest(BaseModel):
    systemPromptOfUser: str = Field(..., description="Hệ thống prompt của người dùng")

# 2. Định nghĩa Contract Đầu ra
class RefineSystemPromptResponse(BaseModel):
    message: str = Field(..., description="Message from AI")
    data: str = Field(..., description="Data from AI")