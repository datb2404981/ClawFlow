from langchain_core.tools import tool
import os
import requests
from bson.objectid import ObjectId

@tool
def vector_search_workspace(query: str, workspace_id: str) -> str:
    """
    Công cụ tìm kiếm tài liệu nội bộ trong kho tri thức của dự án (RAG Vector Search).
    Sử dụng công cụ này khi bạn cần tra cứu thêm thông tin chi tiết về dự án, 
    luật lệ, hoặc các tài liệu mà người dùng đã tải lên.
    Đầu vào:
    - query: Câu hỏi hoặc từ khóa tìm kiếm (VD: "Quy định xin nghỉ phép là gì?")
    - workspace_id: ID của workspace hiện tại (lấy từ ngữ cảnh hoặc bộ nhớ). Nếu không có, không thể dùng tool này.
    """
    try:
        from state import client # Fix Circular Import
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        
        # 1. Tạo Vector Embedding từ câu query bằng Gemini
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            return "Lỗi cấu hình: AI_Core thiếu GEMINI_API_KEY để chạy Vector Search."
            
        embeddings_model = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004", 
            google_api_key=gemini_api_key
        )
        query_vector = embeddings_model.embed_query(query)

        # 2. Kết nối tới DB clawflaw_core_api
        db = client.get_database("clawflaw_core_api")
        collection = db.get_collection("knowledge_chunks")

        # 3. Chạy lệnh truy vấn Vector Search
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "vector_index", # Tên index bắt buộc phải khớp trên Atlas
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 50,
                    "limit": 3,
                    "filter": { "workspace_id": ObjectId(workspace_id) }
                }
            },
            {
                "$project": {
                    "chunk_text": 1,
                    "score": { "$meta": "vectorSearchScore" }
                }
            }
        ]
        
        results = list(collection.aggregate(pipeline))

        if not results:
            return "Không tìm thấy tài liệu liên quan nào trong kho tri thức."

        response_text = "### KẾT QUẢ TÌM KIẾM TÀI LIỆU NỘI BỘ (VECTOR SEARCH):\n"
        for idx, doc in enumerate(results):
            text = doc.get("chunk_text", "")
            score = doc.get("score", 0)
            response_text += f"\n--- Tài liệu {idx+1} (Độ khớp: {score:.2f}) ---\n{text}\n"

        return response_text
    except Exception as e:
        return f"Lỗi khi tìm kiếm tài liệu: {str(e)}"

tool_by_name = {
    "vector_search_workspace": vector_search_workspace
}
