import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bolt,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Mail,
  Paperclip,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Sparkles,
  Square,
  Timer,
  X,
  Calendar,
  FileText,
  Clock3,
  Github,
  MessageSquare,
  MoreHorizontal,
} from 'lucide-react'
import { siNotion } from 'simple-icons'

function AgentMessageContent({
  content,
  liveThought,
  steps = [],
}: {
  content: string
  liveThought?: string | null
  steps?: string[]
}) {
  const { thought, body: mainContent } = extractThoughtAndBody(content)
  const mergedThought = (liveThought && liveThought.trim()) || thought
  const contentNorm = normalizeThoughtTags(content)
  const isStreaming =
    /<thought/i.test(contentNorm) && !/<\/thought>/i.test(contentNorm)
  const [thoughtOpen, setThoughtOpen] = useState(false)
  const thoughtPanelOpen = isStreaming || thoughtOpen

  const mainTrimmed = (mainContent ?? '').trim()
  const thoughtTrimmed = (mergedThought ?? '').trim()
  // Không fallback thought sang câu trả lời chính: suy luận chỉ ở panel riêng.
  const showThoughtPanel = Boolean(thoughtTrimmed)
  const proseSource = mainTrimmed
  useEffect(() => {
    // #region agent log
    if (
      /PASS|FAIL|Lý do:|Gợi ý:/i.test(content ?? '') ||
      /PASS|FAIL|Lý do:|Gợi ý:/i.test(proseSource ?? '')
    ) {
      fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:'ui-render',hypothesisId:'H4',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:56',message:'agent_message_render_contains_review_markers',data:{contentLen:(content ?? '').length,thoughtLen:(thoughtTrimmed ?? '').length,bodyLen:(mainTrimmed ?? '').length,proseHasReview:/PASS|FAIL|Lý do:|Gợi ý:/i.test(proseSource ?? '')},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
  }, [content, proseSource, thoughtTrimmed, mainTrimmed])
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:'ui-thought-visibility',hypothesisId:'H9',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:67',message:'agent_message_thought_visibility',data:{contentLen:(content ?? '').length,hasThoughtTag:/<thought/i.test(content ?? ''),thoughtLen:(thoughtTrimmed ?? '').length,isStreaming,showThoughtPanel,mainLen:(mainTrimmed ?? '').length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [content, thoughtTrimmed, isStreaming, showThoughtPanel, mainTrimmed])

  return (
    <div className="w-full space-y-4">
      {/* Gemini-like Process Tracker */}
      {steps.length > 0 && (
        <details 
          className="group/steps mb-2 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/30 transition-all"
          open={isStreaming}
        >
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100/50 list-none [&::-webkit-details-marker]:hidden">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              {isStreaming ? (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              ) : (
                <Check className="h-3 w-3" strokeWidth={3} />
              )}
            </div>
            <span>
              {isStreaming ? 'Đang thực thi các bước...' : `Đã hoàn thành ${steps.length} bước xử lý`}
            </span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open/steps:rotate-180 opacity-40" />
          </summary>
          <div className="space-y-2.5 px-3 pb-3 pt-1 border-t border-slate-100/50">
            {steps.map((step, i) => (
              <div 
                key={i} 
                className="flex items-center gap-2.5 text-[0.82rem] animate-in fade-in slide-in-from-left-2 duration-500 fill-mode-both"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                 <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                   <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3} />
                 </div>
                 <span className="text-slate-600">
                   {step}
                 </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {showThoughtPanel && (
        <details 
          className="group overflow-hidden rounded-2xl border shadow-sm transition-all [&_summary::-webkit-details-marker]:hidden"
          style={{
            background: 'var(--cf-chat-thought-bg)',
            borderColor: 'var(--cf-chat-thought-border)',
            boxShadow: 'var(--cf-chat-thought-shadow)',
          }}
          open={thoughtPanelOpen}
          onToggle={(e) => setThoughtOpen(e.currentTarget.open)}
        >
          <summary
            className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:opacity-80"
            style={{ color: 'var(--cf-chat-thought-fg)' }}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors"
                style={{ background: 'var(--cf-chat-thought-inner-bg)' }}
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--cf-electric)]" strokeWidth={2} />
              </span>
              <span className="text-[0.68rem] font-bold uppercase tracking-widest opacity-70">
                Tiến trình suy nghĩ
              </span>
              {isStreaming && (
                <span className="relative ml-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--cf-electric)] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--cf-electric)]" />
                </span>
              )}
            </span>
            <span
              className="flex h-5 w-5 items-center justify-center rounded transition-transform"
              style={{ background: 'var(--cf-chat-thought-inner-bg)' }}
            >
              {thoughtPanelOpen
                ? <ChevronDown className="h-3 w-3 opacity-50" />
                : <ChevronRight className="h-3 w-3 opacity-50" />}
            </span>
          </summary>
          <div
            className="border-t px-4 py-3.5 text-[0.88rem] leading-relaxed"
            style={{
              borderColor: 'var(--cf-chat-thought-border)',
              color: 'var(--cf-chat-thought-fg)',
              background: 'var(--cf-chat-thought-inner-bg)',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={TASK_CHAT_MD_COMPONENTS}>
              {mergedThought}
            </ReactMarkdown>
          </div>
        </details>
      )}
      {proseSource ? (
        <div className="prose max-w-none" style={{ color: 'var(--cf-chat-prose)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={TASK_CHAT_MD_COMPONENTS}>
            {proseSource}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}

import { fetchAgent, fetchAgents, type Agent } from '../../api/agents'
import {
  appendTaskMessage,
  deleteTask,
  fetchTask,
  mergeTaskMessagesPreferLocal,
  taskToChatMessages,
  type Task,
  type TaskMessageRow,
  updateTask,
} from '../../api/tasks'
import { fetchIntegrationsStatus, fetchIntegrationConnectUrl } from '../../api/appSettings'
import { resolveWsOrigin } from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'
import { extractThoughtAndBody, normalizeThoughtTags } from '../../utils/assistantDisplay'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'
import { TASK_CHAT_MD_COMPONENTS } from './taskChatMarkdown'
import { ActionCards } from '../../components/ActionCards'
import { EmailSummaryCard, parseEmailSummaryFromContent } from '../../components/EmailSummaryCard'
import { io } from 'socket.io-client'

const SystemBadge = ({ text }: { text: string }) => (
  <div className="flex justify-center my-6 animate-in fade-in zoom-in duration-500">
    <div className="flex items-center gap-2 bg-slate-100/80 backdrop-blur-sm border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-sm ring-1 ring-white/50">
      <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
      <span>{text}</span>
    </div>
  </div>
);

const STATUS_LINES: Partial<
  Record<Task['status'], { label: string; dot: string }>
> = {
  pending: { label: 'Đang xếp hàng', dot: 'bg-indigo-400' },
  scheduled: { label: 'Đã lên lịch', dot: 'bg-slate-400' },
  in_progress: { label: 'Đang chạy', dot: 'bg-sky-500' },
  waiting_approval: { label: 'Chờ duyệt', dot: 'bg-amber-500' },
  waiting_human_input: { label: 'Chờ xác nhận', dot: 'bg-amber-500' },
  waiting_execute_approval: { label: 'Chờ thực thi', dot: 'bg-blue-500' },
  completed: { label: 'Đã hoàn thành', dot: 'bg-emerald-500' },
  failed: { label: 'Lỗi', dot: 'bg-rose-500' },
}

function TaskAutomationPanel(props: {
  workspaceId: string
  open: boolean
  onClose: () => void
  scheduleOn: boolean
  setScheduleOn: Dispatch<SetStateAction<boolean>>
  cycle: string
  setCycle: Dispatch<SetStateAction<string>>
  startDate: string
  setStartDate: Dispatch<SetStateAction<string>>
  time: string
  setTime: Dispatch<SetStateAction<string>>
  interval: number
  setInterval: Dispatch<SetStateAction<number>>
  timeUnit: string
  setTimeUnit: Dispatch<SetStateAction<string>>
  handleSaveAutomation: () => Promise<void>
  sending: boolean
}) {
  const {
    workspaceId,
    open,
    onClose,
    scheduleOn,
    setScheduleOn,
    cycle,
    setCycle,
    startDate,
    setStartDate,
    time,
    setTime,
    interval,
    setInterval,
    timeUnit,
    setTimeUnit,
    handleSaveAutomation,
    sending,
  } = props
  const [eventOn, setEventOn] = useState(false)

  const [isLinked, setIsLinked] = useState(false)
  const [loadingLink, setLoadingLink] = useState(true)

  useEffect(() => {
    if (open) {
      void (async () => {
        try {
          const status = await fetchIntegrationsStatus()
          const google = status.providers.filter(p => p.provider_group === 'google')
          const connected = google.some(p => p.connection_state.connected && !p.connection_state.needs_reauth)
          setIsLinked(connected)
        } catch {
          setIsLinked(false)
        } finally {
          setLoadingLink(false)
        }
      })()
    }
  }, [open])



  const handleConnectGoogle = async () => {
    try {
      if (!workspaceId.trim()) {
        alert('Thiếu workspace — không tạo được link liên kết.')
        return
      }
      const { connect_url } = await fetchIntegrationConnectUrl(
        'gmail',
        workspaceId,
      )
      window.location.href = connect_url
    } catch (err) {
      console.error('Failed to get connect URL', err)
      alert('Không lấy được link liên kết. Vui lòng thử lại sau.')
    }
  }

  const events = [
    {
      id: 'gmail',
      title: 'Email mới',
      desc: 'Nếu tiêu đề chứa từ khoá (ví dụ)',
      icon: <Mail className="h-4 w-4" />,
      color: 'text-rose-500',
    },
    {
      id: 'calendar',
      title: 'Sự kiện lịch',
      desc: 'Khi có lời mời hoặc sự kiện mới',
      icon: <Calendar className="h-4 w-4" />,
      color: 'text-blue-500',
    },
    {
      id: 'drive',
      title: 'File mới',
      desc: 'Khi file được tải lên thư mục chọn',
      icon: <FileText className="h-4 w-4" />,
      color: 'text-amber-500',
    },
    {
      id: 'notion',
      title: 'Notion Page',
      desc: 'Khi có trang mới trong database',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d={siNotion.path} />
        </svg>
      ),
      color: 'text-slate-900',
    },
    {
      id: 'github',
      title: 'GitHub Event',
      desc: 'Khi có Pull Request hoặc Issue mới',
      icon: <Github className="h-4 w-4" />,
      color: 'text-slate-800',
    },
    {
      id: 'slack',
      title: 'Slack Message',
      desc: 'Khi có tin nhắn mới trong channel',
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'text-purple-600',
    },
  ]

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
          <Sparkles
            className="h-5 w-5 text-[var(--color-cf-primary,#003ec7)]"
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
        {/* Lịch chạy */}
        <div className="relative overflow-hidden rounded-[1.5rem] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-slate-200/50">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Timer className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <h3 className="text-[17px] font-bold text-slate-800">
                Lịch chạy
              </h3>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={scheduleOn}
              onClick={() => setScheduleOn((v) => !v)}
              className={[
                'relative flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:ring-offset-2',
                scheduleOn ? 'bg-blue-600' : 'bg-slate-200',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                  scheduleOn ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>

          <div className={['space-y-6 transition-opacity', !scheduleOn && 'pointer-events-none opacity-40'].join(' ')}>
            {/* Khối 1: Loại lịch (Schedule Type) */}
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Loại lịch
              </label>
              <div className="relative">
                <select
                  value={cycle}
                  onChange={(e) => setCycle(e.target.value)}
                  className="w-full appearance-none rounded-2xl border-none bg-slate-100 py-3.5 pl-5 pr-10 text-[15px] font-medium text-slate-800 outline-none ring-0 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="once">Một lần duy nhất</option>
                  <option value="recurring">Lặp lại định kỳ</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Khối 1b: Ngày & Giờ cho "Một lần duy nhất" */}
            {cycle === 'once' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Ngày chạy
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-2xl border-none bg-slate-100 py-3.5 px-5 text-[15px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Giờ chạy
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full rounded-2xl border-none bg-slate-100 py-3.5 px-5 text-[15px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <Clock3 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Khối 2: Cấu hình Lặp lại (Recurring) */}
            {cycle === 'recurring' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Lặp lại mỗi
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={interval}
                      onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                      className="w-24 rounded-2xl border-none bg-slate-100 py-3.5 px-5 text-center text-[15px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="relative flex-1">
                      <select
                        value={timeUnit}
                        onChange={(e) => setTimeUnit(e.target.value)}
                        className="w-full appearance-none rounded-2xl border-none bg-slate-100 py-3.5 pl-5 pr-10 text-[15px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="minutes">Phút</option>
                        <option value="hours">Giờ</option>
                        <option value="days">Ngày</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Khối 3: Cấu hình nâng cao - chỉ hiện khi đơn vị là "Ngày" */}
                {timeUnit === 'days' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Chạy vào lúc
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full rounded-2xl border-none bg-slate-100 py-3.5 px-5 text-[15px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <Clock3 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                )}

                {/* Preview */}
                <div className="rounded-xl bg-blue-50 px-4 py-3">
                  <p className="text-[13px] font-medium text-blue-700">
                    ⏱ Lặp lại mỗi{' '}
                    <span className="font-bold">{interval}</span>{' '}
                    <span className="font-bold">
                      {timeUnit === 'minutes' ? 'phút' : timeUnit === 'hours' ? 'giờ' : 'ngày'}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Theo sự kiện */}
        <div className="rounded-[1.5rem] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-slate-200/50">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Bolt className="h-5 w-5" aria-hidden strokeWidth={2} />
              </div>
              <h3 className="text-[17px] font-bold text-slate-800">
                Theo sự kiện
              </h3>
            </div>
            <div className="flex flex-col items-end gap-1">
              {!isLinked ? (
                <button
                  type="button"
                  onClick={() => void handleConnectGoogle()}
                  className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-600 transition-all hover:bg-blue-100 active:scale-95"
                >
                  Liên kết ngay
                </button>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={eventOn}
                  onClick={() => setEventOn((v) => !v)}
                  className={[
                    'relative flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:ring-offset-2',
                    eventOn ? 'bg-blue-600' : 'bg-slate-200',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                      eventOn ? 'translate-x-6' : 'translate-x-1',
                    ].join(' ')}
                  />
                </button>
              )}
              {!isLinked && !loadingLink && (
                <span className="text-[10px] font-medium text-rose-500">Yêu cầu quyền Google</span>
              )}
            </div>
          </div>

          <div className={['space-y-3 transition-all', (!eventOn || !isLinked) && 'pointer-events-none opacity-60 grayscale-[0.5]'].join(' ')}>
            {events.map((ev) => (
              <div
                key={ev.id}
                className="group relative cursor-pointer rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-blue-200 hover:bg-blue-50/30"
              >
                <div className="flex items-center gap-4">
                  <div className={['flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/50', ev.color].join(' ')}>
                    {ev.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[14px] font-bold text-slate-800">{ev.title}</h4>
                    <p className="truncate text-[12px] text-slate-500">{ev.desc}</p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-slate-200 group-hover:bg-blue-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/50 bg-[var(--color-cf-surface-container-low,#f3f4f5)] p-6">
        <button
          type="button"
          disabled={sending}
          onClick={() => void handleSaveAutomation()}
          className="w-full rounded-2xl bg-blue-600 py-4 text-[16px] font-bold tracking-wide text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)] transition-all hover:bg-blue-700 hover:shadow-[0_12px_28px_rgba(37,99,235,0.3)] active:scale-[0.98] disabled:opacity-50"
        >
          {sending ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>
    </aside>
  )
}


const NODE_STEP_LABELS: Record<string, string> = {
  leader_agent: 'Đang phân tích yêu cầu...',
  integration_agent: 'Đang thao tác với ứng dụng...',
  content_agent: 'Đang soạn thảo nội dung...',
  reviewer: 'Đang kiểm tra chất lượng...',
  tools: 'Đang thực thi công cụ...',
  memory_bootstrap: 'Đang truy xuất bộ nhớ...',
  memory_writer: 'Đang lưu trữ thông tin...',
}

export function TaskWorkspacePage() {
  const { taskId = '', workspaceId: widFromRoute } = useParams()
  const navigate = useNavigate()
  const ctx = useOutletContext<WsOutlet>()
  const refresh = ctx.refresh
  /** Ưu tiên segment URL — tránh context chưa sẵn sàng trong edge case hydrate. */
  const workspaceId = widFromRoute || ctx.workspaceId
  const [task, setTask] = useState<Task | null>(null)
  const [leaderThoughtStream, setLeaderThoughtStream] = useState('')
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scheduleBtnRef = useRef<HTMLButtonElement>(null)
  const schedulePopupRef = useRef<HTMLDivElement>(null)
  
  // Automation settings (synced with panel)
  const [scheduleOn, setScheduleOn] = useState(false)
  const [cycle, setCycle] = useState('once')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('09:00')
  const [timeUnit, setTimeUnit] = useState('minutes')
  const [interval, setInterval] = useState(5)
  const [schedulePopupOpen, setSchedulePopupOpen] = useState(false)
  const [taskMenuOpen, setTaskMenuOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const handleSaveAutomation = async () => {
    let cron = ''
    let nextRun: Date | null = null
    const now = new Date()

    if (cycle === 'recurring') {
      const val = interval || 5
      if (timeUnit === 'minutes') {
        cron = `*/${val} * * * *`
        nextRun = new Date(now.getTime() + val * 60000)
      } else if (timeUnit === 'hours') {
        cron = `0 */${val} * * *`
        nextRun = new Date(now.getTime() + val * 3600000)
      } else {
        // days
        const [hh, mm] = time.split(':').map(Number)
        cron = `${mm} ${hh} */${val} * *`
        nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0)
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + val)
        }
      }
    } else {
      // one-off
      const [hh, mm] = time.split(':').map(Number)
      nextRun = new Date(startDate)
      nextRun.setHours(hh, mm, 0, 0)
      if (nextRun < now) {
        // Nếu user chọn giờ đã qua trong hôm nay, mặc định dời sang mai? 
        // Hoặc cứ để nó quá hạn để scheduler quét phát hiện ngay? 
        // Ta giữ nguyên lựa chọn của user.
      }
      cron = '' 
    }

    try {
      setSending(true)
      await updateTask(taskId, workspaceId, {
        schedule_enabled: scheduleOn,
        schedule_cron: cron,
        next_run_at: nextRun?.toISOString() || null
      })
      alert('Đã lưu cấu hình tự động hoá!')
      setPanelOpen(false)
    } catch (e) {
      console.error(e)
      alert('Lỗi khi lưu cấu hình: ' + (e instanceof Error ? e.message : 'Unknown error'))
    } finally {
      setSending(false)
    }
  }

  const base = `/app/w/${workspaceId}`

  useEffect(() => {
    if (!taskId || !workspaceId) return
    void (async () => {
      setErr('')
      try {
        const t = await fetchTask(taskId, workspaceId)
        setTask((prev) => mergeTaskMessagesPreferLocal(prev, t))
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
        setErr(getApiErrorMessage(e, 'Không tải được task'))
      }
    })()
  }, [taskId, workspaceId])

  // Hydrate automation state when task is loaded
  useEffect(() => {
    if (task) {
      setScheduleOn(task.schedule_enabled || false)
      if (task.schedule_cron) {
        setCycle('recurring')
        // Parse cron: "*/5 * * * *" or "0 */2 * * *" or "0 0 */3 * *"
        const parts = task.schedule_cron.split(' ')
        if (parts.length >= 5) {
          const min = parts[0]
          const hour = parts[1]
          const day = parts[2]
          
          if (min.startsWith('*/')) {
             setTimeUnit('minutes')
             setInterval(parseInt(min.replace('*/', '')) || 5)
          } else if (hour.startsWith('*/')) {
             setTimeUnit('hours')
             setInterval(parseInt(hour.replace('*/', '')) || 1)
          } else if (day.startsWith('*/')) {
             setTimeUnit('days')
             setInterval(parseInt(day.replace('*/', '')) || 1)
          }
        }
      } else {
        setCycle('once')
        if (task.next_run_at) {
          try {
            const dt = new Date(task.next_run_at)
            setStartDate(dt.toISOString().split('T')[0])
            setTime(dt.toTimeString().split(' ')[0].slice(0, 5))
          } catch (e) {
            console.warn('Failed to parse next_run_at:', task.next_run_at)
          }
        }
      }
    }
  }, [task])

  useEffect(() => {
    if (!workspaceId || !taskId) return
    const wsOrigin = resolveWsOrigin()
    if (!wsOrigin) return

    const socket = io(wsOrigin, {
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setLeaderThoughtStream('')
      socket.emit('joinWorkspace', workspaceId)
    })

    socket.on('task.stream', (payload: { 
      taskId?: string; 
      type?: 'chunk' | 'status' | 'action_plan';
      chunk?: string; 
      node?: string;
      status?: string;
      tool?: string;
      messageId?: string;
    }) => {
      if (!payload || String(payload.taskId ?? '') !== String(taskId)) return

      const type = payload.type || 'chunk'
      const chunk = String(payload.chunk ?? '')
      const node = String(payload.node ?? '')
      // #region agent log
      if (type === 'status') {
        fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`task-stream:${taskId}`,hypothesisId:'H10',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:646',message:'stream_status_event',data:{node,status:payload.status ?? '',tool:payload.tool ?? ''},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      // #region agent log
      if (/PASS|FAIL|Lý do:|Gợi ý:|<thought/i.test(chunk)) {
        fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`task-stream:${taskId}`,hypothesisId:'H1',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:635',message:'incoming_stream_chunk_with_markers',data:{type,node,status:payload.status ?? '',chunkPreview:chunk.slice(0,160)},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion

      if (type === 'chunk' && chunk && node === 'leader_agent') {
        // #region agent log
        fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`task-stream:${taskId}`,hypothesisId:'H10',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:650',message:'leader_chunk_received',data:{chunkLen:chunk.length,hasThoughtTag:/<thought/i.test(chunk),hasReviewMarker:/PASS|FAIL|Lý do:|Gợi ý:/i.test(chunk),chunkPreview:chunk.slice(0,120)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setLeaderThoughtStream((prev) => `${prev}${chunk}`)
      }

      setTask((prev) => {
        if (!prev || String(prev._id) !== String(taskId)) return prev
        if (prev.status === 'completed' || prev.status === 'failed') {
          return prev
        }

        const messages = Array.isArray(prev.messages) ? [...prev.messages] : []
        const msgId = payload.messageId
        
        // 0. Render Guard: Nếu ID này đã tồn tại trong mảng và type là loại đặc biệt (như summary)
        // thì ta chỉ cập nhật nội dung chứ không bao giờ push mới.
        // Thực tế logic bên dưới đã handle Upsert, nhưng ta thêm check type nếu cần.
        
        // 1. Tìm tin nhắn theo ID
        let existingIdx = -1
        if (msgId) {
          existingIdx = messages.findIndex(m => m.messageId === msgId)
        } else {
          // Fallback cho logic cũ nếu không có ID
          const last = messages[messages.length - 1]
          if (last && last.role === 'assistant') {
            existingIdx = messages.length - 1
          }
        }

        let target: TaskMessageRow
        if (existingIdx !== -1) {
          target = { ...messages[existingIdx] }
        } else {
          target = {
            messageId: msgId,
            role: 'assistant',
            content: '',
            steps: [],
            createdAt: new Date().toISOString(),
          }
          messages.push(target)
          existingIdx = messages.length - 1
        }

        if (type === 'action_plan' && (payload as any).actionPlan) {
          return {
            ...prev,
            status: 'waiting_human_input',
            draft_payload: JSON.stringify((payload as any).actionPlan),
          }
        }

        if (type === 'status') {
          let label = NODE_STEP_LABELS[node]
          if (payload.status === 'tool_call' && payload.tool) {
            const TOOL_FRIENDLY: Record<string, string> = {
              delegate_to_integration: 'Đang kết nối ứng dụng...',
              read_gmail_tool: 'Đang đọc email...',
              web_search_tool: 'Đang tìm kiếm web...',
              tavily_search: 'Đang tìm kiếm web...',
            }
            label = TOOL_FRIENDLY[payload.tool] || `Đang thực thi: ${payload.tool}`
          }

          if (label) {
            const steps = Array.isArray(target.steps) ? [...target.steps] : []
            if (!steps.includes(label)) {
              steps.push(label)
              messages[existingIdx] = { ...target, steps }
            }
          }
        } else {
          // type === 'chunk'
          if (chunk) {
            const raw = `${String(target.content ?? '')}${chunk}`;
            const clean = raw.replace(/<!--CF_ACTION_PLAN_START-->[\s\S]*?<!--CF_ACTION_PLAN_END-->/g, '')
                             .replace(/<!--CF_ACTION_PLAN_START-->|<!--CF_ACTION_PLAN_END-->/g, '');
            messages[existingIdx] = {
              ...target,
              content: clean,
            }
          }
        }

        return {
          ...prev,
          status: 'in_progress',
          messages,
        }
      })
    })

    socket.on('task.status', (payload: { taskId?: string; status?: string; result?: string; messageId?: string; draft_payload?: string }) => {
      if (!payload || String(payload.taskId ?? '') !== String(taskId)) return
      // Cập nhật status + content NGAY LẬP TỨC (real-time) — không chờ fetchTask()
      const newStatus = payload.status as Task['status'] | undefined
      if (newStatus) {
        setTask((prev) => {
          if (!prev || String(prev._id) !== String(taskId)) return prev
          const updated = { 
            ...prev, 
            status: newStatus,
            // QUAN TRỌNG: Nếu NestJS có gửi nháp về, phải lưu nó lại để render ActionCard
            ...(payload.draft_payload && { draft_payload: payload.draft_payload }),
          }
          // CẬP NHẬT NỘI DUNG ASSISTANT BUBBLE NGAY TỪ SOCKET (Fix "Mù Real-time")
          if (payload.result && Array.isArray(updated.messages)) {
            const messages = [...updated.messages]
            const msgId = payload.messageId
            let targetIdx = -1
            if (msgId) {
              targetIdx = messages.findIndex(m => m.messageId === msgId)
            }
            if (targetIdx === -1) {
              // Fallback: tìm assistant message cuối cùng
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'assistant') { targetIdx = i; break }
              }
            }
            if (targetIdx !== -1) {
              messages[targetIdx] = { ...messages[targetIdx], content: payload.result }
            }
            updated.messages = messages
          }
          return updated
        })
        if (newStatus === 'completed' || newStatus === 'failed') {
          setLeaderThoughtStream('')
        }
      }
      // Fetch full task data sau 500ms để đồng bộ (debounce — tránh DB chưa commit)
      const fetchTimer = setTimeout(() => {
        void (async () => {
          try {
            const t = await fetchTask(taskId, workspaceId)
            setTask((prev) => mergeTaskMessagesPreferLocal(prev, t))
          } catch {
            // giữ im lặng: status sẽ đồng bộ lại ở lần reload tiếp theo
          }
        })()
      }, 500)
      return () => clearTimeout(fetchTimer)
    })

    socket.on('SHOW_ACTION_CARD', (payload: { taskId: string; type: string; data: any }) => {
      if (String(payload.taskId) !== String(taskId)) return
      setTask((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'waiting_human_input',
          draft_payload: JSON.stringify(payload.data)
        }
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [workspaceId, taskId])

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

  const handleSelectAgent = async (a: Agent) => {
    // Optimistic update: ngay lập tức cập nhật UI
    setSelectedAgent(a)
    setAgentName(a.name)
    setAgentPickerOpen(false)
    // Persist vào DB để F5 không mất
    if (task && workspaceId) {
      try {
        const updated = await updateTask(task._id, workspaceId, { agent_id: a._id })
        setTask((prev) => prev ? { ...prev, agent_id: updated.agent_id } : prev)
      } catch (e) {
        // Không block UX nếu lỗi — chỉ log
        console.warn('[AgentPicker] Không lưu được agent_id vào task:', e)
      }
    }
  }

  const handleRenameTask = async () => {
    if (!task || !workspaceId) return
    setTaskMenuOpen(false)
    const nextTitle = window.prompt('Nhập tên mới cho task:', task.title)?.trim()
    if (!nextTitle || nextTitle === task.title) return
    try {
      const updated = await updateTask(task._id, workspaceId, { title: nextTitle })
      setTask(updated)
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Không đổi được tên task'))
    }
  }

  const handleDeleteTask = async () => {
    if (!task || !workspaceId) return
    setTaskMenuOpen(false)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteTask = async () => {
    if (!task || !workspaceId) return
    setDeleteConfirmOpen(false)
    try {
      await deleteTask(task._id, workspaceId)
      refresh()
      navigate(`${base}/dashboard`)
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Không xoá được task'))
    }
  }

  const statusBadge = task
    ? STATUS_LINES[task.status] ?? STATUS_LINES.scheduled!
    : null
  const chatMessages = useMemo(
    () => (task ? taskToChatMessages(task) : []),
    [task],
  )
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`chat-messages:${taskId}`,hypothesisId:'H12',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:815',message:'chat_messages_snapshot',data:{taskStatus:task?.status ?? '',chatLen:chatMessages.length,rawTaskMessagesLen:Array.isArray(task?.messages)?task?.messages?.length:0,lastRole:chatMessages.length>0?chatMessages[chatMessages.length-1]?.role:'none',lastLen:chatMessages.length>0?String(chatMessages[chatMessages.length-1]?.content ?? '').length:0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [chatMessages, task?.messages, task?.status, taskId])
  const lastAssistantIndex = [...chatMessages]
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => m.role === 'assistant')
    .map(({ idx }) => idx)
    .pop()
  const leaderLiveThought = leaderThoughtStream
    ? extractThoughtAndBody(leaderThoughtStream).thought
    : null
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`leader-thought:${taskId}`,hypothesisId:'H13',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:826',message:'leader_live_thought_snapshot',data:{streamLen:(leaderThoughtStream ?? '').length,thoughtLen:(leaderLiveThought ?? '').length,streamHasThoughtTag:/<thought/i.test(leaderThoughtStream ?? ''),streamPreview:String(leaderThoughtStream ?? '').slice(0,120)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [leaderThoughtStream, leaderLiveThought, taskId])

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
    
    // 1. Tạo ID duy nhất cho tin nhắn User (Optimistic)
    const userMsgId = `user_msg_${Date.now()}`
    const newUserMsg: TaskMessageRow = {
      messageId: userMsgId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }

    setSending(true)
    setDraft('')
    setComposerFsOpen(false)

    // 2. Optimistic Update: Thêm ngay vào UI
    setTask((prev) => {
      if (!prev) return prev
      const messages = Array.isArray(prev.messages) ? [...prev.messages] : []
      return { ...prev, messages: [...messages, newUserMsg] }
    })

    try {
      // #region agent log
      fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`submit-update:${task._id}`,hypothesisId:'H15',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:871',message:'submit_update_before_append',data:{taskId:task._id,taskStatus:task.status,currentMessagesLen:Array.isArray(task.messages)?task.messages.length:0,textLen:text.length,userMsgId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      const updated = await appendTaskMessage(task._id, workspaceId, text, userMsgId)
      
      // #region agent log
      fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`submit-update:${task._id}`,hypothesisId:'H15',location:'Frontend/src/pages/app/TaskWorkspacePage.tsx:875',message:'submit_update_after_append',data:{returnedTaskId:updated?._id ?? '',returnedStatus:updated?.status ?? '',returnedMessagesLen:Array.isArray(updated?.messages)?updated.messages.length:0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      // mergeTaskMessagesPreferLocal sẽ lo việc deduplicate nếu Backend dội lại
      setTask((prev) => mergeTaskMessagesPreferLocal(prev, updated))
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Không gửi được tin nhắn'))
      // Rollback nếu cần (đơn giản nhất là fetch lại task)
    } finally {
      setSending(false)
    }
  }

  const stopGeneration = async () => {
    if (!task || !workspaceId) return
    try {
      const updated = await updateTask(task._id, workspaceId, { status: 'completed' as any })
      setTask(updated)
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Không dừng được'))
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
      <div className="flex flex-1 items-center justify-center p-12 bg-white/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-600" />
          <p className="text-sm font-medium text-slate-500">Đang chuẩn bị không gian làm việc…</p>
        </div>
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
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/[0.06]">
            <h3 className="text-base font-semibold text-slate-800">Xóa task này?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Hành động này không thể hoàn tác. Toàn bộ hội thoại và kết quả trong task sẽ bị xóa.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTask()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Xóa task
              </button>
            </div>
          </div>
        </div>
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
            <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-slate-800 sm:text-2xl">
              {task.title}
            </h1>
            <div className="flex items-center gap-2">
              {statusBadge && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-500 sm:text-sm">
                  <span
                    className={[
                      'h-2 w-2 rounded-full shadow-[0_0_8px] shadow-current',
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setTaskMenuOpen((v) => !v)}
                className="rounded-full flex h-9 w-9 items-center justify-center text-[var(--color-cf-on-surface-variant,#434656)] transition-colors hover:bg-[var(--color-cf-surface-container-high,#e7e8e9)] sm:h-10 sm:w-10"
                title="Tùy chọn task"
                aria-expanded={taskMenuOpen}
              >
                <MoreHorizontal className="h-[1.375rem] w-[1.375rem]" aria-hidden strokeWidth={2} />
              </button>
              {taskMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.4rem)] z-30 min-w-[10rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => void handleRenameTask()}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Chỉnh sửa tên task
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTask()}
                    className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    Xóa task
                  </button>
                </div>
              )}
            </div>
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

        <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-8 sm:px-8">
          {chatMessages.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-center">
              <div className="mb-10 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/20 duration-[2000ms]" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xl ring-1 ring-blue-100/50">
                    <Bot className="h-10 w-10 text-blue-600" strokeWidth={1.5} />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold tracking-tight text-slate-800">Xin chào!</h2>
                  <p className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
                    Tôi có thể giúp gì cho bạn hôm nay?
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-8 pb-10">
              {chatMessages.map((msg, idx) => {
                if (msg.role === 'system') {
                  return <SystemBadge key={idx} text={msg.content} />
                }
                
                return msg.role === 'user' ? (
                  <div key={idx} className="flex w-full justify-end animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex max-w-[85%] justify-end sm:max-w-2xl">
                      <div className="rounded-2xl rounded-tr-sm bg-white px-5 py-3.5 shadow-[0_4px_15px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80">
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
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
                      {(() => {
                        const emailData = parseEmailSummaryFromContent(msg.content);
                        if (emailData) {
                          return (
                            <>
                              <p className="text-[13px] text-slate-500 italic mb-2">
                                Dạ, đây là tóm tắt các email quan trọng của bạn:
                              </p>
                              <EmailSummaryCard
                                data={emailData}
                                taskId={task._id}
                                workspaceId={workspaceId}
                                onActionComplete={() => {
                                  void (async () => {
                                    try {
                                      const t = await fetchTask(taskId, workspaceId)
                                      setTask((prev) => mergeTaskMessagesPreferLocal(prev, t))
                                    } catch (e) {
                                      console.error('Lỗi khi tải lại task:', e)
                                    }
                                  })()
                                }}
                              />
                            </>
                          )
                        }
                        
                        return (
                          <AgentMessageContent
                            content={msg.content}
                            liveThought={
                              task?.status === 'in_progress' && idx === lastAssistantIndex
                                ? leaderLiveThought
                                : null
                            }
                            steps={msg.steps}
                          />
                        )
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}            
            {task?.draft_payload && (task.status === 'waiting_human_input' || task.status === 'waiting_execute_approval') && (
              <div className="flex w-full justify-start mt-4">
                <div className="flex w-full max-w-[85%] flex-col gap-2 sm:max-w-4xl pl-9">
                  <ActionCards 
                    draftPayload={task.draft_payload} 
                    taskId={task._id} 
                    workspaceId={workspaceId}
                    onActionComplete={() => {
                      void (async () => {
                        try {
                          const t = await fetchTask(taskId, workspaceId)
                          setTask((prev) => mergeTaskMessagesPreferLocal(prev, t))
                        } catch (e) {
                          console.error('Lỗi khi tải lại task:', e)
                        }
                      })()
                    }}
                  />
                </div>
              </div>
            )}

            {(task.status === 'scheduled' || task.status === 'in_progress' || task.status === 'pending') && (() => {
              // Only show thinking indicator if no assistant message is currently streaming
              const lastMsg = chatMessages[chatMessages.length - 1]
              const hasStreamingAssistant = lastMsg?.role === 'assistant' && (lastMsg.content ?? '').length > 0
              if (hasStreamingAssistant) return null
              return (
                <div className="mt-6 flex w-full justify-start">
                  <div className="flex w-full max-w-[85%] flex-col gap-2 sm:max-w-4xl">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                        <Bot className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {agentName.trim() || 'Trợ lý AI'}
                      </span>
                    </div>
                    <div className="pl-9">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 ring-1 ring-slate-100">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse text-blue-500" strokeWidth={2} />
                        <span className="text-sm font-medium text-slate-500">
                          <span className="inline-block animate-pulse">Đang suy nghĩ</span>
                          <span className="inline-flex w-6 overflow-hidden text-left">
                            <span className="animate-[ellipsis_1.4s_steps(4,end)_infinite]">...</span>
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
        <div className="h-6 shrink-0" aria-hidden />
      </div>

        <div className="shrink-0 px-4 pb-0 pt-2 sm:px-8 sm:pb-3">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
            <div className="group relative flex w-full flex-col rounded-[2rem] bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 transition-all duration-300 focus-within:ring-blue-400/30 focus-within:shadow-[0_25px_60px_rgba(0,0,0,0.08)]">
              <textarea
                ref={composerTaRef}
                rows={1}
                className="w-full resize-none border-none bg-transparent px-4 py-4 text-[16px] leading-relaxed text-slate-800 outline-none ring-0 placeholder:text-slate-400"
                placeholder="Giao việc cho Agent hoặc bắt đầu trò chuyện…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !sending) {
                    e.preventDefault()
                    void submitUpdate()
                  }
                }}
              />
              
              <div className="flex items-center justify-between px-2 pb-1 pt-2">
                <div className="flex items-center gap-2">
                  {/* File Upload Button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      console.log('File selected:', e.target.files?.[0])
                      // Implement file upload logic here
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    title="Tải file lên"
                  >
                    <Paperclip className="h-[20px] w-[20px]" strokeWidth={1.5} />
                  </button>

                  {/* Schedule Shortcut Button */}
                  <div className="relative">
                    <button
                      ref={scheduleBtnRef}
                      type="button"
                      onClick={() => setSchedulePopupOpen((v) => !v)}
                      className={[
                        'flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-slate-100',
                        scheduleOn ? 'text-blue-600' : 'text-slate-400',
                        schedulePopupOpen && 'bg-slate-100'
                      ].join(' ')}
                      title="Đặt lịch chạy"
                    >
                      <Timer className="h-[20px] w-[20px]" strokeWidth={1.5} />
                    </button>

                    {schedulePopupOpen && (
                      <div
                        ref={schedulePopupRef}
                        className="absolute bottom-full left-0 mb-4 w-[320px] origin-bottom-left overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-5 shadow-2xl animate-in fade-in zoom-in duration-200 z-50"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-800">Đặt lịch tự động</h4>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={scheduleOn}
                            onClick={() => setScheduleOn((v) => !v)}
                            className={[
                              'relative flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors duration-200',
                              scheduleOn ? 'bg-blue-600' : 'bg-slate-200',
                            ].join(' ')}
                          >
                            <span
                              className={[
                                'inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200',
                                scheduleOn ? 'translate-x-5' : 'translate-x-1',
                              ].join(' ')}
                            />
                          </button>
                        </div>
                        
                        <div className={['space-y-4', !scheduleOn && 'opacity-40 pointer-events-none'].join(' ')}>
                          <div className="relative">
                            <select
                              value={cycle}
                              onChange={(e) => setCycle(e.target.value)}
                              className="w-full appearance-none rounded-xl bg-slate-100 py-2.5 pl-4 pr-10 text-xs font-bold text-slate-700 outline-none"
                            >
                              <option value="once">Một lần duy nhất</option>
                              <option value="recurring">Lặp lại định kỳ</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                          </div>

                          {cycle === 'recurring' && (
                            <div className="rounded-lg bg-blue-50 px-3 py-2">
                              <p className="text-[11px] font-medium text-blue-700">
                                ⏱ Lặp lại mỗi <span className="font-bold">{interval}</span>{' '}
                                <span className="font-bold">
                                  {timeUnit === 'minutes' ? 'phút' : timeUnit === 'hours' ? 'giờ' : 'ngày'}
                                </span>
                              </p>
                            </div>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => {
                              setSchedulePopupOpen(false)
                              setPanelOpen(true)
                            }}
                            className="w-full rounded-xl py-2 text-[11px] font-bold text-blue-600 transition-colors hover:bg-blue-50"
                          >
                            Xem chi tiết cấu hình →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agent Picker Pill */}
                  <div className="relative">
                    <button
                      ref={agentPickerRef}
                      type="button"
                      onClick={() => setAgentPickerOpen((v) => !v)}
                      className="flex h-10 items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-4 py-1.5 transition-all hover:bg-slate-100 active:scale-95"
                      title="Chọn Agent"
                    >
                      <Sparkles className="h-4 w-4 text-blue-600" strokeWidth={1.5} />
                      <span className="max-w-[150px] truncate text-[13px] font-bold text-slate-700">
                        {selectedAgent ? selectedAgent.name : 'Chọn Agent'}
                      </span>
                      <ChevronDown className={['h-3 w-3 text-slate-400 transition-transform', agentPickerOpen && 'rotate-180'].join(' ')} />
                    </button>

                    {agentPickerOpen && (
                      <div
                        ref={agentPopoverRef}
                        className="absolute bottom-full left-0 mb-4 w-64 origin-bottom-left overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-1 shadow-2xl animate-in fade-in zoom-in duration-200 z-50"
                      >
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Đổi Agent làm việc</div>
                        <div className="max-h-64 overflow-y-auto">
                          {agents.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-400 italic">Không có agent nào</div>
                          ) : (
                            agents.map((a) => (
                              <button
                                key={a._id}
                                type="button"
                                onClick={() => void handleSelectAgent(a)}
                                className={[
                                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                                  selectedAgent?._id === a._id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                                ].join(' ')}
                              >
                                <div className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold', selectedAgent?._id === a._id ? 'bg-blue-100' : 'bg-slate-100'].join(' ')}>
                                  {getInitials(a.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[13px] font-bold">{a.name}</div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Conditional Maximize Button */}
                  {draft.length > 50 && (
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Phóng to ô nhập"
                      title="Phóng to"
                      onClick={() => setComposerFsOpen(true)}
                    >
                      <Maximize2 className="h-4.5 w-4.5" strokeWidth={1.5} />
                    </button>
                  )}

                  {(task?.status === 'in_progress' || task?.status === 'scheduled' || task?.status === 'pending') && !draft.trim() ? (
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-200 transition-all hover:bg-red-600 active:scale-95 animate-pulse"
                      onClick={() => void stopGeneration()}
                      title="Dừng tạo nội dung"
                      id="stop-generation-btn"
                    >
                      <Square className="h-4 w-4 shrink-0 fill-current" strokeWidth={0} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                      disabled={!draft.trim() || sending}
                      onClick={() => void submitUpdate()}
                      title="Gửi"
                    >
                      <Send className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 text-center text-[0.7rem] font-medium text-slate-400">
              Nhấn <kbd className="rounded bg-slate-100 px-1 py-0.5">Enter</kbd> để gửi · <kbd className="rounded bg-slate-100 px-1 py-0.5">Shift+Enter</kbd> để xuống dòng.
            </div>
          </div>
        </div>
      </section>

      {composerFsOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:p-8 md:p-12"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setComposerFsOpen(false)
          }}
        >
          <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex shrink-0 items-center justify-between px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Maximize2 className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Soạn thảo toàn màn hình</h3>
              </div>
              <button
                type="button"
                onClick={() => setComposerFsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng"
              >
                <X className="h-6 w-6" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-2">
              <textarea
                ref={modalComposerTaRef}
                className="h-full w-full resize-none border-none bg-transparent text-[18px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-300 focus:ring-0"
                placeholder={agentName ? `Nhắn tới ${agentName}…` : 'Nhập nội dung chi tiết tại đây…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-8 py-6">
              <span className="text-sm font-medium text-slate-400">
                {draft.length} ký tự
              </span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setComposerFsOpen(false)}
                  className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => void submitUpdate()}
                  disabled={!draft.trim() || sending}
                  className="flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" strokeWidth={1.5} />
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
        <TaskAutomationPanel
          workspaceId={workspaceId}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          scheduleOn={scheduleOn}
          setScheduleOn={setScheduleOn}
          cycle={cycle}
          setCycle={setCycle}
          startDate={startDate}
          setStartDate={setStartDate}
          interval={interval}
          setInterval={setInterval}
          time={time}
          setTime={setTime}
          timeUnit={timeUnit}
          setTimeUnit={setTimeUnit}
          handleSaveAutomation={handleSaveAutomation}
          sending={sending}
        />
      </div>
    </div>
  )
}
