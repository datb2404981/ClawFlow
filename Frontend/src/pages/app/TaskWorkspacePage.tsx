import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bolt,
  Bot,
  ChevronDown,
  ChevronRight,
  Maximize2,
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

function AgentMessageContent({ content }: { content: string }) {
  let thought = '';
  let mainContent = content;

  const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/);
  if (thoughtMatch) {
    thought = thoughtMatch[1].trim();
    mainContent = content.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();
  }

  const [thoughtOpen, setThoughtOpen] = useState(false);

  return (
    <div className="w-full">
      {thought && (
        <details 
          className="mb-4 group [&_summary::-webkit-details-marker]:hidden"
          open={thoughtOpen}
          onToggle={(e) => setThoughtOpen(e.currentTarget.open)}
        >
          <summary className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 group-open:bg-slate-200 transition-colors">
              {thoughtOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
            Thought Process
          </summary>
          <div className="mt-3 rounded-xl bg-slate-50/50 p-4 text-sm text-slate-600 border border-slate-100">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={TASK_CHAT_MD_COMPONENTS}>
              {thought}
            </ReactMarkdown>
          </div>
        </details>
      )}
      {mainContent && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={TASK_CHAT_MD_COMPONENTS}>
          {mainContent}
        </ReactMarkdown>
      )}
    </div>
  );
}

import { fetchAgent, fetchAgents, type Agent } from '../../api/agents'
import {
  appendTaskMessage,
  fetchTask,
  taskToChatMessages,
  type Task,
} from '../../api/tasks'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'
import { TASK_CHAT_MD_COMPONENTS } from './taskChatMarkdown'

