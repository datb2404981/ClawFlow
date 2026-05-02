"""Content Agent node - Chuyên gia viết/định dạng nội dung."""
from __future__ import annotations

from langchain_core.messages import SystemMessage, AIMessage
from Agents.content_agent import GEMINI_MODEL_CONTENT, SYSTEM_PROMPT_CONTENT
from state import ClawFlowState
from Utils.messages import sanitize_assistant_text
from Utils.gemini_client import gemini_client
from Tools.tool_content import (
    Format_As_Table, Format_As_List, Format_As_Mermaid_Chart,
    Get_Blog_Template, Get_Report_Template, Get_Script_Template, Get_Email_Template,
    Translate_Content, Summarize_Content, SEO_Optimize
)

async def content_agent_node(state: ClawFlowState):
    non_system = [m for m in state["messages"] if not isinstance(m, SystemMessage)]
    
    active_tools = [
        Format_As_Table, Format_As_List, Format_As_Mermaid_Chart,
        Get_Blog_Template, Get_Report_Template, Get_Script_Template, Get_Email_Template,
        Translate_Content, Summarize_Content, SEO_Optimize
    ]

    gemini_resp = await gemini_client.generate_content_async(
        model=GEMINI_MODEL_CONTENT,
        contents=non_system,
        system_instruction=SYSTEM_PROMPT_CONTENT,
        tools=active_tools,
        temperature=0.7
    )

    content = gemini_resp.text or ""
    tool_calls = []
    
    import uuid
    if gemini_resp.candidates and gemini_resp.candidates[0].content.parts:
        for part in gemini_resp.candidates[0].content.parts:
            if part.function_call:
                tool_calls.append({
                    "name": part.function_call.name,
                    "args": part.function_call.args,
                    "id": f"call_{uuid.uuid4().hex[:12]}"
                })
    
    from langchain_core.messages import AIMessage
    response = AIMessage(content=content, tool_calls=tool_calls)

    if isinstance(response.content, str):
        response.content = sanitize_assistant_text(response.content)

    if response.additional_kwargs is None:
        response.additional_kwargs = {}
    response.additional_kwargs["source_agent"] = "content_agent"
    return {"messages": [response]}
