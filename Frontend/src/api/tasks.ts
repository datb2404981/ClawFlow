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
  messageId?: string
  role: 'user' | 'assistant' | 'system'
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
  if (!prev || String(prev._id ?? '') !== String(fetched._id ?? '')) {
    return fetched
  }

  // #region agent log
  const debugMerge = (stage: string, extra: Record<string, unknown> = {}) => {
    fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`merge-task:${String(fetched?._id ?? '')}`,hypothesisId:'H8',location:'Frontend/src/api/tasks.ts:31',message:stage,data:{prevLen:Array.isArray(prev?.messages)?prev?.messages?.length:0,fetchedLen:Array.isArray(fetched?.messages)?fetched?.messages?.length:0,prevStatus:prev?.status ?? '',fetchedStatus:fetched?.status ?? '',...extra},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

  // Dictionary approach: Sử dụng Map để chống lặp tin nhắn dựa trên messageId
  const msgMap = new Map<string, TaskMessageRow>()
  
  const getMsgKey = (m: TaskMessageRow, index: number) => {
    if (m.messageId) return m.messageId
    return `${m.role}_idx_${index}`
  }

  // 1. Nạp tin nhắn từ fetched (Dữ liệu từ DB)
  const fMsgs = fetched.messages || []
  fMsgs.forEach((m, idx) => {
    msgMap.set(getMsgKey(m, idx), { ...m })
  })

  // 2. Ghi đè bằng tin nhắn từ local (Để giữ nội dung đang stream dở hoặc steps mới nhất)
  const pMsgs = prev.messages || []
  pMsgs.forEach((m, idx) => {
    const key = getMsgKey(m, idx)
    const existing = msgMap.get(key)
    
    if (existing) {
      const pLen = (m.content || '').length
      const fLen = (existing.content || '').length
      if (pLen > fLen) {
        msgMap.set(key, {
          ...existing,
          content: m.content,
          steps: (m.steps && m.steps.length > 0) ? m.steps : existing.steps
        })
      }
    } else {
      msgMap.set(key, { ...m })
    }
  })

  const mergedMessages = Array.from(msgMap.values()).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return timeA - timeB
  })

  debugMerge('merge_complete_map_strategy', { finalLen: mergedMessages.length })
  return { ...fetched, messages: mergedMessages }
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
  /** Các bước xử lý đang diễn ra (Stream từ Socket) */
  steps?: string[]
  /** Phản hồi AI sau khi task chạy (Nest/Mongo). */
  result?: string
  compiled_prompt?: string
  createdAt?: string
  updatedAt?: string
}

export type TaskChatMessage = { 
  role: 'user' | 'assistant' | 'system'; 
  content: string;
  steps?: string[];
}

function isChatRole(r: string): r is 'user' | 'assistant' | 'system' {
  return r === 'user' || r === 'assistant' || r === 'system'
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
        role: m.role as 'user' | 'assistant' | 'system',
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
    if (filtered.length > 0) {
      // BƯỚC QUAN TRỌNG: Gộp task.steps (nếu có) vào tin nhắn assistant cuối cùng
      // Điều này giúp hiển thị tiến trình đang chạy từ Socket lên UI
      if (t.steps && t.steps.length > 0) {
        for (let i = filtered.length - 1; i >= 0; i--) {
          if (filtered[i].role === 'assistant') {
            const existingSteps = filtered[i].steps || [];
            // Chỉ thêm những bước chưa có
            const newSteps = [...existingSteps];
            t.steps.forEach(s => {
              if (!newSteps.includes(s)) newSteps.push(s);
            });
            filtered[i].steps = newSteps;
            break;
          }
        }
      }
      return filtered;
    }
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
  messageId?: string,
): Promise<Task> {
  const { data } = await api.post<ApiEnvelope<Task>>(
    `/tasks/${taskId}/messages`,
    { content, messageId },
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
