import axios from 'axios'

/** Lấy message lỗi từ response NestJS / Axios. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const d = err.response?.data as
      | { message?: string | string[] }
      | undefined
    const m = d?.message
    if (Array.isArray(m) && m.length > 0) return m.join(', ')
    if (typeof m === 'string' && m.trim()) return m
    // Lỗi 5xx (502, 503...) hoặc mất kết nối → dùng fallback, không lộ URL/message kỹ thuật
    if (!status || status >= 500) return fallback
    // Lỗi 4xx có message axios → có thể hiện lên (ví dụ: "Unauthorized")
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
