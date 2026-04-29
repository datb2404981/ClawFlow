import { useEffect } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { BookOpen, Workflow } from 'lucide-react'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'

export function DashboardPage() {
  const { workspaceId, workspaceName } = useOutletContext<WsOutlet>()
  const base = `/app/w/${workspaceId}`

  useEffect(() => {
    // Không bắt mỗi lần đăng nhập phải qua cấu hình nếu user đã vào dashboard.
    localStorage.setItem('clawflow_skip_ws_onboarding', '1')
  }, [])

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-8">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--cf-field-bg)] cf-ui-text-muted shadow-[var(--cf-field-inner-shadow)] ring-1 ring-[var(--cf-field-border)]">
        <Workflow className="h-8 w-8" />
      </div>
      <h1 className="text-center text-xl font-semibold tracking-tight cf-ui-text">
        Sẵn sàng điều phối
      </h1>
      <p className="cf-ui-text-muted mt-2 max-w-md text-center text-sm">
        Workspace <strong className="cf-ui-text">{workspaceName}</strong> đã
        sẵn sàng. Tạo công việc mới, cấu hình agent, hoặc mở công việc trong
        lịch sử.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={base + '/tasks/new'}
          className="cf-ui-btn-primary rounded-lg px-4 py-2 text-sm font-medium shadow-[0_4px_14px_0_rgba(30,64,175,0.2)] hover:opacity-90"
        >
          Tạo công việc
        </Link>
        <Link
          to={base + '/agents/new'}
          className="cf-ui-btn-ghost rounded-lg px-4 py-2 text-sm font-medium shadow-sm"
        >
          Cấu hình agent
        </Link>
        <a
          className="cf-ui-text-muted inline-flex items-center gap-1 text-sm hover:text-[var(--cf-ui-text)]"
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
