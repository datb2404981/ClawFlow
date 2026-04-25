import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Folder,
  Loader2,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Users,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { fetchWorkspaces, type Workspace } from '../api/workspaces'
import { fetchAgents, type Agent } from '../api/agents'
import { fetchTasks, type Task, type TaskStatus } from '../api/tasks'
import { BRAND_TAGLINE, SIDEBAR } from '../navigation/sidebarNav'

const subIcon = { className: 'h-4 w-4 shrink-0', strokeWidth: 1.75 as const }

const AGENT_ROW_ICONS = [Bot, Cpu, Sparkles, Zap, Workflow] as const

function taskRowIcon(status: TaskStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 {...subIcon} className="h-4 w-4 shrink-0 text-emerald-500" />
    case 'failed':
      return <XCircle {...subIcon} className="h-4 w-4 shrink-0 text-rose-500" />
    case 'in_progress':
      return <Loader2 {...subIcon} className="h-4 w-4 shrink-0 animate-spin text-sky-500" />
    case 'waiting_approval':
      return <AlertCircle {...subIcon} className="h-4 w-4 shrink-0 text-amber-500" />
    case 'scheduled':
    default:
      return <Clock {...subIcon} className="h-4 w-4 shrink-0 text-slate-400" />
  }
}

const STATUS_BADGE: Record<TaskStatus, { label: string; dot: string; text: string; bg: string }> = {
  scheduled:       { label: 'Scheduled',  dot: 'bg-slate-400',    text: 'text-slate-500',   bg: 'bg-slate-100/70' },
  in_progress:     { label: 'Running',    dot: 'bg-sky-500',      text: 'text-sky-700',     bg: 'bg-sky-50' },
  waiting_approval:{ label: 'Approval',   dot: 'bg-amber-500',    text: 'text-amber-700',   bg: 'bg-amber-50' },
  completed:       { label: 'Done',       dot: 'bg-emerald-500',  text: 'text-emerald-700', bg: 'bg-emerald-50' },
  failed:          { label: 'Failed',     dot: 'bg-rose-500',     text: 'text-rose-700',    bg: 'bg-rose-50' },
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS_BADGE[status]
  return (
    <span
      className={[
        'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none shadow-[0_1px_1px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05]',
        s.bg,
        s.text,
      ].join(' ')}
    >
      <span
        className={[
          'h-1.5 w-1.5 rounded-full',
          s.dot,
          status === 'in_progress' ? 'animate-pulse' : '',
        ].join(' ')}
      />
      {s.label}
    </span>
  )
}

/** Gradient chữ brand — cùng tông với accent #2563eb và nút công việc mới (sky → blue). */
const brandGradientText =
  'bg-gradient-to-r from-[#2563eb] via-blue-600 to-sky-500 bg-clip-text text-transparent'

/** Tên app: xanh đậm trơn (kiểu Chat Nexa), không dùng gradient. */
const brandTitleText =
  'font-[family-name:var(--font-text)] text-[20px] font-bold leading-tight tracking-[-0.02em] text-[#0056b3] antialiased'
const brandTaglineText =
  'text-[9px] font-semibold uppercase leading-tight tracking-[0.2em] text-slate-500'

function BrandLogoMark({ compact }: { compact?: boolean }) {
  return (
    <img
      src="/apple-touch-icon.png"
      alt=""
      width={56}
      height={56}
      draggable={false}
      className={[
        'shrink-0 select-none rounded-lg object-contain [image-rendering:pixelated]',
        compact ? 'h-9 w-9' : 'h-14 w-14',
      ].join(' ')}
      aria-hidden
    />
  )
}

const sectionHeading = [
  'inline-block text-[12px] font-bold uppercase tracking-[0.22em] [word-spacing:0.08em]',
  brandGradientText,
].join(' ')

/** Biến thể gọn cho header có badge bên phải (tránh xuống 2 dòng). */
const sectionHeadingCompact = [
  'inline-block whitespace-nowrap text-[11.5px] font-bold uppercase tracking-[0.16em]',
  brandGradientText,
].join(' ')

