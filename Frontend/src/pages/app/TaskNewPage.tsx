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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center bg-[var(--cf-page-bg)] px-4 font-[family-name:var(--font-cf-body,Inter,sans-serif)]">
      <div className="w-full max-w-[800px] -translate-y-[10vh]">
        
        {/* Welcome Text */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight cf-ui-text sm:text-5xl">
            Xin chào!
          </h1>
          <p className="mt-3 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-[2.25rem] font-semibold leading-tight tracking-tight text-transparent sm:text-[2.85rem]">
            Tôi có thể giúp gì cho bạn hôm nay?
          </p>
        </div>

        {/* Input Box */}
        <form onSubmit={onSubmit} className="relative mx-auto w-full">
          <div className="cf-ui-surface group relative flex flex-col overflow-hidden rounded-[2rem] shadow-xl transition-all duration-300 focus-within:shadow-2xl focus-within:ring-2 focus-within:ring-[var(--cf-electric)]/30">
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
              className="scrollbar-hide w-full resize-none border-none bg-transparent pb-16 pl-8 pr-8 pt-7 text-lg leading-relaxed cf-ui-text outline-none placeholder:text-[var(--cf-input-placeholder)]"
              style={{ minHeight: '130px' }}
              autoFocus
            />
            
            {/* Action Bar inside Input */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pl-3 pr-1">
              
              {/* Agent Selector */}
              <div className="flex items-center gap-2 rounded-full border border-[var(--cf-field-border)] bg-[var(--cf-field-bg)] px-4 py-2 shadow-[var(--cf-field-inner-shadow)] transition-colors hover:bg-[var(--cf-sidebar-row-hover)]">
                <Sparkles className="h-[18px] w-[18px] text-indigo-500" strokeWidth={2} />
                <select
                  value={selectAgent}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="cursor-pointer appearance-none bg-transparent pr-4 text-sm font-medium cf-ui-text outline-none"
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
                className="cf-ui-btn-primary flex h-11 w-11 items-center justify-center rounded-full transition-all hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="h-5 w-5 translate-x-[1px] translate-y-[1px]" strokeWidth={2} />
              </button>
            </div>
          </div>
        </form>

        {/* Error Message */}
        {err && (
          <div className="mt-6 flex justify-center">
            <span className="rounded-full bg-[rgb(254_242_242_/_0.9)] px-4 py-1.5 text-sm font-medium text-red-600 dark:bg-[rgb(127_29_29_/_0.25)]">
              {err}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
