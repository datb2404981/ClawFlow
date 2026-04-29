import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Bolt,
  Bot,
  Mail,
  Paperclip,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Sparkles,
  Timer,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import { fetchAgent } from '../../api/agents'
import { fetchTask, fetchTaskMessages, sendTaskMessage, type Task, type TaskMessage } from '../../api/tasks'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'

const STATUS_LINES: Record<
  Task['status'],
  { label: string; dot: string }
> = {
  scheduled: { label: 'Đã lên lịch', dot: 'bg-slate-400' },
  in_progress: { label: 'Đang chạy', dot: 'bg-sky-500' },
  waiting_approval: { label: 'Chờ duyệt', dot: 'bg-amber-500' },
  completed: { label: 'Đã hoàn thành', dot: 'bg-emerald-500' },
  failed: { label: 'Lỗi', dot: 'bg-rose-500' },
}

function TaskAutomationPanel(props: {
  open: boolean
  onClose: () => void
}) {
  const { open, onClose } = props
  const [scheduleOn, setScheduleOn] = useState(true)
  const [eventOn, setEventOn] = useState(false)

  return (
    <aside
      className={[
        'flex shrink-0 flex-col border-transparent bg-[var(--color-cf-surface-container-low,#f3f4f5)] shadow-[-20px_0_40px_rgba(25,28,29,0.03)] transition-[width,opacity,transform,margin]',
        open
          ? 'ml-0 max-md:fixed max-md:inset-y-4 max-md:right-4 max-md:z-40 max-md:w-[min(400px,calc(100%-2rem))] w-[400px]'
          : 'ml-0 w-0 overflow-hidden border-0 opacity-0 max-md:pointer-events-none',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-slate-200/40 bg-[color-mix(in_srgb,var(--color-cf-surface-container-low)_88%,transparent)] px-8 backdrop-blur-md">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--color-cf-on-surface,#191c1d)]">
          <Wand2
            className="h-[1.125rem] w-[1.125rem] text-[var(--color-cf-primary,#003ec7)]"
            aria-hidden
            strokeWidth={2}
          />
          Cấu hình tự động hoá
        </h2>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-cf-on-surface-variant,#434656)] transition-colors hover:bg-[var(--color-cf-surface-container-highest,#e1e3e4)]"
          aria-label="Đóng panel"
          onClick={onClose}
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-[var(--color-cf-surface-container-lowest,#ffffff)] p-6 shadow-[0_10px_30px_rgba(25,28,29,0.02)] ring-1 ring-slate-900/[0.04]">
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[color-mix(in_srgb,var(--color-cf-primary)_35%,transparent)] to-[color-mix(in_srgb,var(--color-cf-primary-container)_35%,transparent)]" />
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-cf-surface-container,#edeeef)] text-[var(--color-cf-primary,#003ec7)]">
                <Timer className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-cf-on-surface,#191c1d)]">
                Lịch chạy
              </h3>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={scheduleOn}
              onClick={() => setScheduleOn((v) => !v)}
              className={[
                'relative h-6 w-12 cursor-pointer rounded-full transition-colors',
                scheduleOn
                  ? 'bg-[color-mix(in_srgb,var(--color-cf-primary)_22%,transparent)]'
                  : 'bg-[var(--color-cf-surface-container-highest,#e1e3e4)]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 h-5 w-5 rounded-full bg-[var(--color-cf-primary,#003ec7)] shadow-sm transition-[left]',
                  scheduleOn ? 'left-[calc(100%-1.375rem)]' : 'left-0.5',
                  !scheduleOn && 'bg-white',
                ].join(' ')}
              />
            </button>
          </div>
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-cf-on-surface-variant,#434656)]">
                Chu kỳ
              </label>
              <div className="relative">
                <select
                  defaultValue="weekly"
                  className="w-full appearance-none rounded-xl border-none bg-[var(--color-cf-surface-container,#edeeef)] py-3 pl-4 pr-10 text-sm font-medium text-[var(--color-cf-on-surface,#191c1d)] outline-none ring-0 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-cf-primary)_35%,transparent)]"
                >
                  <option>Hàng tuần</option>
                  <option>Hàng ngày</option>
                  <option>Hàng tháng</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-cf-on-surface-variant,#434656)]">
                Ngày trong tuần
              </label>
              <div className="flex flex-wrap gap-2">
                {['T2', 'T3', 'T4', 'T5', 'T6'].map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    className={[
                      'flex h-10 min-w-[2.25rem] items-center justify-center rounded-xl px-2 text-sm font-medium transition-colors',
                      i === 0
                        ? 'bg-[var(--color-cf-primary,#003ec7)] text-white shadow-sm'
                        : 'bg-[var(--color-cf-surface-container,#edeeef)] text-[var(--color-cf-on-surface,#191c1d)] hover:bg-[var(--color-cf-surface-container-high,#e1e3e4)]',
                    ].join(' ')}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-cf-on-surface-variant,#434656)]">
                Giờ
              </label>
              <input
                type="time"
                defaultValue="09:00"
                className="w-full max-w-[12rem] rounded-xl border-none bg-[var(--color-cf-surface-container,#edeeef)] py-3 px-4 text-sm font-medium text-[var(--color-cf-on-surface,#191c1d)] outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-cf-primary)_35%,transparent)]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-[var(--color-cf-surface-container-lowest,#ffffff)] p-6 opacity-90 shadow-[0_10px_30px_rgba(25,28,29,0.02)] ring-1 ring-slate-900/[0.04] transition-opacity hover:opacity-100">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-cf-surface-container,#edeeef)] text-[var(--color-cf-on-surface-variant,#434656)]">
                <Bolt className="h-5 w-5" aria-hidden strokeWidth={2} />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-cf-on-surface,#191c1d)]">
                Theo sự kiện
              </h3>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={eventOn}
              onClick={() => setEventOn((v) => !v)}
              className={[
                'relative h-6 w-12 cursor-pointer rounded-full transition-colors',
                eventOn
                  ? 'bg-[color-mix(in_srgb,var(--color-cf-primary)_22%,transparent)]'
                  : 'bg-[var(--color-cf-surface-container-high,#e7e8e9)]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-[left]',
                  eventOn
                    ? 'left-[calc(100%-1.375rem)] bg-[var(--color-cf-primary,#003ec7)]'
                    : 'left-0.5 bg-white',
                ].join(' ')}
              />
            </button>
          </div>
          <div
            className="pointer-events-none space-y-4 opacity-80"
            aria-hidden
          >
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-cf-outline-variant)_40%,transparent)] bg-[var(--color-cf-surface-container-low,#f3f4f5)] p-4">
              <div className="mb-2 flex items-center gap-3">
                <Mail
                  className="h-[18px] w-[18px] text-[var(--color-cf-on-surface-variant,#434656)]"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="text-sm font-medium text-[var(--color-cf-on-surface,#191c1d)]">
                  Email mới
                </span>
              </div>
              <p className="pl-8 text-xs text-[var(--color-cf-on-surface-variant,#434656)]">
                Nếu tiêu đề chứa từ khoá (ví dụ)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/50 bg-[var(--color-cf-surface-container-low,#f3f4f5)] p-6">
        <button
          type="button"
          className="w-full rounded-xl bg-gradient-to-r from-[var(--color-cf-primary,#003ec7)] to-[var(--color-cf-primary-container,#0052ff)] py-4 text-base font-semibold tracking-wide text-white shadow-[0_10px_20px_rgba(0,62,199,0.18)] transition-shadow hover:shadow-[0_15px_30px_rgba(0,62,199,0.22)]"
        >
          Lưu cấu hình
        </button>
      </div>
    </aside>
  )
}

export function TaskWorkspacePage() {
  const { taskId = '', workspaceId: widFromRoute } = useParams()
  const navigate = useNavigate()
  const ctx = useOutletContext<WsOutlet>()
  /** Ưu tiên segment URL — tránh context chưa sẵn sàng trong edge case hydrate. */
  const workspaceId = widFromRoute || ctx.workspaceId
  const [task, setTask] = useState<Task | null>(null)
  const [agentName, setAgentName] = useState('')
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<TaskMessage[]>([])
  const [sending, setSending] = useState(false)
  /** Mặc định đóng: tránh overlay full màn (<md) che khu chat lúc vào trang. */
  const [panelOpen, setPanelOpen] = useState(false)
  const base = `/app/w/${workspaceId}`
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!taskId || !workspaceId) return
    void (async () => {
      setErr('')
      try {
        const t = await fetchTask(taskId, workspaceId)
        setTask(t)
        try {
          const a = await fetchAgent(t.agent_id)
          setAgentName(a.name)
        } catch {
          setAgentName('')
        }
        try {
          const msgs = await fetchTaskMessages(taskId, workspaceId)
          setMessages(msgs)
        } catch {
          setMessages([])
        }
      } catch (e) {
        setTask(null)
        setErr(e instanceof Error ? e.message : 'Không tải được task')
      }
    })()
  }, [taskId, workspaceId])

  // Cuộn xuống cuối mỗi khi danh sách tin nhắn thay đổi
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function handleSend() {
    if (!draft.trim() || sending || !task) return
    const content = draft.trim()
    setDraft('')
    setSending(true)

    // Thêm tin nhắn người dùng ngay lập tức (optimistic)
    const optimisticId = crypto.randomUUID()
    const optimisticUser: TaskMessage = {
      _id: optimisticId,
      task_id: task._id,
      workspace_id: workspaceId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      const aiMsg = await sendTaskMessage(task._id, workspaceId, content)
      // Giữ tin nhắn optimistic của user (đã được lưu trên server), chỉ thêm phản hồi AI
      setMessages((prev) => [...prev, aiMsg])
      // Cập nhật trạng thái task
      setTask((prev) => prev ? { ...prev, status: 'completed', result: aiMsg.content } : prev)
    } catch {
      // Xóa tin nhắn optimistic nếu gửi thất bại
      setMessages((prev) => prev.filter((m) => m._id !== optimisticId))
    } finally {
      setSending(false)
    }
  }

  const statusBadge = task ? STATUS_LINES[task.status] : null

  if (err) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-sm">
        <p className="max-w-sm text-red-600">{err}</p>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => navigate(`${base}/dashboard`)}
        >
          Về bảng điều khiển
        </button>
      </div>
    )
  }
  if (!task) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-[var(--color-cf-on-surface-variant,#434656)]">
        Đang tải công việc…
      </div>
    )
  }

  return (
    <div className="font-[family-name:var(--font-cf-body,Inter,sans-serif)] flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-[#f8f9fa] p-4 text-[var(--color-cf-on-surface,#191c1d)] antialiased [-webkit-font-smoothing:antialiased] md:flex-row md:gap-0">
      {panelOpen && (
        <button
          type="button"
          aria-label="Đóng panel — vùng nhấp nhẹ"
          className="fixed inset-0 z-30 bg-slate-900/35 backdrop-blur-[2px] md:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Khu chat */}
      <section
        className={[
          'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] bg-[var(--color-cf-surface-container-lowest,#ffffff)] shadow-[0_20px_40px_rgba(25,28,29,0.02)] ring-1 ring-slate-900/[0.04]',
          panelOpen ? 'md:mr-0' : '',
        ].join(' ')}
      >
        <header className="flex h-[4.75rem] shrink-0 items-center justify-between gap-3 border-b border-slate-100/90 bg-[color-mix(in_srgb,var(--color-cf-surface-container-lowest)_92%,transparent)] px-4 backdrop-blur-md sm:px-8">
          <div className="min-w-0 flex flex-col gap-1">
            <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-[var(--color-cf-on-surface,#191c1d)] sm:text-2xl">
              {task.title}
            </h1>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-cf-on-surface-variant,#434656)] sm:text-sm">
              <Sparkles
                className="h-4 w-4 shrink-0 text-[var(--color-cf-secondary,#4459a8)]"
                aria-hidden
                strokeWidth={2}
              />
              <span className="truncate">{agentName || 'Agent'}</span>
              <span className="text-slate-300">·</span>
              {statusBadge && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[var(--color-cf-secondary,#4459a8)]">
                  <span
                    className={[
                      'h-2 w-2 rounded-full',
                      statusBadge.dot,
                    ].join(' ')}
                    aria-hidden
                  />
                  {statusBadge.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              to={`${base}/tasks/new`}
              className="hidden items-center gap-2 rounded-full bg-[var(--color-cf-surface-container-highest,#e1e3e4)] px-3 py-2 text-xs font-semibold text-[var(--color-cf-on-surface,#191c1d)] transition-colors hover:bg-[var(--color-cf-outline-variant,#c3c5d9)]/40 lg:inline-flex lg:px-4 lg:text-sm lg:font-medium"
            >
              <Bolt
                className="h-[1.125rem] w-[1.125rem] shrink-0 text-[var(--color-cf-primary,#003ec7)]"
                aria-hidden
                strokeWidth={2}
              />
              Công việc mới
            </Link>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--color-cf-surface-container-highest,#e1e3e4)] px-4 py-2.5 text-sm font-medium text-[var(--color-cf-on-surface,#191c1d)] transition-colors hover:bg-[var(--color-cf-outline-variant,#c3c5d9)]/40"
              title="Tự động hoá công việc"
              onClick={() => setPanelOpen(true)}
              aria-expanded={panelOpen}
            >
              <Zap
                className="size-[1.125rem] shrink-0 text-[var(--color-cf-primary,#003ec7)] transition-transform group-hover:scale-105"
                aria-hidden
                strokeWidth={2}
              />
              Tự động hoá
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              className="rounded-full flex h-9 w-9 items-center justify-center text-[var(--color-cf-on-surface-variant,#434656)] transition-colors hover:bg-[var(--color-cf-surface-container-high,#e7e8e9)] sm:h-10 sm:w-10"
              title={panelOpen ? 'Thu panel tự động hoá' : 'Mở panel'}
              aria-expanded={panelOpen}
              aria-controls="task-automation-panel"
            >
              {panelOpen ? (
                <PanelRightClose className="h-[1.375rem] w-[1.375rem]" aria-hidden strokeWidth={2} />
              ) : (
                <PanelRightOpen className="h-[1.375rem] w-[1.375rem]" aria-hidden strokeWidth={2} />
              )}
            </button>
          </div>
        </header>

        <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto p-4 sm:p-8">
          {messages.length === 0 && (task.status === 'scheduled' || task.status === 'in_progress') && (
            /* Trạng thái chờ AI xử lý lần đầu */
            <div className="mt-6 flex w-full justify-start">
              <div className="flex max-w-[85%] gap-3 sm:max-w-3xl md:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50/80 text-indigo-600 shadow-sm sm:h-10 sm:w-10">
                  <Bot className="h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" strokeWidth={2} aria-hidden />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 pt-1 sm:pt-1.5">
                  <div className="text-[13px] font-semibold text-slate-700 sm:text-sm">
                    {agentName.trim() || 'Trợ lý AI'}
                  </div>
                  <div className="rounded-[1.5rem] rounded-tl-[0.25rem] border border-slate-100 bg-white px-5 py-3.5 shadow-sm sm:px-6 sm:py-4">
                    <div className="flex items-center gap-1.5 px-1 py-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) =>
            msg.role === 'user' ? (
              /* User message bubble */
              <div key={msg._id} className="flex w-full justify-end">
                <div className="flex max-w-[85%] justify-end sm:max-w-3xl">
                  <div className="flex min-w-0 flex-col items-end gap-2 pt-0.5">
                    <div className="rounded-[1.5rem] rounded-tr-[0.25rem] bg-slate-100 px-5 py-3.5 sm:px-6 sm:py-4">
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* AI response with markdown */
              <div key={msg._id} className="flex w-full justify-start">
                <div className="flex max-w-[85%] gap-3 sm:max-w-3xl md:gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50/80 text-indigo-600 shadow-sm sm:h-10 sm:w-10">
                    <Bot className="h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" strokeWidth={2} aria-hidden />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5 pt-1 sm:pt-1.5">
                    <div className="text-[13px] font-semibold text-slate-700 sm:text-sm">
                      {agentName.trim() || 'Trợ lý AI'}
                    </div>
                    <div className="prose prose-slate prose-sm max-w-none rounded-[1.5rem] rounded-tl-[0.25rem] border border-slate-100 bg-white px-5 py-3.5 shadow-sm sm:px-6 sm:py-4">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ),
          )}

          {/* Chỉ báo đang gửi / chờ AI */}
          {sending && (
            <div className="flex w-full justify-start">
              <div className="flex max-w-[85%] gap-3 sm:max-w-3xl md:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50/80 text-indigo-600 shadow-sm sm:h-10 sm:w-10">
                  <Bot className="h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" strokeWidth={2} aria-hidden />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 pt-1 sm:pt-1.5">
                  <div className="text-[13px] font-semibold text-slate-700 sm:text-sm">
                    {agentName.trim() || 'Trợ lý AI'}
                  </div>
                  <div className="rounded-[1.5rem] rounded-tl-[0.25rem] border border-slate-100 bg-white px-5 py-3.5 shadow-sm sm:px-6 sm:py-4">
                    <div className="flex items-center gap-1.5 px-1 py-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-2 shrink-0" aria-hidden />
        </div>

        <div className="shrink-0 bg-[var(--color-cf-surface-container-lowest,#ffffff)] p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="relative flex flex-col rounded-full bg-[var(--color-cf-surface-container-low,#f3f4f5)] px-1 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all focus-within:bg-[var(--color-cf-surface-container-lowest,#ffffff)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--color-cf-primary)_22%,transparent)] sm:flex-row sm:items-center sm:rounded-full">
            <button
              type="button"
              disabled
              className="pointer-events-none hidden h-10 w-10 shrink-0 items-center justify-center self-center rounded-full text-[var(--color-cf-on-surface-variant,#434656)] opacity-50 sm:flex"
              title="Đính kèm — sớm có"
              aria-disabled
            >
              <Paperclip className="h-5 w-5" aria-hidden strokeWidth={2} />
            </button>
            <input
              className="min-w-0 flex-1 border-none bg-transparent py-3 pl-4 pr-3 text-base text-[var(--color-cf-on-surface,#191c1d)] outline-none ring-0 placeholder:text-[color-mix(in_srgb,var(--color-cf-on-surface-variant)_55%,transparent)]"
              placeholder={
                agentName
                  ? `Nhắn tới ${agentName}…`
                  : 'Nhắn tới agent…'
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              disabled={sending}
            />
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-cf-primary,#003ec7)] text-white shadow-md transition-colors hover:bg-[var(--color-cf-primary-container,#0052ff)] disabled:opacity-50 sm:mr-0.5"
              disabled={sending || !draft.trim()}
              aria-label="Gửi tin nhắn"
              title="Gửi"
              onClick={() => void handleSend()}
            >
              <Send className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
            </button>
          </div>
          <div className="mt-3 text-center text-[0.65rem] font-medium uppercase tracking-widest text-[var(--color-cf-on-surface-variant,#434656)]">
            AI có thể sai sót · Hãy kiểm tra thông tin quan trọng.
          </div>
        </div>
      </section>

      <div
        id="task-automation-panel"
        className="flex min-h-0 min-w-0 transition-[flex]"
      >
        <TaskAutomationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </div>
    </div>
  )
}
