import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Clock,
  Cpu,
  EllipsisVertical,
  Pencil,
  Bell,
  Loader2,
  Layers,
  LogOut,
  Plus,
  Search,
  Settings,
  Trash2,
  Sparkles,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { ACCESS_TOKEN_KEY, setAccessToken } from '../api/client'
import { getApiErrorMessage } from '../api/errors'
import {
  createWorkspace,
  deleteWorkspace,
  fetchWorkspaces,
  type Workspace,
} from '../api/workspaces'
import { deleteAgent, fetchAgents, type Agent } from '../api/agents'
import { fetchTasks, deleteTask, type Task, type TaskStatus } from '../api/tasks'
import { BRAND_TAGLINE, SIDEBAR } from '../navigation/sidebarNav'
import { ConfirmDialog } from '../components/ConfirmDialog'

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

/** Logo rail thu gọn — ảnh nguồn lớn (apple-touch) để hiển thị sắc, tránh vỡ khi scale. */
function ClawMark({ className }: { className?: string }) {
  return (
    <img
      src="/apple-touch-icon.png"
      alt=""
      width={180}
      height={180}
      draggable={false}
      className={[
        'shrink-0 select-none object-contain [image-rendering:auto]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
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

/** Avatar workspace phẳng, không bóng — menu & rail. */
const WS_AVATAR_TINTS_FLAT = [
  'bg-slate-200 text-slate-800',
  'bg-sky-100 text-sky-800',
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-amber-900',
  'bg-emerald-100 text-emerald-800',
  'bg-orange-100 text-orange-900',
] as const

function flatTintForWorkspaceId(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997
  return WS_AVATAR_TINTS_FLAT[h % WS_AVATAR_TINTS_FLAT.length]!
}

function workspaceInitial(name: string) {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

function readAuthProfileFromToken(): {
  initial: string
  displayName: string
  email: string
} {
  try {
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!t) {
      return { initial: '?', displayName: 'Tài khoản', email: '' }
    }
    const p = t.split('.')[1]
    if (!p) {
      return { initial: '?', displayName: 'Tài khoản', email: '' }
    }
    const json = JSON.parse(
      atob(p.replace(/-/g, '+').replace(/_/g, '/')),
    ) as Record<string, unknown>
    const email = typeof json.email === 'string' ? json.email : ''
    const username = typeof json.username === 'string' ? json.username : ''
    const displayName = (
      username ||
      (email ? email.split('@')[0] : '') ||
      'Tài khoản'
    ).trim() || 'Tài khoản'
    const dn =
      displayName.length > 22
        ? `${displayName.slice(0, 20)}…`
        : displayName
    return {
      initial: (displayName[0] ?? '?').toUpperCase(),
      displayName: dn,
      email,
    }
  } catch {
    return { initial: '?', displayName: 'Tài khoản', email: '' }
  }
}

export function WorkspaceAppLayout() {
  const { workspaceId = '', agentId, taskId } = useParams<{
    workspaceId: string
    agentId?: string
    taskId?: string
  }>()
  const navigate = useNavigate()
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
  /** Hàng … workspace: lưu id + tọa độ màn hình (fixed) để menu mở bên phải nút, không che tên. */
  const [wsRowMenu, setWsRowMenu] = useState<{
    id: string
    top: number
    left: number
  } | null>(null)
  const [createWsOpen, setCreateWsOpen] = useState(false)
  const [createWsName, setCreateWsName] = useState('')
  const [createWsSaving, setCreateWsSaving] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [pendingSectionScroll, setPendingSectionScroll] = useState<
    null | 'search' | 'agents' | 'tasks'
  >(null)
  const [wsMenuNotice, setWsMenuNotice] = useState<{
    tone: 'error' | 'success'
    text: string
  } | null>(null)
  const [wsDeleteTarget, setWsDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [wsDeleteLoading, setWsDeleteLoading] = useState(false)
  const [agentDeleteTarget, setAgentDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [agentDeleteLoading, setAgentDeleteLoading] = useState(false)
  const [taskDeleteTarget, setTaskDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [taskDeleteLoading, setTaskDeleteLoading] = useState(false)
  /** Mở từ icon rail (hoặc tương đương): nhấn mạnh đúng block search / agents / tasks khi chưa có agentId–taskId trên URL. */
  const [sidebarSectionFocus, setSidebarSectionFocus] = useState<
    null | 'search' | 'agents' | 'tasks'
  >(null)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)
  const workspaceListScrollRef = useRef<HTMLUListElement | null>(null)
  const wsRowMenuRef = useRef<HTMLDivElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const sidebarSearchBlockRef = useRef<HTMLDivElement>(null)
  const sidebarAgentsSectionRef = useRef<HTMLElement>(null)
  const sidebarTasksSectionRef = useRef<HTMLElement>(null)

  const q = query.trim().toLowerCase()
  /**
   * Lọc agent theo tìm kiếm, nhưng nếu không khớp tên nào (vd. user gõ để tìm task)
   * thì vẫn hiển thị cả danh sách — tránh sidebar agent trống oan.
   */
  const { displayedAgents, agentQueryNoNameMatch } = useMemo(() => {
    if (!q) {
      return { displayedAgents: agents, agentQueryNoNameMatch: false }
    }
    const matched = agents.filter((a) =>
      a.name.toLowerCase().includes(q),
    )
    if (matched.length > 0) {
      return { displayedAgents: matched, agentQueryNoNameMatch: false }
    }
    return {
      displayedAgents: agents,
      agentQueryNoNameMatch: agents.length > 0,
    }
  }, [agents, q])
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
      setAccountMenuOpen(false)
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
    if (!wsRowMenu) return
    const onScrollOrResize = () => setWsRowMenu(null)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    const listEl = workspaceListScrollRef.current
    listEl?.addEventListener('scroll', onScrollOrResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      listEl?.removeEventListener('scroll', onScrollOrResize)
    }
  }, [wsRowMenu])

  useEffect(() => {
    if (!workspaceMenuOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wsRowMenuRef.current?.contains(t)) return
      if (
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(t)
      ) {
        setWorkspaceMenuOpen(false)
        setWsRowMenu(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (wsRowMenu) {
        setWsRowMenu(null)
        return
      }
      setWorkspaceMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [workspaceMenuOpen, wsRowMenu])

  useEffect(() => {
    if (!createWsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createWsSaving) {
        e.preventDefault()
        setCreateWsOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [createWsOpen, createWsSaving])

  useEffect(() => {
    if (!accountMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [accountMenuOpen])

  useEffect(() => {
    if (!wsMenuNotice) return
    const t = window.setTimeout(() => setWsMenuNotice(null), 7000)
    return () => window.clearTimeout(t)
  }, [wsMenuNotice])

  const wname = ws?.name ?? 'Workspace'
  const authProfile = useMemo(() => readAuthProfileFromToken(), [])
  const closeWorkspaceMenu = () => {
    setWorkspaceMenuOpen(false)
    setWsRowMenu(null)
    setAccountMenuOpen(false)
  }

  const onAccountNavigate = () => {
    closeWorkspaceMenu()
  }

  const handleLogout = () => {
    setAccessToken(null)
    closeWorkspaceMenu()
    navigate('/login', { replace: true })
  }

  const runDeleteAgent = async () => {
    if (!agentDeleteTarget) return
    const { id: deletedId } = agentDeleteTarget
    setAgentDeleteLoading(true)
    try {
      await deleteAgent(deletedId)
      setAgentDeleteTarget(null)
      refresh()
      if (agentId === deletedId) {
        navigate(`${base}/dashboard`, { replace: true })
      }
    } catch (err) {
      setWsMenuNotice({
        tone: 'error',
        text: getApiErrorMessage(err, 'Không xoá được agent.'),
      })
    } finally {
      setAgentDeleteLoading(false)
    }
  }

  const runDeleteWorkspace = async () => {
    if (!wsDeleteTarget) return
    const { id } = wsDeleteTarget
    setWsDeleteLoading(true)
    setWsRowMenu(null)
    setWorkspaceMenuOpen(false)
    try {
      await deleteWorkspace(id)
      const list = await fetchWorkspaces()
      setWorkspaceList(list)
      setWsDeleteTarget(null)
      if (id === workspaceId) {
        if (list[0]) {
          navigate(`/app/w/${list[0]._id}/dashboard`, { replace: true })
        } else {
          navigate('/app', { replace: true })
        }
      }
    } catch (err) {
      setWsMenuNotice({
        tone: 'error',
        text: getApiErrorMessage(err, 'Không xoá được workspace.'),
      })
    } finally {
      setWsDeleteLoading(false)
    }
  }

  const runDeleteTask = async () => {
    if (!taskDeleteTarget || !workspaceId) return
    const { id } = taskDeleteTarget
    setTaskDeleteLoading(true)
    try {
      await deleteTask(id, workspaceId)
      setTaskDeleteTarget(null)
      refresh()
      if (taskId === id) {
        navigate(`${base}/dashboard`, { replace: true })
      }
    } catch (err) {
      setWsMenuNotice({
        tone: 'error',
        text: getApiErrorMessage(err, 'Không xoá được task.'),
      })
    } finally {
      setTaskDeleteLoading(false)
    }
  }

  const submitCreateWorkspace = async (e: FormEvent) => {
    e.preventDefault()
    const name = createWsName.trim()
    if (!name) return
    setCreateWsSaving(true)
    try {
      const n = await createWorkspace({ name })
      setCreateWsOpen(false)
      setCreateWsName('')
      setWorkspaceMenuOpen(false)
      setWsRowMenu(null)
      const list = await fetchWorkspaces()
      setWorkspaceList(list)
      navigate(`/app/w/${n._id}/dashboard`, { replace: true })
    } catch (err) {
      setWsMenuNotice({
        tone: 'error',
        text: getApiErrorMessage(err, 'Không tạo được workspace.'),
      })
    } finally {
      setCreateWsSaving(false)
    }
  }

  const expandSidebarToSection = (section: 'search' | 'agents' | 'tasks') => {
    setWorkspaceMenuOpen(false)
    setAccountMenuOpen(false)
    setSidebarSectionFocus(section)
    setPendingSectionScroll(section)
    setSidebarCollapsed(false)
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

  const workspaceMenuPanel = (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/40 bg-white p-0 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.14),0_0_0_0.5px_rgba(15,23,42,0.04)]"
      role="menu"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100/80 bg-white/95 px-3 py-2.5">
        <Link
          to="/app"
          onClick={closeWorkspaceMenu}
          className="group/head flex min-w-0 flex-1 items-center gap-2"
          title="Quản lý workspace"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50/90 ring-1 ring-sky-100/80">
            <Layers
              className="h-4 w-4 text-[#2563eb] transition group-hover/head:opacity-90"
              strokeWidth={2}
              aria-hidden
            />
          </span>
          <span
            className={[
              sectionHeadingCompact,
              'min-w-0 flex-1 truncate !leading-tight !tracking-[0.14em] group-hover/head:opacity-95',
            ].join(' ')}
          >
            {SIDEBAR.workspaceManage}
          </span>
        </Link>
        <Link
          to={`${base}/settings/workspace/new`}
          onClick={(e) => {
            e.stopPropagation()
            closeWorkspaceMenu()
          }}
          className="text-slate-500 hover:text-slate-800 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-slate-100/80"
          title="Tạo workspace mới"
          aria-label="Tạo workspace mới"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Link>
      </div>
      <ul
        ref={workspaceListScrollRef}
        className="max-h-56 min-w-0 space-y-1 overflow-y-auto px-2 py-2.5"
      >
        {workspaceList.map((w) => {
          const wActive = w._id === workspaceId
          const initial = workspaceInitial(w.name)
          const tint = flatTintForWorkspaceId(w._id)
          const rowMenu = wsRowMenu?.id === w._id
          return (
            <li key={w._id} className="group relative">
              <div
                className={[
                  'flex min-w-0 items-center gap-0.5 rounded-xl px-1.5 py-1.5 pl-2 transition-[background-color,box-shadow] duration-200',
                  wActive
                    ? 'bg-blue-50/95 shadow-[inset_0_0_0_0.5px_rgba(59,130,246,0.28)] hover:bg-sky-50/90 hover:shadow-[inset_0_0_0_0.5px_rgba(14,165,233,0.3)]'
                    : 'hover:bg-slate-50/90',
                ].join(' ')}
              >
                <Link
                  to={`/app/w/${w._id}/dashboard`}
                  onClick={closeWorkspaceMenu}
                  className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5 pr-0.5 text-left"
                  role="menuitem"
                >
                  <span
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tabular-nums',
                      wActive
                        ? 'bg-sky-200/95 text-sky-950 ring-1 ring-sky-300/50'
                        : tint,
                    ].join(' ')}
                  >
                    {initial}
                  </span>
                  <span
                    className={[
                      'min-w-0 flex-1 truncate text-[13px] leading-tight',
                      wActive
                        ? 'font-semibold text-[#1d4ed8]'
                        : 'font-medium text-slate-700',
                    ].join(' ')}
                  >
                    {w.name}
                  </span>
                </Link>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (wsRowMenu?.id === w._id) {
                        setWsRowMenu(null)
                        return
                      }
                      const r = e.currentTarget.getBoundingClientRect()
                      setWsRowMenu({ id: w._id, top: r.top, left: r.right + 6 })
                    }}
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-all duration-200',
                      wActive
                        ? 'hover:bg-sky-200/60 hover:text-sky-800'
                        : 'hover:bg-slate-200/50 hover:text-slate-600',
                      rowMenu
                        ? wActive
                          ? 'bg-sky-200/70 text-sky-800 opacity-100'
                          : 'bg-slate-200/50 text-slate-600 opacity-100'
                        : 'opacity-0 group-hover:opacity-100',
                    ].join(' ')}
                    aria-expanded={rowMenu}
                    aria-haspopup="menu"
                    aria-label="Thao tác workspace"
                  >
                    <EllipsisVertical className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )

  const accountMenuDropdown = (
    <div
      className="w-[min(18rem,calc(100vw-1.5rem))] min-w-0 overflow-hidden rounded-2xl border border-slate-200/55 bg-white p-0 shadow-none"
      role="menu"
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100/90 px-3 py-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200/90 text-sm font-semibold text-slate-700">
          {authProfile.initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {authProfile.displayName}
          </p>
          {authProfile.email ? (
            <p className="truncate text-xs text-slate-500">{authProfile.email}</p>
          ) : null}
        </div>
      </div>
      <div className="py-0.5">
        <Link
          to={`${base}/settings/app`}
          onClick={onAccountNavigate}
          className="text-slate-700 hover:bg-slate-50/80 flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
          role="menuitem"
        >
          <Settings
            className="h-4 w-4 shrink-0 text-slate-500"
            strokeWidth={1.5}
            aria-hidden
          />
          Cài đặt
        </Link>
        <button
          type="button"
          onClick={() => setAccountMenuOpen(false)}
          className="text-slate-500 flex w-full cursor-default items-center gap-2.5 px-3 py-2 text-left text-sm"
          title="Sắp ra mắt"
        >
          <Bell className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Thông báo
        </button>
      </div>
      <div className="border-t border-slate-100/90 py-0.5">
        <button
          type="button"
          onClick={handleLogout}
          className="text-red-600 hover:bg-red-50/80 flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Đăng xuất
        </button>
      </div>
    </div>
  )

  /** Menu khi gõ profile trên rail thu gọn: không bóng, kèm chuyển workspace nhanh. */
  const accountMenuDropdownRail = (
    <div
      className="w-[min(19rem,calc(100vw-1.25rem))] min-w-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-0 shadow-none"
      role="menu"
    >
      <div className="flex items-start gap-2.5 border-b border-slate-100/90 px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-200/80 text-sm font-semibold text-slate-800">
          {authProfile.initial}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-sm font-semibold text-slate-900">
            {authProfile.displayName}
          </p>
          {authProfile.email ? (
            <p className="truncate text-xs text-slate-500">{authProfile.email}</p>
          ) : null}
        </div>
      </div>
      {workspaceList.length > 0 && (
        <div className="border-b border-slate-100/80 px-1 py-1.5">
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Workspace
          </p>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {workspaceList.map((w) => {
              const wActive = w._id === workspaceId
              const initial = workspaceInitial(w.name)
              return (
                <li key={w._id}>
                  <Link
                    to={`/app/w/${w._id}/dashboard`}
                    onClick={onAccountNavigate}
                    className={[
                      'flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                      wActive
                        ? 'bg-slate-100 font-medium text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                    role="menuitem"
                  >
                    <span
                      className={[
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                        wActive
                          ? 'bg-slate-300/60 text-slate-900'
                          : flatTintForWorkspaceId(w._id),
                      ].join(' ')}
                    >
                      {initial}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div className="py-0.5">
        <Link
          to={`${base}/settings/app`}
          onClick={onAccountNavigate}
          className="text-slate-800 hover:bg-slate-50/90 flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition-colors"
          role="menuitem"
        >
          <Settings
            className="h-4 w-4 shrink-0 text-slate-500"
            strokeWidth={1.5}
            aria-hidden
          />
          Cài đặt ứng dụng
        </Link>
      </div>
      <div className="border-t border-slate-100/90 py-0.5">
        <button
          type="button"
          onClick={handleLogout}
          className="text-red-600 hover:bg-red-50/80 flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Đăng xuất
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-svh min-h-0 overflow-hidden bg-slate-50/90 text-slate-900">
      {wsMenuNotice && (
        <div
          role="alert"
          className={[
            'fixed left-1/2 top-3 z-[250] flex w-[min(32rem,calc(100%-1.5rem))] -translate-x-1/2 items-start gap-3 rounded-xl border px-3.5 py-3 text-sm shadow-lg',
            wsMenuNotice.tone === 'error'
              ? 'border-rose-200/90 bg-rose-50/95 text-rose-950'
              : 'border-emerald-200/90 bg-emerald-50/95 text-emerald-950',
          ].join(' ')}
        >
          {wsMenuNotice.tone === 'error' ? (
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
              strokeWidth={2}
              aria-hidden
            />
          ) : (
            <span
              className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
              aria-hidden
            />
          )}
          <p className="min-w-0 flex-1 leading-relaxed">{wsMenuNotice.text}</p>
          <button
            type="button"
            onClick={() => setWsMenuNotice(null)}
            className={[
              '-m-1 shrink-0 rounded-lg p-1.5 transition-colors',
              wsMenuNotice.tone === 'error'
                ? 'text-rose-600 hover:bg-rose-100/80'
                : 'text-emerald-700 hover:bg-emerald-100/80',
            ].join(' ')}
            aria-label="Đóng thông báo"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}
      {(workspaceMenuOpen || accountMenuOpen) && (
        <div
          className="pointer-events-auto fixed inset-0 z-20 cursor-default bg-slate-900/[0.18] backdrop-blur-[3px] transition-opacity"
          aria-hidden
          onClick={closeWorkspaceMenu}
        />
      )}
      <div
        className="relative z-30 h-full max-h-svh shrink-0"
      >
        <nav
          className={[
            'flex h-full min-h-0 shrink-0 flex-col border-r border-slate-200/50 transition-[width,background-color] duration-200 ease-out',
            sidebarCollapsed
              ? 'w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] bg-[#fafafa]'
              : 'w-[18rem] bg-white',
          ].join(' ')}
          aria-label="Điều hướng chính"
        >
        {!sidebarCollapsed ? (
        <>
        <div className="min-w-0 px-3 pb-0.5 pt-3">
        <Link
          to={`${base}/dashboard`}
          className="flex min-w-0 items-center gap-3.5"
          onClick={closeWorkspaceMenu}
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
        <div className="relative mt-2.5" ref={workspaceMenuRef}>
          <button
            type="button"
            onClick={() => {
              setAccountMenuOpen(false)
              setWorkspaceMenuOpen((o) => !o)
            }}
            className={[
              'flex w-full min-w-0 items-center gap-2.5 rounded-2xl border border-slate-200/35 bg-white py-2 pl-2.5 pr-2 text-left',
              'shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-[border-color,box-shadow,background-color] duration-200',
              'hover:border-blue-200/70 hover:bg-blue-50/55 hover:shadow-[0_2px_8px_-4px_rgba(37,99,235,0.1)]',
              workspaceMenuOpen
                ? 'border-blue-200/60 bg-blue-50/50 shadow-[0_2px_12px_-6px_rgba(37,99,235,0.1)]'
                : '',
            ].join(' ')}
            aria-expanded={workspaceMenuOpen}
            aria-haspopup="menu"
            title="Chuyển workspace"
          >
            <span
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums',
                flatTintForWorkspaceId(ws?._id ?? workspaceId),
              ].join(' ')}
            >
              {workspaceInitial(wname)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-slate-800">
              {wname}
            </span>
            <ChevronDown
              className={[
                'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200',
                workspaceMenuOpen ? 'rotate-180' : '',
              ].join(' ')}
              strokeWidth={2}
              aria-hidden
            />
          </button>
          {workspaceMenuOpen && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-2 min-w-0 max-w-full">
              {workspaceMenuPanel}
            </div>
          )}
        </div>
        </div>

        <div className="px-4 pt-4">
          <Link
            to={`${base}/tasks/new`}
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all duration-150 hover:bg-blue-700 hover:shadow-blue-600/30 active:translate-y-px"
          >
            <Plus className="h-4 w-4 transition-transform duration-150 group-hover:rotate-90" strokeWidth={2} />
            <span>Task mới</span>
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-6">
          <section
            ref={sidebarAgentsSectionRef}
            className={[
              'rounded-xl border p-2 transition-all duration-200',
              agentSectionEmphasized
                ? 'border-blue-200 bg-blue-50/30 ring-1 ring-blue-100/60 shadow-[0_1px_2px_rgba(37,99,235,0.04)]'
                : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50',
            ].join(' ')}
          >
            {agents.length === 0 && !q ? (
              <Link
                to={`${base}/agents/new`}
                className="focus-visible:ring-slate-900/6 flex w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200/90 bg-slate-50/60 py-2.5 text-[13px] font-semibold text-[#2563eb] transition-[background-color,box-shadow,border-color] duration-150 hover:border-blue-200/80 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2"
                title="Tạo agent mới"
              >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                Tạo agent
              </Link>
            ) : (
              <>
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
                      title="Tạo agent mới"
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
                  {agentQueryNoNameMatch && (
                    <li className="rounded-lg px-2 py-1.5 text-[11px] leading-snug text-slate-500">
                      Tìm kiếm không khớp tên agent — đang hiển thị tất cả.
                    </li>
                  )}
                  {displayedAgents.map((a) => {
                    const aActive = agentId === a._id
                    const origIdx = agents.indexOf(a)
                    const RowIcon =
                      AGENT_ROW_ICONS[
                        (origIdx >= 0 ? origIdx : 0) % AGENT_ROW_ICONS.length
                      ]
                    return (
                      <li
                        key={a._id}
                        className="flex min-w-0 items-stretch gap-0.5 rounded-lg"
                      >
                        <Link
                          to={`${base}/agents/${a._id}`}
                          className={[
                            rowItem,
                            'min-w-0 flex-1 pr-2',
                            aActive ? rowActive : rowIdle,
                          ].join(' ')}
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
                          <span className="min-w-0 flex-1 truncate">
                            {a.name}
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setAgentDeleteTarget({ id: a._id, name: a.name })
                          }}
                          disabled={
                            agentDeleteLoading || agentDeleteTarget != null
                          }
                          className="flex w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50/80 hover:text-rose-600 disabled:opacity-40"
                          title="Xoá agent"
                          aria-label={`Xoá agent ${a.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </li>
                    )
                  })}
                  {displayedAgents.length === 0 && (
                    <li className="rounded-lg px-3 py-2 text-xs text-slate-400">
                      Không khớp agent nào
                    </li>
                  )}
                </ul>
              </>
            )}
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
                  <li key={t._id} className="group/trow relative flex items-center">
                    <Link
                      to={`${base}/tasks/${t._id}`}
                      className={[
                        taskRowItem,
                        TASK_ROW_STATUS_BORDER[t.status],
                        tActive ? taskRowActive : taskRowIdle,
                        'flex-1 pr-8' // add padding right to avoid overlapping with trash icon
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setTaskDeleteTarget({ id: t._id, name: t.title })
                      }}
                      className="absolute right-1.5 flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-0 transition-all hover:bg-rose-100 hover:text-rose-600 group-hover/trow:opacity-100"
                      title="Xoá task"
                      aria-label="Xoá task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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

        <div className="mt-auto border-t border-slate-100/80 bg-white/90 px-3 py-2.5 backdrop-blur-sm">
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => {
                setWorkspaceMenuOpen(false)
                setWsRowMenu(null)
                setAccountMenuOpen((o) => !o)
              }}
              className={[
                'flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl border border-slate-200/40 bg-white/90 px-2.5 py-1.5 text-left shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-[border-color,background-color] duration-150',
                'hover:border-slate-300/50 hover:bg-white',
                accountMenuOpen
                  ? 'border-slate-300/60 ring-1 ring-slate-200/40'
                  : '',
              ].join(' ')}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              title="Tài khoản"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200/90 text-[13px] font-semibold text-slate-700"
                  aria-hidden
                >
                  {authProfile.initial}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {authProfile.displayName}
                  </p>
                  {authProfile.email ? (
                    <p className="truncate text-xs text-slate-500">
                      {authProfile.email}
                    </p>
                  ) : null}
                </div>
              </div>
              <Settings
                className="h-4 w-4 shrink-0 text-slate-500"
                strokeWidth={1.5}
                aria-hidden
              />
            </button>
            {accountMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 z-[60] mb-1.5 min-w-0 max-w-full">
                {accountMenuDropdown}
              </div>
            )}
          </div>
        </div>
        </>
        ) : (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center px-1 pb-3 pt-2">
          <Link
            to={`${base}/dashboard`}
            onClick={closeWorkspaceMenu}
            className="mt-2.5 flex h-10 w-10 shrink-0 items-center justify-center text-slate-800 transition-opacity hover:opacity-80"
            title="ClawFlow — Bảng điều khiển"
            aria-label="Về bảng điều khiển"
          >
            <ClawMark className="h-10 w-10" />
          </Link>
          <Link
            to={`${base}/tasks/new`}
            onClick={closeWorkspaceMenu}
            className={[
              'mt-2.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
              'border border-slate-200/35 bg-white/95 text-slate-500 antialiased',
              'transition-all duration-200 ease-out',
              'hover:border-slate-300/45 hover:bg-slate-50/80 hover:text-slate-800',
              'active:scale-[0.98] active:border-slate-300/50',
            ].join(' ')}
            title="Công việc mới"
            aria-label="Công việc mới"
          >
            <Plus className="h-5 w-5" strokeWidth={1.4} />
          </Link>
          <button
            type="button"
            onClick={() => expandSidebarToSection('tasks')}
            className={[
              'relative mt-[11px] flex h-10 w-10 shrink-0 items-center justify-center',
              'text-slate-400 transition-colors',
              railActiveKey === 'tasks'
                ? 'text-[#2563eb]'
                : 'hover:text-slate-600',
            ].join(' ')}
            title={taskRailTitle}
            aria-label="Lịch sử task"
          >
            <Clock className="h-6 w-6" strokeWidth={1.5} />
            {taskCountsByGroup.doing > 0 && (
              <span
                className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-[1.125rem] min-w-[1.125rem] max-w-7 items-center justify-center rounded-md border-2 border-white bg-slate-600 px-0.5 text-[9px] font-semibold tabular-nums leading-none text-white shadow-[0_0_0_0.5px_rgba(15,23,42,0.12)]"
                aria-hidden
              >
                {taskCountsByGroup.doing > 99
                  ? '99+'
                  : taskCountsByGroup.doing}
              </span>
            )}
          </button>
          <div className="min-h-0 w-full min-w-0 flex-1" />
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => {
                setWorkspaceMenuOpen(false)
                setWsRowMenu(null)
                setAccountMenuOpen((o) => !o)
              }}
              className={[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-slate-800 transition-[background-color] duration-200',
                'bg-slate-200/80 hover:bg-slate-200',
                accountMenuOpen ? 'ring-1 ring-slate-300/50' : '',
              ].join(' ')}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              title="Tài khoản & workspace"
            >
              {authProfile.initial}
            </button>
            {accountMenuOpen && (
              <div className="absolute bottom-0 left-full z-[60] ml-1.5 min-w-0 max-w-[calc(100vw-1rem)]">
                {accountMenuDropdownRail}
              </div>
            )}
          </div>
        </div>
        )}
        </nav>
        <button
          type="button"
          onClick={() => {
            closeWorkspaceMenu()
            setSidebarCollapsed((c) => !c)
          }}
          className={[
            'absolute right-0 top-[25px] z-30 box-border m-0 flex size-8 shrink-0 translate-x-1/2 items-center justify-center rounded-full',
            'appearance-none border-0 p-0 leading-none',
            'border border-slate-200/90 bg-white text-slate-700',
            'shadow-[2px_0_12px_-4px_rgba(15,23,42,0.08)]',
            'transition-[color,transform,box-shadow,background-color] duration-200',
            'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400/40',
            'active:scale-[0.97]',
          ].join(' ')}
          title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          ) : (
            <ChevronsLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          )}
        </button>
      </div>
      <div
        className={[
          'relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto',
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
      {wsRowMenu &&
        (() => {
          const w = workspaceList.find((x) => x._id === wsRowMenu.id)
          if (!w) return null
          return (
            <div
              ref={wsRowMenuRef}
              className="ring-slate-900/4 fixed z-[200] min-w-[10.75rem] rounded-lg border border-slate-200/45 bg-white/95 py-0.5 shadow-sm backdrop-blur-md ring-1"
              style={{ top: wsRowMenu.top, left: wsRowMenu.left }}
              role="menu"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Link
                to={`/app/w/${w._id}/settings/workspace`}
                onClick={() => {
                  setWsRowMenu(null)
                  closeWorkspaceMenu()
                }}
                className="hover:bg-slate-50/90 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-700"
                role="menuitem"
              >
                <Pencil
                  className="h-3.5 w-3.5 shrink-0 text-slate-500"
                  strokeWidth={1.5}
                />
                Chỉnh sửa
              </Link>
              <button
                type="button"
                className="text-rose-600 hover:bg-rose-50/70 flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs"
                onClick={() => {
                  setWsDeleteTarget({ id: w._id, name: w.name })
                  setWsRowMenu(null)
                }}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                Xoá workspace
              </button>
            </div>
          )
        })()}
      <ConfirmDialog
        open={agentDeleteTarget != null}
        title="Xoá agent?"
        description={
          agentDeleteTarget ? (
            <>
              Agent{' '}
              <span className="font-medium text-slate-800 break-all">
                “{agentDeleteTarget.name}”
              </span>{' '}
              sẽ bị gỡ khỏi workspace. Nếu còn task gắn agent, hệ thống sẽ từ
              chối — hãy xử lý task trước.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Xoá agent"
        cancelLabel="Hủy"
        onClose={() => {
          if (!agentDeleteLoading) setAgentDeleteTarget(null)
        }}
        onConfirm={() => void runDeleteAgent()}
        busy={agentDeleteLoading}
        danger
      />
      <ConfirmDialog
        open={wsDeleteTarget != null}
        title="Xoá workspace?"
        description={
          wsDeleteTarget ? (
            <>
              <span className="font-medium text-slate-800 break-all">
                “{wsDeleteTarget.name}”
              </span>{' '}
              sẽ bị xoá. Dữ liệu liên quan sẽ bị ảnh hưởng. Thao tác không hoàn tác.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Xoá workspace"
        cancelLabel="Hủy"
        onClose={() => {
          if (!wsDeleteLoading) setWsDeleteTarget(null)
        }}
        onConfirm={() => void runDeleteWorkspace()}
        busy={wsDeleteLoading}
        danger
      />
      <ConfirmDialog
        open={Boolean(taskDeleteTarget)}
        title="Xoá công việc?"
        description={`Bạn có chắc chắn muốn xoá vĩnh viễn công việc "${taskDeleteTarget?.name}" không? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xoá công việc"
        cancelLabel="Hủy"
        onConfirm={runDeleteTask}
        onCancel={() => setTaskDeleteTarget(null)}
        isLoading={taskDeleteLoading}
        danger
      />
      {createWsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 border-0 bg-slate-900/30 p-0 backdrop-blur-sm"
            aria-label="Đóng"
            onClick={() => !createWsSaving && setCreateWsOpen(false)}
          />
          <form
            onSubmit={submitCreateWorkspace}
            className="ring-slate-900/[0.04] relative z-10 w-full max-w-sm rounded-xl border border-slate-200/80 bg-white p-4 shadow-lg ring-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ws-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="ws-create-title"
              className="text-sm font-semibold text-slate-900"
            >
              Tạo workspace
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Nhập tên workspace mới, sau đó chuyển tới bảng điều khiển.
            </p>
            <input
              value={createWsName}
              onChange={(e) => setCreateWsName(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-slate-300 focus:ring-1 focus:ring-slate-200/80"
              placeholder="Tên workspace"
              autoFocus
              disabled={createWsSaving}
              autoComplete="off"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !createWsSaving && setCreateWsOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={createWsSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {createWsSaving && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                )}
                Tạo
              </button>
            </div>
          </form>
        </div>
      )}
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
