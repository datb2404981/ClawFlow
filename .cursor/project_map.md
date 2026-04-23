# 🗺️ BẢN ĐỒ DỰ ÁN CLAWFLOW & NHẬT KÝ (Project Map & Changelog)

*Lưu ý cho AI: Hãy đọc kỹ cấu trúc này để hiểu dự án. BẮT BUỘC cập nhật phần "📝 Nhật ký thay đổi" mỗi khi bạn thêm file, xóa file, hoặc cài thư viện mới.*

## 📂 Cấu trúc thư mục (Directory Structure)

### 1. `/Frontend` (React + Vite + TypeScript)
- `package.json`: scripts `dev`, `build`, `lint`, `preview` (Vite 8, React 19); phụ thuộc `react-router-dom`, `axios`; devDeps `tailwindcss`, `@tailwindcss/vite`.
- `vite.config.ts`: plugin React + Tailwind v4.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`.
- `index.html`: Google Font **Inter** (500–800); title **OpenClaw**.
- `src/main.tsx`: mount React root, import `index.css`.
- `src/App.tsx`: `BrowserRouter`, routes `/login`, `/signup`, `/app` (sau đăng nhập tạm).
- `src/api/client.ts`: Axios `baseURL` từ `VITE_API_URL` hoặc `VITE_API_BASE_URL` + `/api/v1`, `withCredentials`, Bearer từ `localStorage`, `getGoogleAuthUrl()`.
- `src/api/auth.ts`: `loginWithPassword`, `registerAccount`, `refreshSession` → khớp Nest `POST /auth/login`, `/auth/register`, `/auth/refresh`.
- `src/api/errors.ts`: `getApiErrorMessage` cho lỗi Axios/Nest.
- `src/components/icons/GoogleLogo.tsx`: logo Google 4 màu chuẩn.
- `src/index.css`: Tailwind v4 + token **OpenClaw** (Electric Blue `#0066ff`, trắng / xám nhạt), lớp `.openclaw-auth-shell` (lưới neural nhẹ), `.openclaw-glass-panel`, `.openclaw-input-field` (neumorphic nhẹ), `.openclaw-primary-btn`, `.openclaw-wordmark`.
- `src/pages/LoginPage.tsx`, `src/pages/SignUpPage.tsx`: auth kiểu SaaS tối giản — glassmorphism, bo lớn (`1.5rem`), chữ Inter đậm.
- `src/components/auth/AuthFooter.tsx`: footer glass mờ, link Electric Blue, branding OpenClaw.
- `src/App.css`: file cũ từ template (chưa dùng trong `App.tsx` hiện tại).
- `src/assets/`: `react.svg`, `vite.svg`, `hero.png`.
- `public/`: `favicon.svg`, `icons.svg`.
- **Chạy local**: `cd Frontend && npm install && npm run dev` (mặc định thường là `http://localhost:5173`).

### 2. `/Backend` (NestJS + TypeScript)
- `package.json`: NestJS 11, scripts `start:dev`, `build`, `test`, `test:e2e`; phụ thuộc chính: `@nestjs/mongoose`, `mongoose`, `@nestjs/jwt`, `@nestjs/passport`, `passport` / `passport-local` / `passport-jwt` / `passport-google-oauth20`, `bcrypt`, `class-validator`, `class-transformer`, `cookie-parser`, `@nestjs/config`.
- `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.mjs`, `.prettierrc`, `DockerFile`, `README.md`.
- `src/main.ts`: bootstrap — `cookie-parser`, CORS + `credentials`, global prefix **`api/v1`**, `ValidationPipe` (whitelist + forbidNonWhitelisted), `TransformInterceptor`.
- `src/app.module.ts`: `ConfigModule` (global, `.env`), `MongooseModule.forRootAsync` (`MONGO_URI`), import `UsersModule` từ accounts.
- `src/app.controller.ts`, `src/app.service.ts`: entry mặc định Nest.
- `src/common/config/jwt-access-secret.ts`: cấu hình JWT (access secret).
- `src/common/decorator/decorators.ts`: decorator dùng chung.
- `src/common/interceptor/transform.interceptor.ts`: bọc response API.
- `src/module/accounts/account.module.ts`: định nghĩa **`UsersModule`** (Mongoose `User`, Passport + JWT async, `AuthController` / `UsersController`, strategies JWT & Google).
- `src/module/accounts/controller/auth.controller.ts`, `users.controller.ts`: HTTP auth & user.
- `src/module/accounts/service/auth.service.ts`, `users.service.ts`: nghiệp vụ.
- `src/module/accounts/dto/create-user.dto.ts`, `update-user.dto.ts`: DTO validation.
- `src/module/accounts/schema/user.schema.ts`, `workspace.schema.ts`: schema Mongoose.
- `src/module/accounts/passport/jwt.strategy.ts`, `google.strategy.ts`: Passport strategies.
- `src/module/accounts/guard/local-auth.guard.ts`, `google-auth.guard.ts`: guards.
- `src/module/accounts/users.interface.ts`: kiểu / contract TypeScript.
- `test/`: `jest-e2e.json`, `app.e2e-spec.ts`.
- **Biến môi trường** (tham chiếu code): tối thiểu `MONGO_URI`, `PORT` (mặc định bootstrap 8080 nếu không set); thêm các biến JWT / Google OAuth theo `auth` & strategies.
- **Chạy local**: `cd Backend && npm install && npm run start:dev` (API dưới prefix `http://localhost:<PORT>/api/v1`).

