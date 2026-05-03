import { useState } from 'react'
import { Mail, Calendar, AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Check, X, Edit2 } from 'lucide-react'
import { EmailComposeModal, type ActionPayload } from './EmailComposeModal'
import { api } from '../api/client'

interface EmailSummary {
  index: number
  subject: string
  from: string
  priority: 'high' | 'normal'
  summary: string
}

interface EmailAction {
  email_index?: number
  type: string
  label: string
  payload: ActionPayload | any
  completed?: boolean
  is_resolved?: boolean
}

interface EmailSummaryData {
  summaries: EmailSummary[]
  actions: EmailAction[]
}

interface Props {
  data: EmailSummaryData
  taskId: string
  workspaceId: string
  onActionComplete?: () => void
}

export function EmailSummaryCard({ data, taskId, workspaceId, onActionComplete }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [editingActionIdx, setEditingActionIdx] = useState<number | null>(null)
  const [processingIdx, setProcessingIdx] = useState<number | null>(null)
  const [completedActions, setCompletedActions] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  if (!data?.summaries?.length) return null

  const handleApprove = async (idx: number, action: EmailAction, editedPayload?: any) => {
    setProcessingIdx(idx)
    try {
      await api.patch(`/tasks/${taskId}/approve-action`, {
        actionIndex: idx,
        decision: 'approve',
        editedPayload: editedPayload || action.payload
      })
      setCompletedActions(prev => new Set(prev).add(idx))
      onActionComplete?.()
    } catch (err) {
      console.error('Error approving action:', err)
      setError('Có lỗi xảy ra khi thực thi hành động này.')
    } finally {
      setProcessingIdx(null)
      setEditingActionIdx(null)
    }
  }

  const handleReject = async (idx: number) => {
    setProcessingIdx(idx)
    try {
      await api.patch(`/tasks/${taskId}/approve-action`, {
        actionIndex: idx,
        decision: 'reject'
      })
      setCompletedActions(prev => new Set(prev).add(idx))
      onActionComplete?.()
    } catch (err) {
      console.error('Error rejecting action:', err)
    } finally {
      setProcessingIdx(null)
    }
  }

  const highPriorityCount = data.summaries.filter(s => s.priority === 'high').length
  const actionableCount = data.actions.filter(a => !completedActions.has(data.actions.indexOf(a)) && !a.completed && !a.is_resolved).length

  return (
    <div className="mt-4 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Card */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200">
          <Mail className="h-4.5 w-4.5 text-white" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-slate-800">
            Tóm tắt email ({data.summaries.length} thư)
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
            {highPriorityCount > 0 && (
              <span className="flex items-center gap-1 text-rose-500">
                <AlertTriangle className="h-3 w-3" />
                {highPriorityCount} quan trọng
              </span>
            )}
            {actionableCount > 0 && (
              <span className="text-blue-500">{actionableCount} cần xử lý</span>
            )}
          </div>
        </div>
      </div>

      {/* Email Summary List */}
      <div className="space-y-2">
        {data.summaries.map((email, idx) => {
          const isHigh = email.priority === 'high'
          const isExpanded = expandedIdx === idx
          const relatedActions = data.actions.filter(a => a.email_index === email.index)

          return (
            <div
              key={idx}
              className={[
                'group overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer',
                isHigh
                  ? 'border-rose-200/80 bg-gradient-to-r from-rose-50/50 to-white hover:border-rose-300 hover:shadow-md hover:shadow-rose-100/50'
                  : 'border-slate-200/60 bg-white hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/50'
              ].join(' ')}
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                {/* Priority Indicator */}
                <div className={[
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  isHigh ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                ].join(' ')}>
                  {isHigh ? (
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isHigh && (
                      <span className="shrink-0 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                        Urgent
                      </span>
                    )}
                    <h4 className="truncate text-[14px] font-bold text-slate-800">
                      {email.subject}
                    </h4>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    Từ: {email.from}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 line-clamp-2">
                    {email.summary}
                  </p>
                </div>

                <div className="mt-1 shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Actions */}
              {isExpanded && relatedActions.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300"
                     onClick={(e) => e.stopPropagation()}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Đề xuất hành động
                  </p>
                  {relatedActions.map((action, aIdx) => {
                    const globalIdx = data.actions.indexOf(action)
                    if (completedActions.has(globalIdx) || action.completed || action.is_resolved) return null

                    const isEmail = action.type === 'reply_email' || action.type === 'send_email'
                    const isCalendar = action.type === 'create_calendar_event'

                    return (
                      <div key={aIdx} className="flex items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200/60">
                        <div className={[
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          isEmail ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                        ].join(' ')}>
                          {isEmail ? <Mail className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                        </div>
                        <span className="flex-1 text-[13px] font-medium text-slate-700 truncate">
                          {action.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isEmail && (
                            <button
                              onClick={() => setEditingActionIdx(globalIdx)}
                              disabled={processingIdx === globalIdx}
                              className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                              <Edit2 className="h-3 w-3" />
                              Sửa
                            </button>
                          )}
                          <button
                            onClick={() => handleApprove(globalIdx, action)}
                            disabled={processingIdx === globalIdx}
                            className={[
                              'flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50',
                              isEmail ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                            ].join(' ')}
                          >
                            {processingIdx === globalIdx ? (
                              <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                            )}
                            {isEmail ? 'Gửi' : 'Tạo'}
                          </button>
                          <button
                            onClick={() => handleReject(globalIdx)}
                            disabled={processingIdx === globalIdx}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Bỏ qua"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                        </div>

                        {editingActionIdx === globalIdx && isEmail && (
                          <EmailComposeModal
                            payload={action.payload}
                            isSending={processingIdx === globalIdx}
                            onClose={() => setEditingActionIdx(null)}
                            onSend={(edited) => handleApprove(globalIdx, action, edited)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-[13px] font-medium text-red-600 ring-1 ring-red-100 flex items-center gap-2 animate-in fade-in">
          <X className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Detect if an assistant message content contains structured email summary data.
 * Returns parsed data or null.
 */
export function parseEmailSummaryFromContent(content: string): EmailSummaryData | null {
  if (!content) return null
  
  // Pattern 1: Detect markdown email summary format from integration node
  const hasEmailSummary = content.includes('📧 **Tóm tắt email') || content.includes('Tóm tắt email hôm nay')
  if (!hasEmailSummary) return null

  // Try to extract structured data from the markdown format
  const summaries: EmailSummary[] = []
  const actions: EmailAction[] = []

  // Parse summaries: 🔴 **Subject** — từ Sender\n> Summary
  const summaryPattern = /(?:🔴|📌)\s*\*\*(.+?)\*\*\s*—\s*(?:từ\s*)?(.+?)(?:\n|$)\s*(?:>\s*(.+?)(?:\n|$))?/g
  let match
  let idx = 1
  while ((match = summaryPattern.exec(content)) !== null) {
    summaries.push({
      index: idx,
      subject: match[1].trim(),
      from: match[2].trim(),
      priority: content.slice(Math.max(0, match.index - 5), match.index + 3).includes('🔴') ? 'high' : 'normal',
      summary: match[3]?.trim() || '',
    })
    idx++
  }

  // Parse actions from CF_ACTION_PLAN markers (if still present)
  const actionPlanMatch = content.match(/<!--CF_ACTION_PLAN_START-->\s*([\s\S]*?)\s*<!--CF_ACTION_PLAN_END-->/)
  if (actionPlanMatch) {
    try {
      const plan = JSON.parse(actionPlanMatch[1])
      if (plan?.actions) {
        actions.push(...plan.actions)
      }
    } catch {
      // ignore parse errors
    }
  }

  // Also detect action suggestions from markdown
  const actionPattern = /(?:✉️|📅)\s*\*\*(.+?)\*\*/g
  if (actions.length === 0) {
    while ((match = actionPattern.exec(content)) !== null) {
      const isEmail = content.slice(Math.max(0, match.index - 3), match.index + 3).includes('✉️')
      actions.push({
        type: isEmail ? 'reply_email' : 'create_calendar_event',
        label: match[1].trim(),
        payload: {}
      })
    }
  }

  if (summaries.length === 0) return null

  return { summaries, actions }
}
