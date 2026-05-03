import { useState, useEffect, useRef } from 'react'
import { X, Send, User, Sparkles, Loader2 } from 'lucide-react'
import { refineEmailDraft } from '../api/agents'

export type ActionPayload = {
  to?: string
  subject?: string
  body?: string
  reply_to_message_id?: string
}

interface Props {
  payload: ActionPayload
  onClose: () => void
  onSend: (editedPayload: ActionPayload) => void
  isSending?: boolean
}

export function EmailComposeModal({ payload, onClose, onSend, isSending }: Props) {
  const [to, setTo] = useState(payload.to || '')
  const [subject, setSubject] = useState(payload.subject || '')
  const [body, setBody] = useState(payload.body || '')
  
  // State (Trạng thái) quản lý nút bấm
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Hàm kích hoạt khi ấn nút
  const handleOptimizeEmail = async () => {
    const rawBody = body.trim()
    if (!rawBody) return
    
    setErrorMsg('')
    setIsOptimizing(true)
    
    try {
      const result = await refineEmailDraft(rawBody)
      if (result.data && result.data.trim()) {
        setBody(result.data) // Ghi đè chữ AI sửa vào ô nhập
      } else {
        setErrorMsg('AI trả về kết quả rỗng. Vui lòng thử lại!')
      }
    } catch (error) {
      console.error(error)
      setErrorMsg('Không thể tối ưu email lúc này!')
    } finally {
      setIsOptimizing(false)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [body])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
          <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
            <span>✉️</span> Soạn email trả lời
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col p-5 space-y-4">
          <div className="flex items-center border-b border-slate-100 pb-2">
            <span className="w-16 text-sm font-semibold text-slate-500">Đến:</span>
            <input 
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-300"
              placeholder="nguoi-nhan@example.com"
            />
          </div>
          
          <div className="flex items-center border-b border-slate-100 pb-2">
            <span className="w-16 text-sm font-semibold text-slate-500">Chủ đề:</span>
            <input 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-300"
              placeholder="Chủ đề email..."
            />
          </div>

          <div className="flex-1 pt-2">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nội dung</label>
              
              <button
                onClick={handleOptimizeEmail}
                disabled={isOptimizing || !body.trim() || isSending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 disabled:opacity-50 transition-all active:scale-95 shadow-sm shadow-indigo-100"
              >
                {isOptimizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isOptimizing ? 'Đang viết lại...' : 'Tối ưu bằng AI'}
              </button>
            </div>
            
            {errorMsg && <p className="text-[11px] font-medium text-rose-500 mb-2 px-1">⚠️ {errorMsg}</p>}

            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isOptimizing}
              className={`w-full resize-none bg-transparent text-[15px] leading-relaxed text-slate-700 outline-none min-h-[250px] max-h-[450px] transition-opacity ${isOptimizing ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
              placeholder="Nội dung email..."
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button
            onClick={onClose}
            disabled={isSending}
            className="rounded-full px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={() => onSend({ to, subject, body, reply_to_message_id: payload.reply_to_message_id })}
            disabled={isSending || !to || !body}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
          >
            {isSending ? (
              <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
            {isSending ? 'Đang gửi...' : 'Gửi email'}
          </button>
        </div>

      </div>
    </div>
  )
}
