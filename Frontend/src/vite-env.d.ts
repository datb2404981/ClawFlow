/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL gồm cả prefix, ví dụ: http://localhost:8080/api/v1 */
  readonly VITE_API_URL?: string
  /** Chỉ origin backend, ví dụ: http://localhost:8080 — sẽ nối thêm /api/v1 */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
