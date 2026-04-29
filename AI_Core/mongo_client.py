"""Kết nối MongoDB dùng chung — tách khỏi `state` để tránh import vòng với `Tools`."""
from __future__ import annotations

import os

import certifi
from dotenv import load_dotenv
from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient

load_dotenv()

# Ép pymongo dùng CA bundle của certifi (fix SSL TLSV1_ALERT_INTERNAL_ERROR
# trên Python 3.14/OpenSSL 3.6 khi kết nối MongoDB Atlas).
_MONGO_KWARGS = {
    "tlsCAFile": certifi.where(),
    "retryWrites": True,
    "retryReads": True,
    "serverSelectionTimeoutMS": 20000,
}

client = MongoClient(os.getenv("MONGO_URI"), **_MONGO_KWARGS)

CHECKPOINT_DB_NAME = "clawflaw_ai_brain"
db_saver = MongoDBSaver(client, db_name=CHECKPOINT_DB_NAME)
