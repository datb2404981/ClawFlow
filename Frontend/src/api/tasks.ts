import { api } from './client'
import type { ApiEnvelope } from './types'

export type TaskStatus =
  | 'pending'
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
  /** Bước tiến trình (leader / tool) — stream từ socket. */
  steps?: string[]
  createdAt?: string
}

/**
 * Khi `task.status` + fetchTask chạy sát nhau, Mongo có thể chưa kịp $push assistant
 * trong khi client đã ghép chunk socket → merge để không mất bubble assistant.
 */
export function mergeTaskMessagesPreferLocal(
  prev: Task | null,
  fetched: Task,
): Task {
  // #region agent log
  const debugMerge = (stage: string, extra: Record<string, unknown> = {}) => {
    fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`merge-task:${String(fetched?._id ?? '')}`,hypothesisId:'H8',location:'Frontend/src/api/tasks.ts:31',message:stage,data:{prevLen:Array.isArray(prev?.messages)?prev?.messages?.length:0,fetchedLen:Array.isArray(fetched?.messages)?fetched?.messages?.length:0,prevStatus:prev?.status ?? '',fetchedStatus:fetched?.status ?? '',...extra},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  if (!prev || String(prev._id ?? '') !== String(fetched._id ?? '')) {
    // #region agent log
    debugMerge('direct_return_fetched_no_prev_or_id_mismatch')
    // #endregion
    return fetched
  }
  const pMsgs = prev.messages ?? []
  const fMsgs = [...(fetched.messages ?? [])]
  if (pMsgs.length === 0) return fetched

  // API đôi khi trả messages=[]/thiếu trước khi Mongo kịp ghi — không được thay bằng [assistant] mất user
  if (fMsgs.length === 0) {
    // #region agent log
    debugMerge('fetched_empty_keep_prev')
    // #endregion
    return { ...fetched, messages: pMsgs }
  }

  const msgLen = (m: TaskMessageRow | undefined) =>
    String(m?.content ?? '').trim().length

  const lastP = pMsgs[pMsgs.length - 1]
  if (lastP?.role !== 'assistant') return fetched

  const lastF = fMsgs[fMsgs.length - 1]

  if (lastF?.role === 'assistant') {
    if (msgLen(lastP) > msgLen(lastF)) {
      fMsgs[fMsgs.length - 1] = {
        ...lastF,
        content: String(lastP.content ?? ''),
        steps:
          Array.isArray(lastF.steps) && lastF.steps.length > 0
            ? lastF.steps
            : lastP.steps ?? [],
      }
    }
    // #region agent log
    debugMerge('both_assistant_return_fmsgs', { finalLen: fMsgs.length })
    // #endregion
    return { ...fetched, messages: fMsgs }
  }

  fMsgs.push({
    role: 'assistant',
    content: String(lastP.content ?? ''),
    steps: Array.isArray(lastP.steps) ? lastP.steps : [],
    createdAt: lastP.createdAt,
  })
  // #region agent log
  debugMerge('append_prev_assistant_to_fetched', { finalLen: fMsgs.length })
  // #endregion
  return { ...fetched, messages: fMsgs }
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

export type TaskChatMessage = { 
  role: 'user' | 'assistant'; 
  content: string;
  steps?: string[];
}

function isChatRole(r: string): r is 'user' | 'assistant' {
  return r === 'user' || r === 'assistant'
}

/** Chuẩn hoá task → bubble chat: ưu tiên `messages[]`, fallback description + result (task cũ). */
export function taskToChatMessages(t: Task): TaskChatMessage[] {
  const rows = t.messages
  if (rows?.length) {
    // #region agent log
    let droppedInvalidRole = 0
    let droppedEmpty = 0
    let droppedInternalUser = 0
    // #endregion
    const filtered = rows
      .filter((m) => {
        if (!m || typeof m.role !== 'string' || !isChatRole(m.role)) {
          // #region agent log
          droppedInvalidRole += 1
          // #endregion
          return false
        }
        const c = String(m.content ?? '').trim()
        const hasSteps = Array.isArray(m.steps) && m.steps.length > 0;
        if (!c && !hasSteps) {
          // #region agent log
          droppedEmpty += 1
          // #endregion
          return false
        }
        if (
          m.role === 'user' &&
          (c.startsWith('[ClawFlow-internal-review]') ||
            c.includes('[SYSTEM FEEDBACK'))
        ) {
          // #region agent log
          droppedInternalUser += 1
          // #endregion
          return false
        }
        return true
      })
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content).trim(),
        steps: Array.isArray(m.steps) ? m.steps : [],
      }))
    // #region agent log
    if (filtered.length > 0) {
      fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`task-to-chat:${String(t._id ?? '')}`,hypothesisId:'H14',location:'Frontend/src/api/tasks.ts:131',message:'task_to_chat_filter_stats',data:{rawLen:rows.length,outLen:filtered.length,droppedInvalidRole,droppedEmpty,droppedInternalUser,lastRole:filtered[filtered.length-1].role},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    // Nếu sau khi filter còn messages → dùng chúng.
    // Nếu filter hết sạch → fall through xuống dưới dùng result fallback.
    if (filtered.length > 0) return filtered
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
