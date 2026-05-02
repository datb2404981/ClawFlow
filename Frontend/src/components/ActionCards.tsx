import { useState } from 'react'
import { Calendar, Mail, Check, X, Edit2 } from 'lucide-react'
import { EmailComposeModal, type ActionPayload } from './EmailComposeModal'
import { api } from '../api/client'

interface Action {
  type: string
  label: string
  payload: ActionPayload | any
  completed?: boolean
}

interface ActionPlan {
  requires_human: boolean
  actions: Action[]
}

interface Props {
  draftPayload: string
  taskId: string
  workspaceId: string
  onActionComplete?: () => void
}

export function ActionCards({ draftPayload, taskId, workspaceId, onActionComplete }: Props) {
  const [editingActionIdx, setEditingActionIdx] = useState<number | null>(null)
  const [processingIdx, setProcessingIdx] = useState<number | null>(null)
  const [completedActions, setCompletedActions] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  let plan: ActionPlan | null = null
  try {
    plan = JSON.parse(draftPayload)
  } catch {
    return null
  }

  if (!plan?.actions || plan.actions.length === 0) return null

  const handleApprove = async (idx: number, action: Action, editedPayload?: any) => {
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

  const handleGrantPermission = async (idx: number, provider: string) => {
    console.log("Dữ liệu cấp quyền gửi đi nè:", { taskId, workspaceId, provider });
    setProcessingIdx(idx)
    try {
      await api.post(`/tasks/${taskId}/grant-permission`, {
        provider,
        workspace_id: workspaceId
      })
      setCompletedActions(prev => new Set(prev).add(idx))
      onActionComplete?.()
    } catch (err) {
      console.error('Error granting permission:', err)
      setError('Có lỗi xảy ra khi cấp quyền.')
    } finally {
      setProcessingIdx(null)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4 max-w-2xl">
      {plan.actions.map((action, idx) => {
        if (completedActions.has(idx) || action.completed || (action as any).is_resolved) return null

        const isEmail = action.type === 'reply_email' || action.type === 'send_email'
        const isCalendar = action.type === 'create_calendar_event'
        const isPermission = action.type === 'request_permission'
        const Icon = isEmail ? Mail : isCalendar ? Calendar : isPermission ? Check : Check

        return (
          <div key={idx} className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isEmail ? 'bg-blue-50 text-blue-600' : isPermission ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[15px] font-bold text-slate-800 mb-1">{action.label}</h4>
                
                {isEmail && action.payload?.body && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-600 ring-1 ring-slate-100">
                    <div className="mb-2 text-xs font-semibold text-slate-400">Nội dung draft:</div>
                    <div className="line-clamp-3 whitespace-pre-wrap">{action.payload.body}</div>
                  </div>
                )}

                {isCalendar && action.payload && (
                  <div className="mt-3 space-y-1.5 text-[13px] text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold w-16">Bắt đầu:</span> 
                      {new Date(action.payload.startTime).toLocaleString('vi-VN')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold w-16">Kết thúc:</span> 
                      {new Date(action.payload.endTime).toLocaleString('vi-VN')}
                    </div>
                    {action.payload.location && (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold w-16">Địa điểm:</span> 
                        <span className="truncate">{action.payload.location}</span>
                      </div>
                    )}
                  </div>
                )}

                {isPermission && (
                  <div className="mt-2 text-[13px] text-slate-500">
                    Để AI có thể hỗ trợ bạn tốt nhất, vui lòng xác nhận cấp quyền cho hành động này.
                  </div>
                )}

                <div className="mt-5 flex items-center gap-2">
                  {isEmail && (
                    <button
                      onClick={() => setEditingActionIdx(idx)}
                      disabled={processingIdx === idx}
                      className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Sửa nội dung
                    </button>
                  )}
                  
                  {isPermission ? (
                    <button
                      onClick={() => handleGrantPermission(idx, 'gmail')}
                      disabled={processingIdx === idx}
                      className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                    >
                      {processingIdx === idx ? (
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      )}
                      Đồng ý cấp quyền
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(idx, action)}
                      disabled={processingIdx === idx}
                      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 ${isEmail ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
                    >
                      {processingIdx === idx ? (
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      )}
                      {isEmail ? 'Gửi ngay' : 'Tạo sự kiện'}
                    </button>
                  )}

                  <button
                    onClick={() => handleReject(idx)}
                    disabled={processingIdx === idx}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 ml-auto"
                    title="Bỏ qua hành động này"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>

            {editingActionIdx === idx && isEmail && (
              <EmailComposeModal
                payload={action.payload}
                isSending={processingIdx === idx}
                onClose={() => setEditingActionIdx(null)}
                onSend={(edited) => handleApprove(idx, action, edited)}
              />
            )}
          </div>
        )
      })}
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] font-medium text-red-600 ring-1 ring-red-100 flex items-center gap-2 animate-in fade-in zoom-in-95">
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
