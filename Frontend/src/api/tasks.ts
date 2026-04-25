import { api } from './client'
import type { ApiEnvelope } from './types'

export type TaskStatus =
  | 'scheduled'
  | 'in_progress'
  | 'waiting_approval'
  | 'completed'
  | 'failed'

export type Task = {
  _id: string
  workspace_id: string
  agent_id: string
  created_by: string
  title: string
  description?: string
  status: TaskStatus
  thread_id?: string
  createdAt?: string
  updatedAt?: string
}

export type CreateTaskBody = {
  workspace_id: string
  agent_id: string
  title: string
  description?: string
  status?: TaskStatus
  thread_id?: string
}

export async function fetchTasks(
  workspaceId: string,
  opt?: { agent_id?: string; status?: TaskStatus },
): Promise<Task[]> {
  const { data } = await api.get<ApiEnvelope<Task[]>>('/tasks', {
    params: {
      workspace_id: workspaceId,
      ...opt,
    },
  })
  return data.data
}

export async function fetchTask(
  taskId: string,
  workspaceId: string,
): Promise<Task> {
  const { data } = await api.get<ApiEnvelope<Task>>(
    `/tasks/${taskId}`,
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}

export async function createTask(body: CreateTaskBody): Promise<Task> {
  const { data } = await api.post<ApiEnvelope<Task>>('/tasks', body)
  return data.data
}

export async function updateTask(
  taskId: string,
  workspaceId: string,
  patch: Partial<
    Pick<Task, 'title' | 'description' | 'status' | 'thread_id'>
  >,
): Promise<Task> {
  const { data } = await api.patch<ApiEnvelope<Task>>(
    `/tasks/${taskId}`,
    patch,
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}
