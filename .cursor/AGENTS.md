# 🤖 CLAWFLOW AGENT RULES (Quy tắc cho Trợ lý AI)

## 📌 Tổng quan dự án (Project Overview)
- **Tên dự án**: ClawFlow (Siêu ứng dụng AI đa thể thức)
- **Kiến trúc**: Monorepo (Frontend React, Backend NestJS, AI_Core Python)
- **Mục tiêu**: Xây dựng hệ thống Multi-Agent có thể điều khiển trình duyệt, đọc hiểu PDF/Hình ảnh, giao tiếp Real-time qua WebSockets.

## 🛠 Công nghệ cốt lõi (Tech Stack)
- **Frontend**: ReactJS (Vite), TypeScript, Tailwind CSS (nếu có), Socket.io-client.
- **Backend**: NestJS, TypeScript, WebSockets (Socket.io).
- **AI_Core**: Python 3.x, FastAPI, LangGraph, Playwright, Gemini API.

## 🛡️ Tiêu chuẩn Bảo mật & Tối ưu (Strict Rules - BẮT BUỘC)
1. **Bảo mật Biến môi trường**: Tuyệt đối không Hardcode API Key. React dùng `import.meta.env`, Backend dùng `process.env`.
2. **Chống rò rỉ bộ nhớ (Memory Leak) ở Frontend**: Khi dùng WebSockets (`socket.io-client`) hoặc `useEffect` trong React, BẮT BUỘC phải có hàm `cleanup` (ngắt kết nối socket) khi Component bị hủy (unmount).
3. **An toàn dữ liệu AI**: Dữ liệu từ AI_Core trả về có thể chứa mã độc (XSS), Frontend khi render text/HTML phải kiểm tra an toàn.

## 🧩 Tính nhất quán của Code (Code Consistency)
1. **Frontend (ReactJS)**:
   - Dùng Functional Component và React Hooks. Tuyệt đối KHÔNG dùng Class Component.
   - Luôn định nghĩa `interface` hoặc `type` cho Props và State.
   - Tách nhỏ UI thành các Component tái sử dụng (Atomic Design).
2. **Backend (NestJS)**: Tuân thủ OOP, Dependency Injection, DTO, Strict Type.
3. **AI_Core (Python)**: Dùng Type Hinting, Pydantic, PEP8.

## 🔄 Quy trình làm việc tự động (Workflow)
1. **[ĐỌC MAP TRƯỚC KHI CODE]**: Khi nhận nhiệm vụ cần tìm hiểu hay chỉnh sửa mã nguồn, BẮT BUỘC phải đọc file `project_map.md` trước để nắm cấu trúc thư mục, TUYỆT ĐỐI KHÔNG tự động quét toàn bộ source code tránh lãng phí thời gian và token.
2. Giải thích giải pháp bằng **Tiếng Việt** ngắn gọn trước khi xuất code.
3. Code đi từng bước, chia file rõ ràng.
4. **[QUAN TRỌNG]**: Mọi thay đổi về cấu trúc, file mới, thư viện mới, MI BẮT BUỘC tự động cập nhật vào file `project_map.md`.
5. **[NHẬT KÝ THAY ĐỔI]**: Mọi thay đổi code/tính năng, BẮT BUỘC phải viết log vào "📝 Nhật ký thay đổi" trong `project_map.md`. *Lưu ý: Chỉ giữ tối đa 10 log gần nhất, tự động xóa mục cũ nhất nếu vượt quá 10.*