const rowItem =
  'group relative flex min-w-0 items-center gap-2.5 rounded-lg py-2.5 pl-3 pr-2.5 text-[13px] text-slate-600 transition-all duration-150'
const rowIdle = 'hover:bg-slate-50 hover:text-slate-900'
const rowActive = 'bg-blue-50/80 font-medium text-[#2563eb]'

const taskRowItem =
  'group relative flex min-w-0 items-center gap-2.5 border-l-2 border-l-transparent py-2.5 pl-2.5 pr-2 text-left text-[12.5px] leading-snug text-slate-600 transition-all duration-150'
const taskRowIdle = 'hover:bg-slate-50 hover:text-slate-900'
const taskRowActive = 'bg-blue-50/80 font-medium text-[#2563eb]'

const TASK_ROW_STATUS_BORDER: Record<TaskStatus, string> = {
  scheduled: 'border-l-slate-300',
  in_progress: 'border-l-sky-500',
  waiting_approval: 'border-l-amber-500',
  completed: 'border-l-emerald-500',
  failed: 'border-l-rose-500',
}

export function WorkspaceAppLayout() {
  const { workspaceId = '', agentId, taskId } = useParams<{
    workspaceId: string
    agentId?: string
    taskId?: string
  }>()
  const [ws, setWs] = useState<Workspace | null>(null)
  const [ready, setReady] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [query, setQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('clawflow-sidebar-collapsed') === '1',
  )
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>([])
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [pendingSectionScroll, setPendingSectionScroll] = useState<
    null | 'search' | 'agents' | 'tasks'
  >(null)
  /** Mở từ icon rail (hoặc tương đương): nhấn mạnh đúng block search / agents / tasks khi chưa có agentId–taskId trên URL. */
  const [sidebarSectionFocus, setSidebarSectionFocus] = useState<
    null | 'search' | 'agents' | 'tasks'
  >(null)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)
  const sidebarSearchBlockRef = useRef<HTMLDivElement>(null)
  const sidebarAgentsSectionRef = useRef<HTMLElement>(null)
  const sidebarTasksSectionRef = useRef<HTMLElement>(null)

  const q = query.trim().toLowerCase()
  const filteredAgents = useMemo(
    () => (q ? agents.filter((a) => a.name.toLowerCase().includes(q)) : agents),
    [agents, q],
  )
  const filteredTasks = useMemo(
    () => (q ? tasks.filter((t) => t.title.toLowerCase().includes(q)) : tasks),
    [tasks, q],
  )
  const taskCountsByGroup = useMemo(() => {
    let doing = 0
    let failed = 0
    let done = 0
    for (const t of filteredTasks) {
      if (t.status === 'failed') failed += 1
      else if (t.status === 'completed') done += 1
      else doing += 1
    }
    return { doing, failed, done }
  }, [filteredTasks])

  /** Thống kê pill TASK HISTORY: scheduled / failed / done (chỉ trạng thái tương ứng). */
  const taskHistoryPillCounts = useMemo(() => {
    let scheduled = 0
    let failed = 0
    let done = 0
    for (const t of filteredTasks) {
      if (t.status === 'scheduled') scheduled += 1
      else if (t.status === 'failed') failed += 1
      else if (t.status === 'completed') done += 1
    }
    return { scheduled, failed, done }
  }, [filteredTasks])

  const taskHistoryPillsAria = [
    taskHistoryPillCounts.scheduled >= 1
      ? `Lên lịch: ${taskHistoryPillCounts.scheduled}`
      : null,
    taskHistoryPillCounts.failed >= 1
      ? `Lỗi: ${taskHistoryPillCounts.failed}`
      : null,
    taskHistoryPillCounts.done >= 1
      ? `Xong: ${taskHistoryPillCounts.done}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const taskRailTitle = `Mở task history — Đang xử lý: ${taskCountsByGroup.doing} · Hủy/lỗi: ${taskCountsByGroup.failed} · Xong: ${taskCountsByGroup.done}`

  const agentGroupActive = Boolean(agentId)
  const taskGroupActive = Boolean(taskId)
  /** Khi URL có agent/task, không dùng focus từ icon rail (tránh cạnh tranh) — dùng suy diễn, không cần effect. */
  const displayFocus: null | 'search' | 'agents' | 'tasks' =
    agentId || taskId ? null : sidebarSectionFocus
  const railActiveKey: null | 'search' | 'agents' | 'tasks' =
    displayFocus ?? (agentId ? 'agents' : taskId ? 'tasks' : null)
  const agentSectionEmphasized =
    displayFocus === 'agents' || (displayFocus == null && agentGroupActive)
  const taskSectionEmphasized =
    displayFocus === 'tasks' || (displayFocus == null && taskGroupActive)
  const searchSectionEmphasized = displayFocus === 'search'

  const base = `/app/w/${workspaceId}`

  const refresh = () => {
    if (!workspaceId) return
    void (async () => {
      setAgents(await fetchAgents(workspaceId))
      setTasks((await fetchTasks(workspaceId)).slice(0, 30))
    })()
  }

  useEffect(() => {
    if (!workspaceId) return
    void (async () => {
      const list = await fetchWorkspaces()
      setWorkspaceList(list)
      const own = list.find((w) => w._id === workspaceId) ?? null
      setWs(own)
      if (own) {
        try {
          setAgents(await fetchAgents(workspaceId))
          setTasks((await fetchTasks(workspaceId)).slice(0, 30))
        } catch {
          setAgents([])
          setTasks([])
        }
      } else {
        setAgents([])
        setTasks([])
      }
      setReady(true)
    })()
  }, [workspaceId])

  useEffect(() => {
    localStorage.setItem(
      'clawflow-sidebar-collapsed',
      sidebarCollapsed ? '1' : '0',
    )
  }, [sidebarCollapsed])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setWorkspaceMenuOpen(false)
    }, 0)
    return () => window.clearTimeout(t)
  }, [agentId, taskId, workspaceId])

  useEffect(() => {
    if (sidebarCollapsed || !pendingSectionScroll) return
    const id = window.setTimeout(() => {
      const el =
        pendingSectionScroll === 'search'
          ? sidebarSearchBlockRef.current
          : pendingSectionScroll === 'agents'
            ? sidebarAgentsSectionRef.current
            : sidebarTasksSectionRef.current
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (pendingSectionScroll === 'search') {
        const input = sidebarSearchBlockRef.current?.querySelector('input')
        window.setTimeout(() => input?.focus(), 120)
      }
      setPendingSectionScroll(null)
    }, 0)
    return () => window.clearTimeout(id)
  }, [sidebarCollapsed, pendingSectionScroll])

  useEffect(() => {
    if (!workspaceMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(e.target as Node)
      ) {
        setWorkspaceMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWorkspaceMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [workspaceMenuOpen])

  const wname = ws?.name ?? 'Workspace'
  const closeWorkspaceMenu = () => {
    setWorkspaceMenuOpen(false)
  }

  const expandSidebarToSection = (section: 'search' | 'agents' | 'tasks') => {
    setWorkspaceMenuOpen(false)
    setSidebarSectionFocus(section)
    setPendingSectionScroll(section)
    setSidebarCollapsed(false)
  }

  const railKeyClass = (key: 'search' | 'agents' | 'tasks') => {
    const on = railActiveKey === key
    return [
      'relative z-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors duration-200',
      on
        ? 'bg-blue-50 text-[#2563eb] ring-1 ring-blue-200/80'
        : 'hover:bg-slate-100 hover:text-slate-800',
    ].join(' ')
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-slate-500">
        Đang tải…
      </div>
    )
  }

  if (workspaceId && !ws) {
    return (
      <div className="p-8 text-slate-600">
        <p>Workspace không tồn tại hoặc bạn không có quyền.</p>
        <Link to="/app" className="mt-2 inline-block text-sm text-sky-600">
          Về trang chọn workspace
        </Link>
      </div>
    )
  }

  const workspaceMenuItems = (
    <>
      <p className="px-2.5 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        Chọn workspace
      </p>
      <ul className="max-h-52 overflow-y-auto">
        {workspaceList.map((w) => {
          const wActive = w._id === workspaceId
          return (
            <li key={w._id}>
              <Link
                to={`/app/w/${w._id}/dashboard`}
                onClick={closeWorkspaceMenu}
                className={[
                  'mx-0.5 flex min-w-0 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm',
                  wActive
                    ? 'bg-blue-50 font-medium text-[#2563eb]'
                    : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')}
                role="menuitem"
              >
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                {wActive && (
                  <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mx-0.5 my-1.5 h-px bg-slate-100" />
      <Link
        to="/app"
        onClick={closeWorkspaceMenu}
        className="mx-0.5 flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
        role="menuitem"
      >
        <Settings2
          className="h-3.5 w-3.5 shrink-0 text-slate-400"
          strokeWidth={1.5}
        />
        Tất cả workspace & cài đặt
      </Link>
    </>
  )

  return (
    <div className="flex h-svh min-h-0 overflow-hidden bg-slate-50/90 text-slate-900">
      <div
        className="relative h-full max-h-svh shrink-0"
      >
        <nav
          className={[
            'flex h-full min-h-0 shrink-0 flex-col border-r border-slate-100 bg-white transition-[width] duration-200 ease-out',
            sidebarCollapsed ? 'w-16' : 'w-[18rem]',
          ].join(' ')}
          aria-label="Điều hướng chính"
        >
        {!sidebarCollapsed ? (
        <>
        <div className="min-w-0 px-3 pb-0.5 pt-3">
        <Link
          to={`${base}/dashboard`}
          className="flex min-w-0 items-center gap-3.5"
          onClick={() => {
            setWorkspaceMenuOpen(false)
          }}
          title="Trang chào mừng (home)"
        >
          <BrandLogoMark />
          <div className="min-w-0 flex flex-col">
            <span className={brandTitleText}>ClawFlow</span>
            <span className={['mt-0.5', brandTaglineText].join(' ')}>
              {BRAND_TAGLINE}
            </span>
          </div>
        </Link>
        </div>

        <div className="px-4 pt-4">
          <Link
            to={`${base}/tasks/new`}
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all duration-150 hover:bg-blue-700 hover:shadow-blue-600/30 active:translate-y-px"
          >
            <Plus className="h-4 w-4 transition-transform duration-150 group-hover:rotate-90" strokeWidth={2} />
            <span>Công việc mới</span>
          </Link>
        </div>

        <div
          className={[
            'px-4 pt-4 transition-shadow duration-200',
            searchSectionEmphasized
              ? 'rounded-xl pb-1 ring-2 ring-[#2563eb]/20 ring-offset-2 ring-offset-white'
              : '',
          ].join(' ')}
          ref={sidebarSearchBlockRef}
        >
          <label className="group relative flex items-center">
            <Search
              className="pointer-events-none absolute left-3 h-[1.15rem] w-[1.15rem] text-slate-500 transition-colors group-focus-within:text-[#2563eb]"
              strokeWidth={2}
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm agent, task…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-[13px] text-slate-700 placeholder:text-slate-400 transition-all duration-150 focus:border-[#2563eb] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              aria-label="Tìm kiếm sidebar"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Xóa tìm kiếm"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </label>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-5">
          <section
            ref={sidebarAgentsSectionRef}
            className={[
              'rounded-xl border p-2 transition-all duration-200',
              agentSectionEmphasized
                ? 'border-blue-200 bg-blue-50/30 ring-1 ring-blue-100/60 shadow-[0_1px_2px_rgba(37,99,235,0.04)]'
                : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50',
            ].join(' ')}
          >
            <div>
              <div className="flex items-center justify-between gap-2 py-1.5 pl-1 pr-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Bot
                    className={[
                      'h-5 w-5 shrink-0 transition-colors',
                      agentSectionEmphasized
                        ? 'text-[#2563eb]'
                        : 'text-slate-600',
                    ].join(' ')}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <h2 className={sectionHeading}>{SIDEBAR.agents}</h2>
                </div>
                <Link
                  to={`${base}/agents/new`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-[background-color,color,transform] duration-150 hover:bg-slate-100/90 hover:text-[#2563eb] active:scale-95"
                  title="Tạo agent"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                </Link>
              </div>
              <hr
                className="mx-0 mb-0 -mt-[5px] border-0 border-t border-slate-100/80"
                role="separator"
              />
            </div>
            <ul className="space-y-0.5 pt-0.5">
              {filteredAgents.map((a) => {
                const aActive = agentId === a._id
                const origIdx = agents.indexOf(a)
                const RowIcon =
                  AGENT_ROW_ICONS[
                    (origIdx >= 0 ? origIdx : 0) % AGENT_ROW_ICONS.length
                  ]
                return (
                  <li key={a._id}>
                    <Link
                      to={`${base}/agents/${a._id}`}
                      className={[rowItem, aActive ? rowActive : rowIdle].join(' ')}
                    >
                      {aActive && (
                        <span
                          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[#2563eb]"
                          aria-hidden
                        />
                      )}
                      <RowIcon
                        className={[
                          'h-4 w-4 shrink-0 transition-colors',
                          aActive
                            ? 'text-[#2563eb]'
                            : 'text-slate-500 group-hover:text-slate-700',
                        ].join(' ')}
                        strokeWidth={1.9}
                      />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    </Link>
                  </li>
                )
              })}
              {filteredAgents.length === 0 && (
                <li className="rounded-lg px-3 py-2 text-xs text-slate-400">
                  {q ? 'Không khớp agent nào' : 'Chưa có agent'}
                </li>
              )}
            </ul>
          </section>

          <section
            ref={sidebarTasksSectionRef}
            className={[
              'rounded-xl border p-2.5 transition-[border-color,background-color,box-shadow,ring] duration-200',
              taskSectionEmphasized
                ? 'border-blue-200/90 bg-blue-50/50 ring-1 ring-blue-100/70 shadow-md shadow-blue-500/[0.06]'
                : 'border-slate-200/60 bg-slate-50/40 shadow-[0_1px_0_rgba(0,0,0,0.04)]',
            ].join(' ')}
          >
            <div
              className="mb-2 flex cursor-default items-center justify-between gap-2 rounded-lg border-b border-slate-100/80 py-1.5 pl-1 pr-1"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center !transition-none">
                  <Clock
                    className={[
                      'h-5 w-5 shrink-0 !transition-none',
                      taskSectionEmphasized
                        ? 'text-[#2563eb]'
                        : 'text-slate-600',
                    ].join(' ')}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
                <h2
                  className={[
                    sectionHeadingCompact,
                    '!transition-none hover:!opacity-100',
                  ].join(' ')}
                >
                  {SIDEBAR.taskHistory}
                </h2>
              </div>
              <div
                className="flex min-h-[1.25rem] shrink-0 select-none items-center justify-end gap-1.5"
                role="group"
                aria-label={taskHistoryPillsAria || 'Không có thống kê hiển thị (toàn 0)'}
                title="Chỉ hiện khi số ≥ 1: lên lịch (slate) · lỗi (đỏ) · xong (lá)"
              >
                {taskHistoryPillCounts.scheduled >= 1 && (
                  <span
                    className="inline-flex size-5 shrink-0 cursor-default items-center justify-center rounded-full bg-slate-500/15 p-0 text-[10px] font-medium leading-none tabular-nums text-slate-700"
                    title="Lên lịch (scheduled)"
                  >
                    {taskHistoryPillCounts.scheduled}
                  </span>
                )}
                {taskHistoryPillCounts.failed >= 1 && (
                  <span
                    className="inline-flex size-5 shrink-0 cursor-default items-center justify-center rounded-full bg-red-500/15 p-0 text-[10px] font-medium leading-none tabular-nums text-red-700"
                    title="Hủy / lỗi"
                  >
                    {taskHistoryPillCounts.failed}
                  </span>
                )}
                {taskHistoryPillCounts.done >= 1 && (
                  <span
                    className="inline-flex size-5 shrink-0 cursor-default items-center justify-center rounded-full bg-green-500/15 p-0 text-[10px] font-medium leading-none tabular-nums text-green-700"
                    title="Hoàn thành (done)"
                  >
                    {taskHistoryPillCounts.done}
                  </span>
                )}
              </div>
            </div>
            <ul className="space-y-1 pt-0.5">
              {filteredTasks.map((t) => {
                const tActive = taskId === t._id
                return (
                  <li key={t._id}>
                    <Link
                      to={`${base}/tasks/${t._id}`}
                      className={[
                        taskRowItem,
                        TASK_ROW_STATUS_BORDER[t.status],
                        tActive ? taskRowActive : taskRowIdle,
                      ].join(' ')}
                      title={`${t.title} · ${STATUS_BADGE[t.status].label}`}
                    >
                      {tActive && (
                        <span
                          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[#2563eb]"
                          aria-hidden
                        />
                      )}
                      {taskRowIcon(t.status)}
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <TaskStatusBadge status={t.status} />
                    </Link>
                  </li>
                )
              })}
              {filteredTasks.length === 0 && (
                <li className="rounded-lg px-3 py-2 text-xs text-slate-400">
                  {q ? 'Không khớp task nào' : 'Chưa có task'}
                </li>
              )}
            </ul>
          </section>
        </div>

        <div className="mt-auto border-t border-slate-100 bg-white px-2 py-2.5">
          <div className="relative" ref={workspaceMenuRef}>
            <button
              type="button"
              onClick={() => {
                setWorkspaceMenuOpen((o) => !o)
              }}
              className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-slate-100/80"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-slate-100 text-[#2563eb]">
                <Folder className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Workspace
                </p>
                <p className="truncate text-[12.5px] font-semibold leading-tight text-slate-800">
                  {wname}
                </p>
              </div>
              {workspaceMenuOpen ? (
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-slate-300"
                  strokeWidth={1.5}
                  aria-hidden
                />
              ) : (
                <ChevronUp
                  className="h-4 w-4 shrink-0 text-slate-300"
                  strokeWidth={1.5}
                  aria-hidden
                />
              )}
            </button>
            {workspaceMenuOpen && (
              <div
                className="absolute bottom-full left-0 right-0 z-40 mb-1.5 w-full min-w-0 max-w-full rounded-xl border border-slate-200/80 bg-white py-1.5 shadow-lg shadow-slate-900/5"
                role="menu"
              >
                {workspaceMenuItems}
              </div>
            )}
          </div>
        </div>
        </>
        ) : (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center px-2 pb-2 pt-2.5">
          <Link
            to={`${base}/dashboard`}
            onClick={() => {
              setWorkspaceMenuOpen(false)
            }}
            className="flex shrink-0 items-center justify-center"
            title="ClawFlow — Dashboard"
          >
            <BrandLogoMark compact />
          </Link>
          <div className="mt-2.5 flex w-full flex-col items-center gap-1 [isolation:isolate]">
          <Link
            to={`${base}/tasks/new`}
            onClick={() => setWorkspaceMenuOpen(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-500/30 transition-[transform,box-shadow] duration-150 hover:brightness-105 active:scale-[0.98]"
            title="Công việc mới"
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} />
          </Link>
          <button
            type="button"
            onClick={() => expandSidebarToSection('search')}
            className={railKeyClass('search')}
            title="Mở sidebar — tìm kiếm"
          >
            <Search className="h-5 w-5" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => expandSidebarToSection('agents')}
            className={railKeyClass('agents')}
            title="Mở sidebar — agents"
          >
            <Users className="h-5 w-5" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => expandSidebarToSection('tasks')}
            className={railKeyClass('tasks')}
            title={taskRailTitle}
          >
            <span className="relative flex h-6 w-6 items-center justify-center">
              <Clock
                className="relative z-0 h-5 w-5 shrink-0"
                strokeWidth={1.9}
              />
              {taskCountsByGroup.doing > 0 && (
                <span
                  className={[
                    'absolute -right-1.5 -top-1.5 z-20 flex h-[1.125rem] min-w-[1.125rem] max-w-8 items-center justify-center rounded-full border-2 border-white bg-slate-500 px-0.5 text-[12px] font-extrabold leading-none text-white shadow',
                    'ring-1 ring-slate-400/40',
                  ].join(' ')}
                  aria-hidden
                >
                  {taskCountsByGroup.doing > 99
                    ? '99+'
                    : taskCountsByGroup.doing}
                </span>
              )}
            </span>
          </button>
          </div>
          <div className="min-h-0 min-w-0 flex-1" />
          <div className="relative mb-0.5" ref={workspaceMenuRef}>
            <button
              type="button"
              onClick={() => {
                setWorkspaceMenuOpen((o) => !o)
              }}
              className={[
                'flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition',
                workspaceMenuOpen
                  ? 'bg-blue-50 text-[#2563eb] ring-1 ring-blue-200/80'
                  : 'hover:bg-slate-100 hover:text-[#2563eb]',
              ].join(' ')}
              title="Workspace & cài đặt"
              aria-expanded={workspaceMenuOpen}
            >
              <Folder
                className="h-5 w-5"
                strokeWidth={2}
              />
            </button>
            {workspaceMenuOpen && (
              <div
                className="absolute bottom-0 left-full z-40 ml-1.5 w-[min(16rem,70vw)] rounded-xl border border-slate-200/80 bg-white py-1.5 shadow-lg shadow-slate-900/10"
                role="menu"
              >
                {workspaceMenuItems}
              </div>
            )}
          </div>
        </div>
        )}
        </nav>
        <button
          type="button"
          onClick={() => {
            setWorkspaceMenuOpen(false)
            setSidebarCollapsed((c) => !c)
          }}
          className={[
            'absolute right-0 top-[25px] z-30 box-border m-0 flex size-8 shrink-0 translate-x-1/2 items-center justify-center rounded-full',
            'appearance-none border-0 p-0 leading-none',
            'bg-white text-[#1e3a8a] shadow-[2px_0_12px_-4px_rgba(15,23,42,0.1)]',
            'transition-[color,box-shadow,transform,filter] duration-150',
            'hover:text-[#172554] hover:shadow-md hover:shadow-slate-400/15',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600/50',
            'active:scale-[0.96]',
          ].join(' ')}
          title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn'}
          aria-label={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {sidebarCollapsed ? (
            <ChevronsRight
              className="h-4 w-4"
              strokeWidth={2.5}
              aria-hidden
            />
          ) : (
            <ChevronsLeft
              className="h-4 w-4"
              strokeWidth={2.5}
              aria-hidden
            />
          )}
        </button>
      </div>
      <div
        className={[
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto',
          /* Nội dung cách thêm chút khi rail thu gọn — tránh sát cạnh trái so với nút bật sidebar */
          sidebarCollapsed ? 'pl-2 sm:pl-3' : '',
        ].join(' ')}
      >
        <Outlet
          context={
            {
              workspaceId: workspaceId!,
              workspaceName: wname,
              agents,
              tasks,
              refresh,
            } satisfies WsOutlet
          }
        />
      </div>
    </div>
  )
}

export type WsOutlet = {
  workspaceId: string
  workspaceName: string
  agents: Agent[]
  tasks: Task[]
  refresh: () => void
}
