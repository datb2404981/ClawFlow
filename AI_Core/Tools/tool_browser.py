import os
from tavily import TavilyClient
from langchain.tools import tool
import httpx
from pathlib import Path

# Khởi tạo Tavily Client
# Lưu ý: Bạn cần có TAVILY_API_KEY trong file .env hoặc biến môi trường
tavily_api_key = os.getenv("TAVILY_API_KEY")

@tool
async def Search_Tavily(query: str):
    """
    Đây là công cụ tìm kiếm và phân tích web mạnh mẽ nhất. 
    Sử dụng nó để:
    1. Tìm kiếm thông tin mới nhất trên Internet.
    2. Lấy nội dung chi tiết từ các trang web liên quan.
    3. Tìm kiếm câu trả lời nhanh cho các câu hỏi phức tạp.
    """
    if not tavily_api_key:
        return "Lỗi: Thiếu TAVILY_API_KEY. Vui lòng đăng ký tại tavily.com và thêm vào file .env"
    try:
        tavily = TavilyClient(api_key=tavily_api_key)
        # Search & Context: Vừa tìm kiếm vừa lấy nội dung tóm tắt cực xịn
        print(query)
        response = tavily.search(query=query, search_depth="advanced", max_results=10)
        
        results = response.get('results', [])
        answer = []
        for res in results:
            answer.append(f"Tiêu đề: {res.get('title')}\nLink: {res.get('url')}\nNội dung: {res.get('content')}\n---")
            
        final_result = "\n".join(answer)
        if not final_result:
            return "Tavily không tìm thấy kết quả nào phù hợp."
        return final_result
        
    except Exception as e:
        return f"[LỖI TAVILY]: {str(e)}"

@tool
async def Read_URL_Content(url: str) -> str:
    """
    Sử dụng công cụ này khi bạn đã có MỘT URL CỤ THỂ và muốn đọc toàn bộ nội dung chi tiết bên trong trang web đó.
    Không dùng công cụ này để TÌM KIẾM - hãy dùng Search_Tavily cho việc tìm kiếm.
    """
    if not tavily_api_key:
        return "Lỗi: Thiếu TAVILY_API_KEY."
    
    print(f"📖 Đang đọc nội dung URL: {url}")
    try:
        tavily = TavilyClient(api_key=tavily_api_key)
        response = tavily.extract(urls=[url])
        
        results = response.get('results', [])
        if not results:
            return f"Không đọc được nội dung từ URL: {url}"
        
        content = results[0].get('raw_content', '')
        # Giới hạn 3000 ký tự để không làm ngợp LLM
        return content[:3000] + "..." if len(content) > 3000 else content
        
    except Exception as e:
        return f"[LỖI ĐỌC URL]: {str(e)}"

# Công cụ
tool_browsers = [Search_Tavily, Read_URL_Content]

# Tạo từ điển
tool_by_name = {t.name: t for t in tool_browsers}