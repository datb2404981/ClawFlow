import gradio as gr
import httpx

# Gọi đến con FastAPI của sếp đang chạy ở background
async def chat_with_clawflow(message, history):
    url = "http://127.0.0.1:8000/api/v1/chat"
    
    # Body y chang Postman
    payload = {
        "message": message,
        "session_id": "gradio_user"
    }
    
    async with httpx.AsyncClient(timeout=120) as client:
        try:
            response = await client.post(url, json=payload)
            data = response.json()
            return data.get("reply", "Lỗi: Không có dữ liệu trả về.")
        except Exception as e:
            return f"Lỗi không kết nối được với Server: {e}"

# Tạo giao diện Chat
demo = gr.ChatInterface(
    fn=chat_with_clawflow,
    title="🤖 ClawFlow AI - Multi-Agent System",
    description="Thủ lĩnh AI và Content Agent phân công nhau làm việc. (Hỗ trợ Markdown 100%)"
)

if __name__ == "__main__":
    demo.launch()

