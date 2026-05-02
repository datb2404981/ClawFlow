import { useState, useRef, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Send, Sparkles, Paperclip, Timer, ChevronDown, Clock3 } from 'lucide-react'
import { createTask } from '../../api/tasks'
import { getApiErrorMessage } from '../../api/errors'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'

export function TaskNewPage() {
  const { workspaceId, agents, refresh } = useOutletContext<WsOutlet>()
  const nav = useNavigate()
  
  const [description, setDescription] = useState('')
  const [agentId, setAgentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  
  // Schedule state
  const [scheduleOn, setScheduleOn] = useState(false)
  const [cycle, setCycle] = useState('once')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('09:00')
  const [timeUnit, setTimeUnit] = useState('minutes')
  const [interval, setInterval] = useState(5)
  const [schedulePopupOpen, setSchedulePopupOpen] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scheduleBtnRef = useRef<HTMLButtonElement>(null)

  const selectedAgentId = agentId || agents[0]?._id || ''
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [description])

  // Schedule extra state
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [selectedMonthDays, setSelectedMonthDays] = useState<number[]>([])

  const toggleDay = (d: string) =>
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  const toggleMonthDay = (d: number) =>
    setSelectedMonthDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  /** Build a simple cron-like string from UI selections */
  const buildScheduleCron = () => {
    if (cycle === 'recurring') {
      const val = interval || 5
      if (timeUnit === 'minutes') return `*/${val} * * * *`
      if (timeUnit === 'hours') return `0 */${val} * * *`
      if (timeUnit === 'days') return `0 0 */${val} * *`
    }
    return '' // One-off
  }

  /** Compute the next run time from now */
  const computeNextRunAt = () => {
    const now = new Date()
    if (cycle === 'recurring') {
      const val = interval || 5
      if (timeUnit === 'minutes') return new Date(now.getTime() + val * 60000).toISOString()
      if (timeUnit === 'hours') return new Date(now.getTime() + val * 3600000).toISOString()
      if (timeUnit === 'days') return new Date(now.getTime() + val * 86400000).toISOString()
    } else {
      // one-off
      const [hh, mm] = time.split(':').map(Number)
      const next = new Date(startDate)
      next.setHours(hh, mm, 0, 0)
      return next.toISOString()
    }
    return now.toISOString()
  }

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!description.trim()) return
    if (!selectedAgentId) {
      setErr('Vui lòng tạo ít nhất 1 Agent trước khi giao việc.')
      return
    }
    setErr('')
    setSaving(true)
    
    let title = description.trim().split('\n')[0].slice(0, 45)
    if (description.length > 45) title += '...'
    if (!title) title = 'Công việc mới'

    try {
      const body: Parameters<typeof createTask>[0] = {
        workspace_id: workspaceId,
        agent_id: selectedAgentId,
        title,
        description: description.trim(),
      }

      if (scheduleOn) {
        body.schedule_enabled = true
        body.schedule_cron = buildScheduleCron()
        body.next_run_at = computeNextRunAt()
      }

      const t = await createTask(body)
      refresh()
      nav(`/app/w/${workspaceId}/tasks/${t._id}`, { replace: true })
    } catch (err2) {
      setErr(getApiErrorMessage(err2, 'Tạo công việc thất bại'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center bg-[#f8f9fa] px-4 font-[family-name:var(--font-cf-body,Inter,sans-serif)] antialiased">
      <div className="w-full max-w-4xl -translate-y-[10vh]">
        
        {/* Welcome Text */}
        <div className="mb-12 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/20 duration-[2000ms]" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xl ring-1 ring-blue-100/50">
              <Sparkles className="h-10 w-10 text-blue-600" strokeWidth={1.5} />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-800">Xin chào!</h1>
            <p className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
              Tôi có thể giúp gì cho bạn hôm nay?
            </p>
          </div>
        </div>

        {/* Input Box Redesigned */}
        <form onSubmit={onSubmit} className="relative mx-auto w-full">
          <div className="group relative flex flex-col rounded-[2.5rem] bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.06)] ring-1 ring-slate-200/60 transition-all duration-300 focus-within:ring-blue-400/30 focus-within:shadow-[0_25px_80px_rgba(0,0,0,0.1)]">
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (e.shiftKey) return
                if (e.nativeEvent.isComposing) return
                e.preventDefault()
                if (saving || !description.trim() || !selectedAgentId) return
                void onSubmit()
              }}
              placeholder="Giao việc cho Agent hoặc bắt đầu trò chuyện..."
              className="w-full resize-none border-none bg-transparent px-6 py-5 text-[18px] leading-relaxed text-slate-800 outline-none ring-0 placeholder:text-slate-400"
              style={{ minHeight: '120px', maxHeight: '400px' }}
              autoFocus
            />
            
            <div className="flex items-center justify-between px-3 pb-2 pt-2">
              <div className="flex items-center gap-2">
                {/* File Upload Shortcut */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => console.log('File selected:', e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <Paperclip className="h-[20px] w-[20px]" strokeWidth={1.5} />
                </button>

                {/* Quick Schedule Button */}
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
                    <div className="absolute bottom-full left-0 mb-4 w-[320px] origin-bottom-left overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-5 shadow-2xl animate-in fade-in zoom-in duration-200 z-50">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-800">Đặt lịch tự động</h4>
                        <button
                          type="button"
                          onClick={() => setScheduleOn(!scheduleOn)}
                          className={[
                            'relative flex h-5 w-9 items-center rounded-full transition-colors',
                            scheduleOn ? 'bg-blue-600' : 'bg-slate-200'
                          ].join(' ')}
                        >
                          <span className={['inline-block h-3 w-3 rounded-full bg-white transition-transform', scheduleOn ? 'translate-x-5' : 'translate-x-1'].join(' ')} />
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

                        {cycle === 'once' ? (
                          <div className="space-y-3">
                            <div className="relative">
                              <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full rounded-xl bg-slate-100 py-2.5 px-4 text-xs font-bold text-slate-700 outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="flex-1 rounded-xl bg-slate-100 py-2.5 px-4 text-xs font-bold text-slate-700 outline-none"
                              />
                              <Clock3 className="h-4 w-4 text-slate-400" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={interval}
                                onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                                className="w-16 rounded-xl bg-slate-100 py-2.5 text-center text-xs font-bold text-slate-700 outline-none"
                              />
                              <div className="relative flex-1">
                                <select
                                  value={timeUnit}
                                  onChange={(e) => setTimeUnit(e.target.value)}
                                  className="w-full appearance-none rounded-xl bg-slate-100 py-2.5 pl-4 pr-10 text-xs font-bold text-slate-700 outline-none"
                                >
                                  <option value="minutes">Phút</option>
                                  <option value="hours">Giờ</option>
                                  <option value="days">Ngày</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                              </div>
                            </div>
                            <div className="rounded-lg bg-blue-50 px-3 py-2">
                              <p className="text-[11px] font-medium text-blue-700">
                                ⏱ Lặp lại mỗi <span className="font-bold">{interval}</span>{' '}
                                <span className="font-bold">
                                  {timeUnit === 'minutes' ? 'phút' : timeUnit === 'hours' ? 'giờ' : 'ngày'}
                                </span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Agent Selector Pill */}
                <div className="ml-2 h-6 w-px bg-slate-100" />
                <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-4 py-1.5 transition-all hover:bg-slate-100">
                  <Sparkles className="h-4 w-4 text-blue-600" strokeWidth={1.5} />
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="cursor-pointer bg-transparent text-[13px] font-bold text-slate-700 outline-none"
                  >
                    {agents.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || !description.trim() || !selectedAgentId}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
              >
                <Send className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </form>

        {/* Error Message */}
        {err && (
          <div className="mt-6 flex justify-center">
            <span className="rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-red-100">
              {err}
            </span>
          </div>
        )}

        <div className="mt-8 text-center text-[0.75rem] font-medium text-slate-400">
          Nhấn <kbd className="rounded bg-slate-100 px-1.5 py-0.5">Enter</kbd> để tạo công việc nhanh · <kbd className="rounded bg-slate-100 px-1.5 py-0.5">Shift+Enter</kbd> để xuống dòng.
        </div>
      </div>
    </div>
  )
}
