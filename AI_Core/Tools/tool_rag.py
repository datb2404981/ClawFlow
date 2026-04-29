from langchain_core.tools import tool
import os
import requests
from mongo_client import client
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
        # Trong môi trường thực tế, nếu MongoDB lưu collection là 'knowledgechunks'
        # Ta lấy DB name từ URI
        uri = os.getenv("MONGO_URI", "")
        db_name = uri.split("/")[-1].split("?")[0]
        if not db_name:
            db_name = "test" # default

        db = client.get_database(db_name)
        collection = db.get_collection("knowledgechunks")

        # Fallback: Hiện tại AI_Core Python chưa gắn thư viện Gemini Embeddings
        # Để an toàn, chúng ta gọi tìm kiếm Text cơ bản trên MongoDB thay cho Vector,
        # hoặc sử dụng Regex search do Python chưa có Gemini API Key.
        # Lưu ý: Yêu cầu collection phải tạo Text Index trên chunk_text.
        
        # Thử tìm kiếm bằng Text Search (yêu cầu index) hoặc Regex Search (chậm nhưng an toàn)
        cursor = collection.find(
            {
                "workspace_id": ObjectId(workspace_id),
                "chunk_text": {"$regex": query, "$options": "i"}
            }
        ).limit(3)
        
        results = list(cursor)
        
        if not results:
            # Nếu tìm regex thất bại, chia cắt query thành từ khóa
            keywords = query.split()
            if len(keywords) > 2:
                # Tìm bằng các từ khóa ngắn hơn
                cursor2 = collection.find(
                    {
                        "workspace_id": ObjectId(workspace_id),
                        "chunk_text": {"$regex": keywords[0], "$options": "i"}
                    }
                ).limit(3)
                results = list(cursor2)

        if not results:
            return "Không tìm thấy tài liệu liên quan nào trong kho tri thức."

        response_text = "### KẾT QUẢ TÌM KIẾM TÀI LIỆU NỘI BỘ:\n"
        for idx, doc in enumerate(results):
            text = doc.get("chunk_text", "")
            response_text += f"\n--- Tài liệu {idx+1} ---\n{text}\n"

        return response_text
    except Exception as e:
        return f"Lỗi khi tìm kiếm tài liệu: {str(e)}"

tool_by_name = {
    "vector_search_workspace": vector_search_workspace
}
