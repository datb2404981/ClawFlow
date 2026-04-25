import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWorkspaces } from '../../api/workspaces'

export function AppEntryPage() {
  const nav = useNavigate()
  const [phase, setPhase] = useState<'load' | 'err'>('load')
  const [err, setErr] = useState('')

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const list = await fetchWorkspaces()
        if (c) return
        if (list.length) {
          nav(`/app/w/${list[0]!._id}/dashboard`, { replace: true })
        } else {
          setErr('Hệ thống không tạo được workspace cho tài khoản này')
          setPhase('err')
        }
      } catch (e) {
        if (c) return
        setErr(e instanceof Error ? e.message : 'Lỗi tải workspace')
        setPhase('err')
      }
    })()
    return () => {
      c = true
    }
  }, [nav])

  if (phase === 'load') {
    return (
      <div className="flex min-h-svh items-center justify-center text-slate-600">
        Đang tải workspace…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="text-red-600">{err}</p>
      <button
        type="button"
        className="mt-4 text-sm text-blue-600 underline"
        onClick={() => window.location.reload()}
      >
        Thử lại
      </button>
    </div>
  )
}
