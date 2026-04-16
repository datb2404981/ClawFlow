# 🗺️ BẢN ĐỒ DỰ ÁN CLAWFLOW & NHẬT KÝ (Project Map & Changelog)

*Lưu ý cho AI: Hãy đọc kỹ cấu trúc này để hiểu dự án. BẮT BUỘC cập nhật phần "📝 Nhật ký thay đổi" mỗi khi bạn thêm file, xóa file, hoặc cài thư viện mới.*

## 📂 Cấu trúc thư mục (Directory Structure)

### 1. `/Frontend`
- *(Hiện tại đang là thư mục trống - chờ khởi tạo project)*

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

*(Lưu ý: `/Backend` và `/Frontend` hiện tại chưa được bắt đầu code. Dưới đây là kiến trúc dự kiến sẽ được triển khai cho Backend)*

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

- **[Cài đặt Thư viện]**: Đã cài đặt thành công `langchain-ollama` để hỗ trợ kết nối Leader Agent với model Ollama cục bộ.

- **[Thêm Skill Giám Sát]**: Đã tạo file kỹ năng chuyên biệt `realtime_update_map.md` cài cắm vào thư mục `.agents/skills/` yêu cầu AI bắt buộc đồng bộ code và Map theo thời gian thực.

- **[Khởi tạo Requirements]**: Xuất danh sách các thư viện Python hiện tại ra file `AI_Core/requirements.txt`.
- **[Giới hạn Log]**: Cập nhật quy tắc giới hạn độ dài của file log (tối đa 10 mục) để file không bị quá dài.

- **[Tối ưu Token]**: Thêm luật bắt buộc AI phải tham khảo `project_map.md` thay vì tự động cào toàn bộ thư mục mỗi khi nhận yêu cầu sửa code.
- **[Cập nhật Rule]**: Bổ sung luật số 4 vào `agents.md` bắt buộc AI phải ghi log mỗi khi có thay đổi về logic code.
- **[Cập nhật project_map]**: Chỉnh sửa file để phản ánh sự thật là `/Frontend` và `/Backend` hiện đang trống, phần cấu trúc kia là (Dự kiến).
- **[Bổ sung Kiến trúc]**: Thêm phần "Bản đồ kiến trúc dự án" để định hình rõ cấu trúc thư mục module (NestJS) của Backend.
- **[Cập nhật project_map]**: Đồng bộ nội dung `project_map.md` với cấu trúc thực tế của mã nguồn (`AI_Core` chứa `Agents`, `Tools`, `main.py`).
- **[Thêm Frontend]**: Đã khởi tạo thư mục `/Frontend` bằng React (Vite) + TypeScript. Cài đặt `react-router-dom` và `socket.io-client`. Cập nhật lại luật cho AI.
- **[Khởi tạo Hệ thống]**: Đã định hình kiến trúc Monorepo, tạo các file cấu hình AI (`agents.md`, `project_map.md`), thiết lập `.gitignore`.