### 3. `/AI_Core` (Python / FastAPI)
- `main.py`: Điểm khởi chạy của AI Core Server.
- `Api/`: Quản lý các cổng giao tiếp (Endpoints).
  - `chat.py`: API xử lý hội thoại (đã tích hợp APIRouter).
  - `schemas/`: Chứa các Data Contract (Pydantic Models) để validate dữ liệu đầu vào/ra (VD: `chat_schema.py`).
- `Agents/`: Chứa logic của hệ thống Multi-Agent (VD: `base_agent.py`, `leader_agent.py`).
- `Tools/`: Chứa các module Kỹ năng (Agent Skills) - công cụ cho các Agent.
- `.env`: Chứa các biến môi trường cấu hình (API keys, ports...).
- `venv/`: Môi trường ảo (Virtual Environment) của Python.

### Docker (gốc monorepo)
- `docker-compose.yml`: `mongodb`, `backend`, `ai_core`, `frontend` (build từ `Backend` / `AI_Core` / `Frontend`, `dockerfile: DockerFile`); `backend` set `MONGO_URI` + `JWT_SECRET` (mặc định dev nếu không có biến môi trường). **Không** bắt buộc file `.env` để `docker compose up`; muốn Google OAuth / secret riêng: tạo `.env` từ `.env.example`.
- `.env.example`: mẫu biến môi trường (file `.env` thật bị gitignore).

## 🏗️ Bản đồ kiến trúc dự án

**Backend (hiện trạng):** NestJS 11, MongoDB (Mongoose), cấu hình qua `ConfigModule` + `.env`. Module tài khoản & xác thực: `src/module/accounts/` (`UsersModule` trong `account.module.ts`) — controllers, services, DTO, Mongoose schemas, Passport (JWT, Google), guards. Tiện ích chung: `src/common/` (config JWT, decorator, interceptor). Toàn bộ REST dưới prefix **`/api/v1`**.

**Mở rộng dự kiến:** Thêm module nghiệp vụ (`src/module/<feature>/`) theo cùng pattern; bổ sung `common/filters` (exception), tách lớp repository nếu cần; có thể đồng bộ tên thư mục `module` vs `modules` theo convention team.

---

## 📝 Nhật ký thay đổi (AI Update Log)
*(QUAN TRỌNG: Chỉ lưu tối đa 10 thay đổi gần nhất. Tự động xóa các dòng cũ dưới cùng nếu vượt quá)*
*AI sẽ tự động ghi chú các thay đổi vào danh sách bên dưới (Mới nhất nằm trên cùng):*

- **[Frontend Axios + Google logo]**: Cài `axios`; `src/api/*` liên kết backend (`/auth/login`, `/auth/register`, `/auth/refresh`, redirect `/auth/google`); `LoginPage`/`SignUpPage` gọi API; logo Google SVG 4 màu; route `/app` tạm sau đăng nhập; OAuth callback `?status=success` gọi `refreshSession`.
- **[OpenClaw auth UI]**: Login/SignUp/Footer theo brief “futuristic SaaS”: nền trắng + pattern lưới neural, glass panel, input neumorphic nhẹ, Electric Blue, Inter bold; đổi branding hiển thị sang **OpenClaw** (`index.html`, `index.css`, `LoginPage`, `SignUpPage`, `AuthFooter`).
- **[Docker / .env]**: Bỏ `env_file: .env` bắt buộc (tránh lỗi khi chưa có file); thêm `JWT_SECRET` mặc định trong compose; thêm `.env.example`. Cập nhật mục Docker trong `project_map.md`.
- **[Docker Compose]**: Sửa `docker-compose.yml` đúng tên thư mục `Backend` / `Frontend` / `AI_Core`, chỉ rõ `dockerfile: DockerFile`, `MONGO_URI` → `mongodb`; Vite `--host 0.0.0.0`; AI_Core lắng nghe `HOST` (mặc định `0.0.0.0`). Cập nhật mục Docker trong `project_map.md`.
- **[Cập nhật project_map — Backend]**: Mô tả đầy đủ `/Backend` NestJS (MongoDB, JWT, Passport local/JWT/Google, module `accounts`, `api/v1`, env `MONGO_URI` / `PORT`); sửa mục kiến trúc bỏ nhận định “Backend trống”.
- **[Frontend × DESIGN.md]**: Refactor auth (`LoginPage`, `SignUpPage`, `AuthFooter`, `index.css`, `index.html`) theo `.cursor/DESIGN.md`: palette Apple, SF/system font stack, CTA `#0071e3`, input/filter button style, shadow card, bỏ gradient & hiệu ứng trang trí; body copy canh trái.
- **[Auth UI React]**: Cài `tailwindcss` + `@tailwindcss/vite`, `react-router-dom`. Thêm `LoginPage`, `SignUpPage`, `AuthFooter`, route `/login` và `/signup`.
- **[Cài đặt Tools]**: Tích hợp Playwright và BeautifulSoup4 vào dự án; thiết lập file thử nghiệm `tool_browser.py` để lấy dữ liệu trang web.
- **[Thêm Agent Mới]**: Khởi tạo `browser_agent.py` để chuẩn bị cho nhóm tác vụ thu thập thông tin web (Web Scraping).
