<div align="center">
  <h1>🚀 ClawFlow</h1>
  <p><b>Hệ sinh thái Đa Tác Vụ (Multi-Agent) Thông Minh & Tự Động Hóa</b></p>
  
  [![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  [![LangGraph](https://img.shields.io/badge/LangGraph-000000?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain.com/)
</div>

---

## 🌟 Giới thiệu

**ClawFlow** là một nền tảng Agentic Workflow mạnh mẽ, kết hợp giữa **Kiến trúc Đa tác tử (Multi-Agent)** và **Tự động hóa quy trình (Task Automation)**. Dự án được thiết kế để xử lý các luồng công việc phức tạp, cung cấp khả năng tư duy tự chủ cho AI với cơ chế kiểm soát linh hoạt từ con người (Human-in-the-loop).

ClawFlow mang lại một giao diện làm việc hiện đại, kết nối trực tiếp với backend xử lý hàng đợi mạnh mẽ và lõi AI sử dụng các mô hình ngôn ngữ lớn tiên tiến nhất.

---

## ✨ Tính năng nổi bật

- 🤖 **Multi-Agent Architecture (LangGraph):** Hệ thống nhiều đặc vụ AI tự phối hợp (Leader Agent, Memory Agent, v.v.) để giải quyết các tác vụ phức tạp một cách tự chủ.
- 📧 **Smart Email & Calendar Assistant:** Tích hợp trực tiếp Google Workspace (OAuth2) cho phép AI đọc, phân tích và phản hồi email hoặc lên lịch họp.
- ⏸️ **Human-in-the-loop (HITL):** Cơ chế phê duyệt thông minh (Action Cards) ngay trên giao diện trước khi AI thực thi các hành động quan trọng (gửi email, xóa dữ liệu).
- 🧠 **AI Reasoning Visibility:** Hiển thị minh bạch "chuỗi suy nghĩ" (Thought Process) của AI theo thời gian thực (Streaming) giúp người dùng dễ dàng theo dõi cách AI ra quyết định.
- ⚡ **Real-time Task Execution:** Cập nhật trạng thái công việc tức thời qua WebSockets.
- 📚 **RAG & Document Processing:** Trích xuất và phân tích văn bản từ nhiều định dạng file (PDF, Docx, Image) với OCR và Vector Database.

---

## 🛠 Tech Stack

### 🎨 Frontend (Client)
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **Icons & UI:** Lucide React, Simple Icons
- **Network:** Axios, Socket.io-client
- **Markdown:** React Markdown, Remark GFM

### ⚙️ Backend (API & Task Queue)
- **Framework:** NestJS v11 + TypeScript
- **Database:** MongoDB (Mongoose)
- **Queueing:** Redis + BullMQ
- **Realtime:** Socket.io (WebSockets)
- **Auth:** Passport.js (JWT, Google OAuth2)
- **Files:** Multer, Tesseract.js (OCR), PDF-parse, Mammoth

### 🧠 AI Core (LLM & Agents)
- **Framework:** FastAPI, Uvicorn (Python 3)
- **Orchestration:** LangGraph, LangChain
- **LLM Provider:** Ollama (Local Models), Google GenAI
- **Tools Integration:** Tavily Search, Playwright (Web scraping)
- **Observability:** LangSmith

### 🐳 Infrastructure
- **Containerization:** Docker & Docker Compose

---

## 🏗 Kiến trúc hệ thống

1. **Frontend** gửi yêu cầu (REST API) hoặc kết nối WebSocket đến Backend.
2. **Backend (NestJS)** quản lý Auth, phân phối các tác vụ nặng vào **Redis Queue (BullMQ)**.
3. Các tác vụ liên quan đến AI sẽ được Backend gửi qua HTTP/REST tới **AI Core (FastAPI)**.
4. **AI Core** kích hoạt luồng LangGraph, giao tiếp với các công cụ ngoài (Gmail, Web Search) và phản hồi kết quả trực tiếp hoặc thông qua Backend.
5. **WebSockets** liên tục đẩy trạng thái mới nhất từ Backend về lại Frontend cho người dùng.

---

## 🚀 Hướng dẫn cài đặt (Getting Started)

### 📋 Yêu cầu hệ thống
- **Node.js** (v20+)
- **Python** (3.10+)
- **Docker** & **Docker Compose**
- **Ollama** (Nếu chạy Local LLM)

### 1. Clone dự án & Cấu hình môi trường

```bash
git clone <your-repo-url>
cd ClawFlow

# Copy file .env
cp Backend/.env.example Backend/.env
```
*Lưu ý: Mở file `Backend/.env` và cập nhật các biến môi trường cần thiết (MongoDB URI, JWT Secret, Google OAuth Keys, v.v.)*

### 2. Khởi chạy bằng Docker (Khuyên dùng)

Dự án cung cấp file `docker-compose.yml` để dựng toàn bộ hệ thống (Bao gồm Frontend, Backend, AI_Core, Redis, và MongoDB local).

```bash
# Khởi chạy tất cả các services kèm theo Local MongoDB
docker compose --profile local-db up -d --build
```
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8080
- **AI Core API:** http://localhost:8000

---

## 💻 Phát triển Local (Không dùng Docker)

Nếu bạn muốn chạy từng service riêng biệt để dễ debug:

### Khởi chạy Backend
```bash
cd Backend
npm install
npm run start:dev
```

### Khởi chạy AI Core
```bash
cd AI_Core
python3 -m venv venv
source venv/bin/activate  # Hoặc venv\Scripts\activate trên Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Khởi chạy Frontend
```bash
cd Frontend
npm install
npm run dev
```

---

## 🤝 Đóng góp (Contributing)

Chúng tôi luôn hoan nghênh các đóng góp từ cộng đồng. Hãy tạo một **Pull Request** hoặc mở một **Issue** để báo cáo lỗi và đề xuất tính năng mới.

## 📄 License

Dự án này được cấp phép theo giấy phép [MIT](LICENSE).
