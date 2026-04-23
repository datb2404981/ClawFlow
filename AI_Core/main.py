from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import sys
import uvicorn

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

load_dotenv()

app = FastAPI(
  title = "ClawFlow AI Core",
  description = "Lõi AI xử lý Đa phương thức và Đặc vụ cho dự án ClawFlow",
  version = "1.0.0",
)

# Cấu hình CORS
app.add_middleware(
  CORSMiddleware,
  #Hiện tại cho phép tất cả, khi deploy thì đổi lại IP của Backend
  allow_origins = ["*"],
  allow_credentials = True,
  allow_methods = ["*"],
  allow_headers = ["*"],
)

# Móc API Chat từ file chat.py vào Server chính
from Api.chat import router as chat_router
app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])

@app.get('/')
async def health_check():
  return {
    "status": "success",
    "message": "ClawFlow AI Core đang hoạt động tốt!"
  }

if __name__ == "__main__":
  post = int(os.getenv("PORT", 8000))
  # 0.0.0.0: cần cho Docker / truy cập từ container hoặc máy khác
  host = os.getenv("HOST", "0.0.0.0")
  print(f"🚀 Server đang khởi chạy tại: http://{host}:{post}")
  uvicorn.run("main:app", host=host, port=post, reload=True)