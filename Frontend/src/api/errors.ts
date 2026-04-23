import axios from 'axios'

/** Lấy message lỗi từ response NestJS / Axios. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as
      | { message?: string | string[] }
      | undefined
    const m = d?.message
    if (Array.isArray(m)) return m.join(', ')
    if (typeof m === 'string' && m.trim()) return m
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
