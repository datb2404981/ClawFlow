import { api } from './client'
import type { ApiEnvelope } from './types'

export type TaskStatus =
  | 'scheduled'
  | 'in_progress'
  | 'waiting_approval'
  | 'draft_ready'
  | 'waiting_human_input'
  | 'waiting_execute_approval'
  | 'rejected'
  | 'completed'
  | 'failed'

export type TaskMessageRow = {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export type Task = {
  _id: string
  workspace_id: string
  agent_id: string
  created_by: string
  title: string
  description?: string
  status: TaskStatus
  thread_id?: string
  draft_payload?: string | null
  schedule_enabled?: boolean
  schedule_cron?: string | null
  next_run_at?: string | null
  reject_reason?: string | null
  messages?: TaskMessageRow[]
  /** Phản hồi AI sau khi task chạy (Nest/Mongo). */
  result?: string
  compiled_prompt?: string
  createdAt?: string
  updatedAt?: string
}

export type TaskChatMessage = { role: 'user' | 'assistant'; content: string }

function isChatRole(r: string): r is 'user' | 'assistant' {
  return r === 'user' || r === 'assistant'
}

/** Chuẩn hoá task → bubble chat: ưu tiên `messages[]`, fallback description + result (task cũ). */
export function taskToChatMessages(t: Task): TaskChatMessage[] {
  const rows = t.messages
  if (rows?.length) {
    return rows
      .filter((m) => {
        if (!m || typeof m.role !== 'string' || !isChatRole(m.role)) return false
        const c = String(m.content ?? '').trim()
        if (!c) return false
        if (
          m.role === 'user' &&
          (c.startsWith('[ClawFlow-internal-review]') ||
            c.includes('[SYSTEM FEEDBACK'))
        ) {
          return false
        }
        return true
      })
      .map((m) => ({
        role: m.role,
        content: String(m.content).trim(),
      }))
  }
  const out: TaskChatMessage[] = []
  const desc = (t.description ?? '').trim()
  if (desc) {
    out.push({ role: 'user', content: desc })
  }
  const res = t.result != null ? String(t.result).trim() : ''
  if (res) {
    out.push({ role: 'assistant', content: res })
  }
  return out
}

/**
 * UI hội thoại: đọc `messages` từ API hoặc fallback description/result.
 */
export async function getTaskMessages(
  taskId: string,
  workspaceId: string,
): Promise<TaskChatMessage[]> {
  const t = await fetchTask(taskId, workspaceId)
  return taskToChatMessages(t)
}

export type CreateTaskBody = {
  workspace_id: string
  agent_id: string
  title: string
  description?: string
  status?: TaskStatus
  thread_id?: string
  schedule_enabled?: boolean
  schedule_cron?: string
  next_run_at?: string
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

export async function appendTaskMessage(
  taskId: string,
  workspaceId: string,
  content: string,
): Promise<Task> {
  const { data } = await api.post<ApiEnvelope<Task>>(
    `/tasks/${taskId}/messages`,
    { content },
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}

export async function updateTask(
  taskId: string,
  workspaceId: string,
  patch: Partial<
    Pick<
      Task,
      | 'title'
      | 'description'
      | 'status'
      | 'thread_id'
      | 'agent_id'
      | 'schedule_enabled'
      | 'schedule_cron'
      | 'next_run_at'
    >
  >,
): Promise<Task> {
  const { data } = await api.patch<ApiEnvelope<Task>>(
    `/tasks/${taskId}`,
    patch,
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}

export async function humanAnswer(
  taskId: string,
  workspaceId: string,
  answer: string,
): Promise<Task> {
  const { data } = await api.post<ApiEnvelope<Task>>(
    `/tasks/${taskId}/human-answer`,
    { answer },
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}

export async function approveTask(
  taskId: string,
  workspaceId: string,
): Promise<Task> {
  const { data } = await api.post<ApiEnvelope<Task>>(
    `/tasks/${taskId}/approve`,
    {},
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}

export async function rejectTask(
  taskId: string,
  workspaceId: string,
): Promise<Task> {
  const { data } = await api.post<ApiEnvelope<Task>>(
    `/tasks/${taskId}/reject`,
    {},
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}

export async function deleteTask(
  taskId: string,
  workspaceId: string,
): Promise<void> {
  await api.delete(`/tasks/${taskId}`, {
    params: { workspace_id: workspaceId },
  })
}
