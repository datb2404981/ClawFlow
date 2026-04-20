# 🗺️ BẢN ĐỒ DỰ ÁN CLAWFLOW & NHẬT KÝ (Project Map & Changelog)

*Lưu ý cho AI: Hãy đọc kỹ cấu trúc này để hiểu dự án. BẮT BUỘC cập nhật phần "📝 Nhật ký thay đổi" mỗi khi bạn thêm file, xóa file, hoặc cài thư viện mới.*

## 📂 Cấu trúc thư mục (Directory Structure)

### 1. `/Frontend` (React + Vite + TypeScript)
- `package.json`: scripts `dev`, `build`, `lint`, `preview` (Vite 8, React 19).
- `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`.
- `index.html`: HTML entry.
- `src/main.tsx`: mount React root.
- `src/App.tsx`, `src/App.css`, `src/index.css`: app mặc định từ template Vite.
- `src/assets/`: `react.svg`, `vite.svg`, `hero.png`.
- `public/`: `favicon.svg`, `icons.svg`.
- **Chạy local**: `cd Frontend && npm install && npm run dev` (mặc định thường là `http://localhost:5173`).

### 2. `/Backend`
- *(Hiện tại đang là thư mục trống - chờ khởi tạo project)*

### 3. `/AI_Core` (Python / FastAPI)
- `main.py`: Điểm khởi chạy của AI Core Server.
- `Api/`: Quản lý các cổng giao tiếp (Endpoints).
  - `chat.py`: API xử lý hội thoại (đã tích hợp APIRouter).
  - `schemas/`: Chứa các Data Contract (Pydantic Models) để validate dữ liệu đầu vào/ra (VD: `chat_schema.py`).
- `Agents/`: Chứa logic của hệ thống Multi-Agent (VD: `base_agent.py`, `leader_agent.py`).
- `Tools/`: Chứa các module Kỹ năng (Agent Skills) - công cụ cho các Agent.
- `.env`: Chứa các biến môi trường cấu hình (API keys, ports...).
- `venv/`: Môi trường ảo (Virtual Environment) của Python.

## 🏗️ Bản đồ kiến trúc dự án (Dự kiến)

*(Lưu ý: `/Frontend` đã khởi tạo Vite + React + TS; `/Backend` vẫn trống. Đoạn dưới là kiến trúc dự kiến cho Backend.)*

Dự án này tuân theo kiến trúc module. Dưới đây là sơ đồ các thư mục quan trọng:

- `src/main.ts`: File khởi chạy ứng dụng.
- `src/modules/`: Chứa các module nghiệp vụ chính (User, Chat, Auth...).
  - `*/controllers/`: Xử lý HTTP Request/Response.
  - `*/services/`: Chứa core business logic và gọi tới Database.
  - `*/dto/`: Chứa Data Transfer Objects để validate data đầu vào.
- `src/common/`: Chứa code dùng chung.
  - `/guards`: Phân quyền (Authentication/Authorization).
  - `/filters`: Xử lý lỗi (Exception handlers).
- `src/database/`: Cấu hình kết nối DB và schema/entities.

---

## 📝 Nhật ký thay đổi (AI Update Log)
*(QUAN TRỌNG: Chỉ lưu tối đa 10 thay đổi gần nhất. Tự động xóa các dòng cũ dưới cùng nếu vượt quá)*
*AI sẽ tự động ghi chú các thay đổi vào danh sách bên dưới (Mới nhất nằm trên cùng):*

- **[Khởi tạo Frontend]**: Tạo `Frontend/` bằng `npm create vite@latest -- --template react-ts` (Vite 8, React 19, TypeScript, ESLint). Đã `npm install`; `npm run build` thành công. *(Chưa cài `react-router-dom` / `socket.io-client` — thêm khi cần.)*
- **[Cài đặt Tools]**: Tích hợp Playwright và BeautifulSoup4 vào dự án; thiết lập file thử nghiệm `tool_browser.py` để lấy dữ liệu trang web.
- **[Thêm Agent Mới]**: Khởi tạo `browser_agent.py` để chuẩn bị cho nhóm tác vụ thu thập thông tin web (Web Scraping).
- **[Cài đặt Thư viện]**: Đã cài đặt thành công `langchain-ollama` để hỗ trợ kết nối Leader Agent với model Ollama cục bộ.
- **[Thêm Skill Giám Sát]**: Đã tạo file kỹ năng chuyên biệt `realtime_update_map.md` cài cắm vào thư mục `.agents/skills/` yêu cầu AI bắt buộc đồng bộ code và Map theo thời gian thực.
- **[Khởi tạo Requirements]**: Xuất danh sách các thư viện Python hiện tại ra file `AI_Core/requirements.txt`.
- **[Giới hạn Log]**: Cập nhật quy tắc giới hạn độ dài của file log (tối đa 10 mục) để file không bị quá dài.
- **[Tối ưu Token]**: Thêm luật bắt buộc AI phải tham khảo `project_map.md` thay vì tự động cào toàn bộ thư mục mỗi khi nhận yêu cầu sửa code.
- **[Cập nhật Rule]**: Bổ sung luật số 4 vào `agents.md` bắt buộc AI phải ghi log mỗi khi có thay đổi về logic code.
- **[Bổ sung Kiến trúc]**: Thêm phần "Bản đồ kiến trúc dự án" để định hình rõ cấu trúc thư mục module (NestJS) của Backend.
