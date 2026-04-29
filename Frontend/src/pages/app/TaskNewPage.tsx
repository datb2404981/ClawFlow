import { useState, useRef, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Send, Sparkles } from 'lucide-react'
import { createTask } from '../../api/tasks'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'

export function TaskNewPage() {
  const { workspaceId, agents, refresh } = useOutletContext<WsOutlet>()
  const nav = useNavigate()
  
  const [description, setDescription] = useState('')
  const [agentId, setAgentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectAgent = agentId || agents[0]?._id || ''

  // Tự động giãn dòng textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      textareaRef.current.style.height = Math.min(scrollHeight, 400) + 'px'
    }
  }, [description])

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!description.trim()) return
    if (!selectAgent) {
      setErr('Vui lòng tạo ít nhất 1 Agent trước khi giao việc.')
      return
    }
    setErr('')
    setSaving(true)
    
    // Tự sinh tiêu đề từ nội dung
    let title = description.trim().split('\n')[0].slice(0, 45)
    if (description.length > 45) title += '...'
    if (!title) title = 'Công việc mới'

    try {
      const t = await createTask({
        workspace_id: workspaceId,
        agent_id: selectAgent,
        title,
        description: description.trim(),
        status: 'scheduled',
      })
      refresh()
      nav(`/app/w/${workspaceId}/tasks/${t._id}`, { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Tạo công việc thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center bg-[#f3f4f6] px-4 font-[family-name:var(--font-cf-body,Inter,sans-serif)]">
      <div className="w-full max-w-[800px] -translate-y-[10vh]">
        
        {/* Welcome Text */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-800 sm:text-5xl">
            Xin chào!
          </h1>
          <p className="mt-3 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-[2.25rem] font-semibold leading-tight tracking-tight text-transparent sm:text-[2.85rem]">
            Tôi có thể giúp gì cho bạn hôm nay?
          </p>
        </div>

        {/* Input Box */}
        <form onSubmit={onSubmit} className="relative mx-auto w-full">
          <div className="group relative flex flex-col overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-200 transition-all duration-300 focus-within:shadow-2xl focus-within:shadow-indigo-100 focus-within:ring-2 focus-within:ring-indigo-500/30">
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void onSubmit()
                }
              }}
              placeholder="Giao việc cho Agent hoặc bắt đầu trò chuyện..."
              className="scrollbar-hide w-full resize-none border-none bg-transparent pb-16 pl-8 pr-8 pt-7 text-lg leading-relaxed text-slate-800 outline-none placeholder:text-slate-400"
              style={{ minHeight: '130px' }}
              autoFocus
            />
            
            {/* Action Bar inside Input */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pl-3 pr-1">
              
              {/* Agent Selector */}
              <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-4 py-2 transition-colors hover:bg-slate-100">
                <Sparkles className="h-[18px] w-[18px] text-indigo-500" strokeWidth={2} />
                <select
                  value={selectAgent}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="cursor-pointer appearance-none bg-transparent pr-4 text-sm font-medium text-slate-700 outline-none"
                  title="Chọn Agent đảm nhận công việc này"
                >
                  {agents.length === 0 && (
                    <option value="">— Chưa có Agent —</option>
                  )}
                  {agents.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || !description.trim() || !selectAgent}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition-all hover:scale-105 hover:bg-blue-600 disabled:scale-100 disabled:bg-slate-100 disabled:text-slate-300"
              >
                <Send className="h-5 w-5 translate-x-[1px] translate-y-[1px]" strokeWidth={2} />
              </button>
            </div>
          </div>
        </form>

        {/* Error Message */}
        {err && (
          <div className="mt-6 flex justify-center">
            <span className="rounded-full bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600">
              {err}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
