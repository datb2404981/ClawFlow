import { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Bolt, MessageSquare, Send } from 'lucide-react'
import { fetchAgent } from '../../api/agents'
import { fetchTask, type Task } from '../../api/tasks'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'

export function TaskWorkspacePage() {
  const { taskId = '' } = useParams()
  const { workspaceId } = useOutletContext<WsOutlet>()
  const [task, setTask] = useState<Task | null>(null)
  const [agentName, setAgentName] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!taskId || !workspaceId) return
    void (async () => {
      setErr('')
      try {
        const t = await fetchTask(taskId, workspaceId)
        setTask(t)
        const a = await fetchAgent(t.agent_id)
        setAgentName(a.name)
      } catch (e) {
        setTask(null)
        setErr(
          e instanceof Error ? e.message : 'Không tải được task',
        )
      }
    })()
  }, [taskId, workspaceId])

  if (err) {
    return <div className="p-8 text-center text-sm text-red-600">{err}</div>
  }
  if (!task) {
    return (
      <div className="p-8 text-center text-slate-500">Đang tải task…</div>
    )
  }

  return (
    <div className="flex h-svh min-h-0 min-w-0 flex-1 flex-col bg-slate-50/80">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/90 px-6 backdrop-blur">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{task.title}</h1>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            <MessageSquare className="h-4 w-4" />
            {agentName || 'Agent'}
            <span className="text-slate-300">·</span>
            <span className="text-xs uppercase tracking-wide text-amber-700">
              {task.status}
            </span>
            {task.thread_id && (
              <span className="text-xs text-slate-400">thread: {task.thread_id}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/80 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
          >
            <Bolt className="h-4 w-4 text-blue-600" />
            Automate
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        {task.description && (
          <div className="max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">
              Mô tả task
            </p>
            <p className="mt-2 leading-relaxed">{task.description}</p>
          </div>
        )}
        <div className="max-w-3xl text-sm text-slate-500">
          Chat thật với model nối ở AI_Core sau; tại đây chỉ hiển thị dữ
          liệu từ <code>GET /tasks/:id</code>.
        </div>
      </div>
      <div className="shrink-0 border-t border-slate-200/60 bg-white p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full bg-slate-100 px-2 py-2">
          <input
            className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm"
            disabled
            placeholder="Tin nhắn tới model (mắc nối AI_Core)…"
          />
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-800 text-white opacity-50"
            disabled
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
