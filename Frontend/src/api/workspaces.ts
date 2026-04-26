import { api } from './client'
import type { ApiEnvelope } from './types'

export type TaskLane = {
  key: string
  title: string
  order: number
}

export type Workspace = {
  _id: string
  name: string
  description?: string
  slug?: string
  is_default?: boolean
  status?: 'active' | 'archived'
  plan?: 'free' | 'pro' | 'enterprise'
  token_limit?: number
  tokens_used?: number
  task_lanes?: TaskLane[]
  brand_color?: string
  logo_url?: string
  createdAt?: string
  updatedAt?: string
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data } = await api.get<ApiEnvelope<Workspace[]>>('/workspaces')
  return data.data
}

export type CreateWorkspaceBody = {
  name: string
  description?: string
}

export async function createWorkspace(
  body: CreateWorkspaceBody,
): Promise<Workspace> {
  const { data } = await api.post<ApiEnvelope<Workspace>>('/workspaces', body)
  return data.data
}

export async function fetchWorkspace(id: string): Promise<Workspace> {
  const { data } = await api.get<ApiEnvelope<Workspace>>(`/workspaces/${id}`)
  return data.data
}

export type UpdateWorkspaceBody = {
  name?: string
  description?: string
  status?: 'active' | 'archived'
  is_default?: boolean
  task_lanes?: TaskLane[]
}

export async function updateWorkspace(
  id: string,
  body: UpdateWorkspaceBody,
): Promise<Workspace> {
  const { data } = await api.patch<ApiEnvelope<Workspace>>(
    `/workspaces/${id}`,
    body,
  )
  return data.data
}

export async function deleteWorkspace(id: string): Promise<void> {
  await api.delete(`/workspaces/${id}`)
}
