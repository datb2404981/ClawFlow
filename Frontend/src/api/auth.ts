import { api, setAccessToken } from './client'

export type ApiEnvelope<T> = {
  statusCode: number
  message: string
  data: T
}

export type AuthPayload = {
  access_token: string
  user: {
    _id: string
    email: string
    username: string
    avatar_url?: string
  }
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<AuthPayload> {
  const { data } = await api.post<ApiEnvelope<AuthPayload>>('/auth/login', {
    email,
    password,
  })
  setAccessToken(data.data.access_token)
  return data.data
}

export async function registerAccount(body: {
  username: string
  email: string
  password: string
}): Promise<AuthPayload> {
  const { data } = await api.post<ApiEnvelope<AuthPayload>>(
    '/auth/register',
    body,
  )
  setAccessToken(data.data.access_token)
  return data.data
}

/** Sau OAuth (cookie `refresh_token` đã set), đổi lấy access token mới. */
export async function refreshSession(): Promise<AuthPayload> {
  const { data } = await api.post<ApiEnvelope<AuthPayload>>('/auth/refresh', {})
  setAccessToken(data.data.access_token)
  return data.data
}
