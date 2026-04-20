"""Xoá checkpoint của một thread_id trong MongoDB.

Dùng khi thread đã tích luỹ quá nhiều tin nhắn, khiến LLM "nhiễu" và quên context.

Cách dùng:
    python -m tools.clear_thread <thread_id>
    python -m tools.clear_thread phong_chat_cua_sếp
    python -m tools.clear_thread --all     # XOÁ HẾT (cẩn thận!)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

DB_NAME = "clawflaw_ai_brain"
COLLECTIONS = ["checkpoints", "checkpoints_aio", "checkpoint_writes", "checkpoint_writes_aio"]


def _client() -> MongoClient:
    uri = os.getenv("MONGO_URI")
    if not uri:
        print("Thiếu MONGO_URI trong .env", file=sys.stderr)
        sys.exit(1)
    return MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=15000)


def list_threads() -> None:
    db = _client()[DB_NAME]
    collections = db.list_collection_names()
    print(f"[Mongo] DB={DB_NAME} | Collections: {collections}")
    for coll_name in COLLECTIONS:
        if coll_name not in collections:
            continue
        thread_ids = db[coll_name].distinct("thread_id")
        counts = [(tid, db[coll_name].count_documents({"thread_id": tid})) for tid in thread_ids]
        print(f"\n[{coll_name}]")
        for tid, n in sorted(counts, key=lambda x: -x[1]):
            print(f"  {tid}: {n} docs")


def clear(thread_id: str) -> None:
    db = _client()[DB_NAME]
    total = 0
    for coll_name in COLLECTIONS:
        if coll_name not in db.list_collection_names():
            continue
        result = db[coll_name].delete_many({"thread_id": thread_id})
        if result.deleted_count:
            print(f"  {coll_name}: xoá {result.deleted_count} docs")
            total += result.deleted_count
    print(f"\nĐã xoá tổng {total} docs của thread_id={thread_id}")


def clear_all() -> None:
    confirm = input("XOÁ TOÀN BỘ checkpoints? Gõ 'YES' để xác nhận: ")
    if confirm != "YES":
        print("Huỷ.")
        return
    db = _client()[DB_NAME]
    for coll_name in COLLECTIONS:
        if coll_name in db.list_collection_names():
            n = db[coll_name].delete_many({}).deleted_count
            print(f"  {coll_name}: xoá {n} docs")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        print("\n--- DANH SÁCH THREAD HIỆN CÓ ---")
        list_threads()
    elif args[0] == "--all":
        clear_all()
    else:
        clear(args[0])
