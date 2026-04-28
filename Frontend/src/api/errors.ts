import axios from 'axios'

/** Lấy message lỗi từ response NestJS / Axios. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    if (status === 413) {
      return (
        'Từ chối tải lên (HTTP 413): thường không phải vì tệp vượt 100MB, mà vì lớp trước (Nginx, hosting, ' +
        'Cloudflare, proxy Vite…) đặt trần dung lượng (vd. 1–10MB) nhỏ hơn file của bạn. ' +
        'Nếu dùng Nginx: tăng client_max_body_size (vd. 100M) rồi tải lại. Ứng dụng ClawFlow: tối đa 100MB mỗi tệp.'
      )
    }
    if (
      typeof err.message === 'string' &&
      /file too large|entity too large|payload too large/i.test(err.message)
    ) {
      return (
        'Dung lượng bị từ chối trên đường tới server (có thể proxy/Nginx, không liên quan dung thực tệp 100MB). ' +
        'Nếu dùng Nginx, tăng `client_max_body_size` hoặc gọi thẳng API (Vite: không bật VITE_DEV_API_PROXY=1 khi tải lớn).'
      )
    }
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
