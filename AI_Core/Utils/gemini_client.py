import os
import uuid
from typing import Any, AsyncIterator, List, Optional, Union
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage
from google.genai import types

class GeminiResponseWrapper:
    """Wrapper để giả lập phản hồi từ Google GenAI SDK cho code cũ không bị break."""
    def __init__(self, ai_msg: AIMessage):
        self.text = ai_msg.content if isinstance(ai_msg.content, str) else ""
        self.tool_calls = ai_msg.tool_calls
        # Giả lập cấu trúc candidates cho leader.py
        self.candidates = [self._Candidate(ai_msg)]

    class _Candidate:
        def __init__(self, ai_msg: AIMessage):
            self.content = self._Content(ai_msg)

        class _Content:
            def __init__(self, ai_msg: AIMessage):
                self.parts = []
                if ai_msg.tool_calls:
                    for tc in ai_msg.tool_calls:
                        self.parts.append(self._Part(tc))
            
            class _Part:
                def __init__(self, tool_call: dict):
                    self.function_call = self._FunctionCall(tool_call)
                
                class _FunctionCall:
                    def __init__(self, tool_call: dict):
                        self.name = tool_call["name"]
                        self.args = tool_call["args"]

class GeminiClient:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GENAI_API_KEY")
        if not self.api_key:
            raise RuntimeError("Missing GEMINI_API_KEY or GOOGLE_GENAI_API_KEY in environment variables.")
        
        # 1. Khởi tạo mô hình chính (Primary) - GA ổn định, chịu tải tốt
        self.primary_llm = ChatGoogleGenerativeAI(
            model="gemini-3.1-flash-lite-preview",
            temperature=0.1,
            max_retries=1, # Nếu lỗi thì đổi sang dự phòng ngay
            google_api_key=self.api_key
        )

        # 2. Khởi tạo mô hình dự phòng (Fallback) - Flash GA ổn định
        self.fallback_llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.1,
            max_retries=3,
            google_api_key=self.api_key
        )

        # 3. Kết hợp cơ chế Fallback
        self.robust_llm = self.primary_llm.with_fallbacks(fallbacks=[self.fallback_llm])

    def _sanitize_history(self, messages: List[Any]) -> List[BaseMessage]:
        """GIẢI PHÁP HẠT NHÂN: Ép kiểu ToolCall/History thành Text để tránh lỗi 400.
        LangGraph thường làm mất signature khiến Gemini API reject lịch sử có tool call cũ.
        """
        sanitized = []
        for msg in messages:
            if isinstance(msg, AIMessage) and msg.tool_calls:
                # Ép AI Message có tool call thành text
                tool_names = ", ".join([tc["name"] for tc in msg.tool_calls])
                content = msg.content if msg.content else f"[Hành động AI: Gọi công cụ {tool_names}]"
                sanitized.append(AIMessage(content=content))
            elif isinstance(msg, ToolMessage):
                # Ép Tool Result thành Human Message (AI coi như user cung cấp dữ liệu)
                content = f"[Kết quả từ công cụ]: {msg.content}"
                if len(content) > 3000:
                    content = content[:3000] + "... [đã cắt bớt]"
                sanitized.append(HumanMessage(content=content))
            else:
                sanitized.append(msg)
        return sanitized

    async def generate_content_async(
        self, 
        model: str, 
        contents: List[Any], 
        system_instruction: Optional[str] = None,
        tools: Optional[List[Any]] = None,
        temperature: float = 0.1,
        stream: bool = False,
        **kwargs
    ) -> Union[GeminiResponseWrapper, AsyncIterator[Any]]:
        """Gọi LLM với cơ chế Fallback đã được gia cố."""
        
        # Nếu model được truyền vào cụ thể và không phải mặc định, ta có thể ghi đè
        # Nhưng ở đây ta dùng robust_llm làm xương sống.
        llm = self.robust_llm
        if temperature != 0.1:
            llm = llm.with_config(configurable={"temperature": temperature})

        # Gắn công cụ nếu có
        if tools:
            llm = llm.bind_tools(tools)

        # Chuẩn bị tin nhắn (Sanitization)
        messages = self._sanitize_history(contents)
        if system_instruction:
            # Chèn system prompt vào đầu
            messages = [SystemMessage(content=system_instruction)] + messages

        try:
            if stream:
                # LangChain astream trả về các chunk
                return llm.astream(messages)
            else:
                ai_msg = await llm.ainvoke(messages)
                return GeminiResponseWrapper(ai_msg)
        except Exception as e:
            print(f"[GeminiClient] Lỗi thực thi LLM (ngay cả sau fallback): {str(e)}")
            raise e

# Global singleton instance
gemini_client = GeminiClient()