const STATUS_LINES: Partial<
  Record<Task['status'], { label: string; dot: string }>
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
  const [sending, setSending] = useState(false)
  const [composerFsOpen, setComposerFsOpen] = useState(false)
  /** Mặc định đóng: tránh overlay full màn (<md) che khu chat lúc vào trang. */
  const [panelOpen, setPanelOpen] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const composerTaRef = useRef<HTMLTextAreaElement>(null)
  const modalComposerTaRef = useRef<HTMLTextAreaElement>(null)
  const agentPickerRef = useRef<HTMLButtonElement>(null)
  const agentPopoverRef = useRef<HTMLDivElement>(null)
  const base = `/app/w/${workspaceId}`

  useEffect(() => {
    if (!taskId || !workspaceId) return
    void (async () => {
      setErr('')
      try {
        const t = await fetchTask(taskId, workspaceId)
        setTask(t)
        try {
          const a = await fetchAgent(t.agent_id, workspaceId)
          setSelectedAgent(a)
          setAgentName(a.name)
        } catch {
          setSelectedAgent(null)
          setAgentName('')
        }
      } catch (e) {
        setTask(null)
        setErr(e instanceof Error ? e.message : 'Không tải được task')
      }
    })()
  }, [taskId, workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    let mounted = true
    void (async () => {
      try {
        const list = await fetchAgents(workspaceId)
        if (mounted) setAgents(list)
      } catch {
        if (mounted) setAgents([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [workspaceId])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node | null
      if (!agentPickerRef.current || !agentPopoverRef.current) return
      if (agentPickerRef.current.contains(t)) return
      if (agentPopoverRef.current.contains(t)) return
      setAgentPickerOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function getInitials(name?: string) {
    if (!name) return ''
    return name
      .split(' ')
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  function handleSelectAgent(a: Agent) {
    setSelectedAgent(a)
    setAgentName(a.name)
    setAgentPickerOpen(false)
  }

  const statusBadge = task
    ? STATUS_LINES[task.status] ?? STATUS_LINES.scheduled!
    : null
  const chatMessages = task ? taskToChatMessages(task) : []

  const autoResize = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (!el) return
      el.style.height = 'auto'
      const max = composerFsOpen ? Math.floor(window.innerHeight * 0.55) : 220
      el.style.height = `${Math.min(el.scrollHeight, max)}px`
    },
    [composerFsOpen],
  )

  useLayoutEffect(() => {
    autoResize(composerTaRef.current)
  }, [draft, composerFsOpen, autoResize])

  useLayoutEffect(() => {
    if (!composerFsOpen) return
    autoResize(modalComposerTaRef.current)
  }, [draft, composerFsOpen, autoResize])

  const submitUpdate = async () => {
    const text = draft.trim()
    if (!text || !task || !workspaceId || sending) return
    setSending(true)
    try {
      const updated = await appendTaskMessage(task._id, workspaceId, text)
      setTask(updated)
      setDraft('')
      setComposerFsOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không gửi được tin nhắn')
    } finally {
      setSending(false)
    }
  }

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

        <div className="scrollbar-thin flex-1 space-y-8 overflow-y-auto p-4 sm:p-8">
          {chatMessages.length === 0 ? (
            <div className="flex w-full items-center justify-center py-10">
              <p className="text-sm italic text-slate-500">
                Chưa có nội dung hội thoại.
              </p>
            </div>
          ) : (
            chatMessages.map((msg, idx) =>
              msg.role === 'user' ? (
                <div key={idx} className="flex w-full justify-end">
                  <div className="flex max-w-[85%] justify-end sm:max-w-3xl">
                    <div className="rounded-2xl bg-white px-5 py-3.5 sm:px-6 sm:py-4 shadow-[0_10px_30px_rgba(16,24,40,0.04)]">
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={idx} className="mt-8 flex w-full justify-start">
                  <div className="flex w-full max-w-[85%] flex-col gap-2 sm:max-w-4xl">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                        <Bot className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {agentName.trim() || 'Trợ lý AI'}
                      </span>
                    </div>
                    <div className="pl-9 text-slate-800">
                      <AgentMessageContent content={msg.content} />
                    </div>
                  </div>
                </div>
              ),
            )
          )}

          {(task.status === 'scheduled' || task.status === 'in_progress') && (
            <div className="mt-2 flex w-full justify-start">
              <div className="flex max-w-[85%] gap-3 sm:max-w-3xl md:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50/80 text-indigo-600 shadow-sm sm:h-10 sm:w-10">
                  <Bot className="h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" strokeWidth={2} aria-hidden />
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
          )}

          <div className="h-6 shrink-0" aria-hidden />
        </div>

        <div className="shrink-0 px-4 pb-6 pt-2 sm:px-8 sm:pb-8 sm:pt-4">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
            <div className="relative flex w-full items-end gap-2 rounded-2xl bg-[#161B22] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.1)] ring-1 ring-white/10 transition-all focus-within:ring-2 focus-within:ring-blue-500/50">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                title="Đính kèm"
              >
                <Paperclip className="h-[18px] w-[18px]" aria-hidden strokeWidth={2} />
              </button>
              
              <textarea
                ref={composerTaRef}
                rows={1}
                className="min-h-[40px] max-h-[220px] w-full resize-none border-none bg-transparent py-2.5 text-[0.9375rem] leading-relaxed text-slate-200 outline-none ring-0 placeholder:text-slate-500"
                placeholder={agentName ? `Nhắn tới ${agentName}…` : 'Nhắn tới agent…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !sending) {
                    e.preventDefault()
                    void submitUpdate()
                  }
                }}
              />
              
              <div className="flex h-10 shrink-0 items-center gap-1 pr-1">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Phóng to ô nhập"
                  title="Phóng to"
                  onClick={() => setComposerFsOpen(true)}
                >
                  <Maximize2 className="h-4 w-4" aria-hidden strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300 disabled:opacity-40"
                  disabled={!draft.trim() || sending}
                  onClick={() => void submitUpdate()}
                  title="Gửi"
                >
                  <Send className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
                </button>
              </div>
            </div>
            <div className="mt-3 text-center text-[0.7rem] font-medium text-[var(--color-cf-on-surface-variant,#434656)]">
              AI có thể sai sót · Hãy kiểm tra thông tin quan trọng.
            </div>
          </div>
        </div>
      </section>

      {composerFsOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0d1117]/80 p-4 backdrop-blur-md sm:p-8 md:p-12 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)]"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setComposerFsOpen(false)
          }}
        >
          <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#161B22] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-4">
              <div className="text-base font-medium text-slate-200">
                Soạn thảo toàn màn hình
              </div>
              <button
                type="button"
                onClick={() => setComposerFsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" aria-hidden strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-transparent p-6 sm:p-8">
              <textarea
                ref={modalComposerTaRef}
                className="h-full w-full resize-none border-none bg-transparent text-lg leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:ring-0"
                placeholder={agentName ? `Nhắn tới ${agentName}…` : 'Soạn nội dung…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !sending) {
                    e.preventDefault()
                    void submitUpdate()
                  }
                }}
              />
            </div>
            <div className="flex shrink-0 items-center justify-between border-t border-white/5 px-6 py-4">
              <span className="text-sm text-slate-500">
                {draft.length} ký tự
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setComposerFsOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => void submitUpdate()}
                  disabled={!draft.trim() || sending}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden strokeWidth={2} />
                  Gửi tin nhắn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        id="task-automation-panel"
        className="flex min-h-0 min-w-0 transition-[flex]"
      >
        <TaskAutomationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </div>
    </div>
  )
}
