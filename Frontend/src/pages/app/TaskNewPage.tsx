import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { createTask } from '../../api/tasks'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'

export function TaskNewPage() {
  const { workspaceId, agents, refresh } = useOutletContext<WsOutlet>()
  const nav = useNavigate()
  const [title, setTitle] = useState('Công việc mới')
  const [description, setDescription] = useState('')
  const [agentId, setAgentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const selectAgent = agentId || agents[0]?._id || ''

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectAgent) {
      setErr('Chọn agent hoặc tạo agent mới trước.')
      return
    }
    setErr('')
    setSaving(true)
    try {
      const t = await createTask({
        workspace_id: workspaceId,
        agent_id: selectAgent,
        title: title.trim() || 'Chưa đặt tên',
        description: description.trim() || undefined,
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
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="text-xl font-bold text-slate-900">Tạo công việc mới</h1>
      <p className="mt-1 text-sm text-slate-500">
        Lưu qua API công việc trên backend.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div>
          <label className="text-xs font-semibold text-slate-700">Agent</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={selectAgent}
            onChange={(e) => setAgentId(e.target.value)}
            required
          >
            {agents.length === 0 && (
              <option value="">— Tạo agent trước —</option>
            )}
            {agents.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700">Tiêu đề</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700">
            Mô tả (gợi ý cho AI / người xử lý)
          </label>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nội dung công việc…"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-[#1e40af] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Đang tạo…' : 'Tạo công việc'}
        </button>
      </form>
    </div>
  )
}
