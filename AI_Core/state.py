"""State, kết nối DB, và các hằng số dùng chung cho toàn Graph."""
from __future__ import annotations

import operator
import os
from typing import Annotated, Optional, TypedDict

import certifi
from dotenv import load_dotenv
from langchain_core.messages import AnyMessage
from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient

from Tools.tool_browser import tool_by_name as browser_tools
from Tools.tool_content import tool_by_name as content_tools
from Tools.tool_memory import tool_by_name as memory_tools
from Tools.tool_calculator import tool_by_name as calculator_tools
from Tools.tool_code import tool_by_name as code_tools
from Tools.tool_rag import tool_by_name as rag_tools

load_dotenv()


# Ép pymongo dùng CA bundle của certifi (fix SSL TLSV1_ALERT_INTERNAL_ERROR
# trên Python 3.14/OpenSSL 3.6 khi kết nối MongoDB Atlas).
_MONGO_KWARGS = {
    "tlsCAFile": certifi.where(),
    "retryWrites": True,
    "retryReads": True,
    "serverSelectionTimeoutMS": 20000,
}


# =========================================================================
# STATE
# =========================================================================
class ClawFlowState(TypedDict, total=False):
    """Trạng thái phiên chat - LangGraph sẽ tự merge qua các turn."""
    messages: Annotated[list[AnyMessage], operator.add]
    user_id: str
    thread_id: str
    current_task: str
    active_roles: list[str]

    core_profile: Optional[str]
    thread_rules: Optional[str]
    memory_loaded: bool

    review_count: int
    tool_call_count: int


# =========================================================================
# TOOLS REGISTRY
# =========================================================================
ALL_TOOLS = {**browser_tools, **content_tools, **memory_tools, **calculator_tools, **code_tools, **rag_tools}
MEMORY_TOOL_NAMES = set(memory_tools.keys())
CONTENT_TOOL_NAMES = set(content_tools.keys())


# =========================================================================
# MONGO & CHECKPOINTER
# =========================================================================
client = MongoClient(os.getenv("MONGO_URI"), **_MONGO_KWARGS)

# MongoDBSaver hardcode 2 collection: "checkpoints" + "checkpoint_writes"
# → Tham số `collection_name` nếu có cũng bị bỏ qua.
CHECKPOINT_DB_NAME = "clawflaw_ai_brain"
db_saver = MongoDBSaver(client, db_name=CHECKPOINT_DB_NAME)
