import { Link, useOutletContext } from 'react-router-dom'
import { BookOpen, Workflow } from 'lucide-react'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'

export function DashboardPage() {
  const { workspaceId, workspaceName } = useOutletContext<WsOutlet>()
  const base = `/app/w/${workspaceId}`

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-8">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/80 text-slate-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
        <Workflow className="h-8 w-8" />
      </div>
      <h1 className="text-center text-xl font-semibold tracking-tight text-slate-900">
        Sẵn sàng điều phối
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-slate-500">
        Workspace <strong className="text-slate-700">{workspaceName}</strong> đã
        sẵn sàng. Tạo công việc mới, cấu hình agent, hoặc mở công việc trong
        lịch sử.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={base + '/tasks/new'}
          className="rounded-lg bg-[#1e40af] px-4 py-2 text-sm font-medium text-white shadow-[0_4px_14px_0_rgba(30,64,175,0.2)] hover:opacity-90"
        >
          Tạo công việc
        </Link>
        <Link
          to={base + '/agents/new'}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Cấu hình agent
        </Link>
        <a
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
        >
          <BookOpen className="h-4 w-4" />
          Tài liệu
        </a>
      </div>
    </div>
  )
}
