import axios from 'axios'

function resolveApiBase(): string {
  const full = import.meta.env.VITE_API_URL?.trim()
  if (full) return full.replace(/\/$/, '')
  const host = import.meta.env.VITE_API_BASE_URL?.trim()
  if (host) return `${host.replace(/\/$/, '')}/api/v1`
  /** Dev: Vite proxy `vite.config` → cùng origin, tránh CORS. */
  if (import.meta.env.DEV) return '/api/v1'
  return 'http://localhost:8080/api/v1'
}

export const API_BASE = resolveApiBase()

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

api.interceptors.request.use((config) => {
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
