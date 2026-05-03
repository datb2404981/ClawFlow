import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

function resolveApiBase(): string {
  const full = import.meta.env.VITE_API_URL?.trim()
  if (full) return full.replace(/\/$/, '')
  const host = import.meta.env.VITE_API_BASE_URL?.trim()
  if (host) return `${host.replace(/\/$/, '')}/api/v1`
  if (import.meta.env.DEV) {
    /**
     * Mặc định gọi thẳng Nest (8080) — proxy Vite `/api/v1` dễ lỗi/ giới hạn với
     * multipart lớn (tải knowledge, v.v.). CORS: Nest đã `enableCors({ origin: true })`.
     * Muốn dùng lại proxy: `VITE_DEV_API_PROXY=1` trong `Frontend/.env` → `/api/v1`.
     */
    if (import.meta.env.VITE_DEV_API_PROXY === '1') {
      return '/api/v1'
    }
    const p = import.meta.env.VITE_NEST_PORT?.trim() || '8080'
    return `http://localhost:${p}/api/v1`
  }
  return 'http://localhost:8080/api/v1'
}

export const API_BASE = resolveApiBase()

/** Origin HTTP của Nest (Socket.IO không dùng prefix /api/v1). */
export function resolveWsOrigin(): string {
  const fromEnv = import.meta.env.VITE_WS_ORIGIN?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  
  const base = API_BASE.replace(/\/$/, '')
  // Nếu base là đường dẫn tương đối (vd: /api/v1), nghĩa là đang dùng Proxy
  if (base.startsWith('/')) {
    if (typeof window !== 'undefined') {
      // Trong môi trường Dev, nếu dùng proxy, ta vẫn nên trỏ Socket thẳng về cổng của Nest (8080)
      if (import.meta.env.DEV) {
        const p = import.meta.env.VITE_NEST_PORT?.trim() || '8080'
        return `http://localhost:${p}`
      }
      return window.location.origin
    }
    return ''
  }
  try {
    return new URL(base).origin
  } catch {
    return ''
  }
}

if (import.meta.env.DEV && /:8000(\/|$)/.test(API_BASE)) {
  console.warn(
    '[ClawFlow] API đang trỏ cổng 8000 (thường là AI_Core). NestJS + Google OAuth chạy trên 8080. Tạo Frontend/.env với:\n' +
      'VITE_API_URL=http://localhost:8080/api/v1',
  )
}

export const ACCESS_TOKEN_KEY = 'openclaw_access_token'
const TOKEN_KEY = ACCESS_TOKEN_KEY

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (config.data instanceof FormData) {
    if (config.headers instanceof AxiosHeaders) {
      config.headers.setContentType(false)
    } else {
      delete (config.headers as { 'Content-Type'?: string })['Content-Type']
    }
  }
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function setAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

/** Luồng OAuth Google: redirect GET tới backend (Passport). */
export function getGoogleAuthUrl(): string {
  return `${API_BASE}/auth/google`
}
