import { useEffect, useState } from 'react'
import { Building2, Globe, Moon, Shield } from 'lucide-react'

export function AppSettingsPage() {
  const [notif, setNotif] = useState(true)
  const [compact, setCompact] = useState(false)
  const [lang, setLang] = useState('vi')

  useEffect(() => {
    document.title = 'Cài đặt ứng dụng — ClawFlow'
  }, [])

  return (
    <div className="w-full max-w-4xl px-1">
      <div className="mb-10 pt-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Cài đặt ứng dụng
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Tùy chỉnh cách ClawFlow hiển thị, thông báo và tùy chọn cơ bản cho
          workspace hiện tại.
        </p>
      </div>

      <div className="max-w-3xl space-y-5">
        <section className="rounded-xl border border-slate-100/90 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Tổng quan
          </h2>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Building2
              className="h-5 w-5 shrink-0 text-indigo-600/90"
              strokeWidth={1.5}
            />
            <span>
              Các thiết lập bên dưới áp dụng cho giao diện trên thiết bị. Cấu
              hình workspace và knowledge base (RAG) nằm ở{' '}
              <strong>Workspace &amp; knowledge base</strong> trong menu chuyển
              workspace.
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100/90 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Hành vi giao diện
          </h2>
          <div className="space-y-4">
            <label className="group flex cursor-pointer items-center justify-between gap-4 rounded-lg py-1 text-slate-900">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <Moon className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
                Chế độ gọn (sidebar ưu tiên)
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={compact}
                onClick={() => setCompact((c) => !c)}
                className={[
                  'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                  compact ? 'bg-[#2563eb]' : 'bg-slate-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                    compact ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </label>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-800">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
                Ngôn ngữ hiển thị
              </span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200/80"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100/90 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Thông báo
          </h2>
          <label className="flex cursor-pointer items-center justify-between gap-4 text-slate-900">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <Shield className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
              Nhắc khi task cần duyệt
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={notif}
              onClick={() => setNotif((n) => !n)}
              className={[
                'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                notif ? 'bg-[#2563eb]' : 'bg-slate-200',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                  notif ? 'translate-x-5' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>
          </label>
        </section>
      </div>
    </div>
  )
}
