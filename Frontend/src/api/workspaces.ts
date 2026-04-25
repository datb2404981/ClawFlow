import { api } from './client'
import type { ApiEnvelope } from './types'

export type Workspace = {
  _id: string
  name: string
  description?: string
  slug?: string
  is_default?: boolean
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data } = await api.get<ApiEnvelope<Workspace[]>>('/workspaces')
  return data.data
}

export async function createWorkspace(
  body: { name: string; description?: string },
): Promise<Workspace> {
  const { data } = await api.post<ApiEnvelope<Workspace>>('/workspaces', body)
  return data.data
}

export async function fetchWorkspace(id: string): Promise<Workspace> {
  const { data } = await api.get<ApiEnvelope<Workspace>>(`/workspaces/${id}`)
  return data.data
}
