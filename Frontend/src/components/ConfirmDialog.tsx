import { type ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  description: ReactNode
  /** Nút xác nhận (mặc định: Xoá) */
  confirmLabel?: string
  cancelLabel?: string
  /** Nút hủy / nền: đóng hộp thoại */
  onClose: () => void
  onConfirm: () => void
  /** Nút hành động phá hoại (màu đỏ) */
  danger?: boolean
  /** Đang gọi API */
  busy?: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xoá',
  cancelLabel = 'Hủy',
  onClose,
  onConfirm,
  danger = true,
  busy = false,
}: ConfirmDialogProps) {
  const id = useId()
  const titleId = `confirm-title-${id}`
  const descId = `confirm-desc-${id}`
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const panel = (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 border-0 bg-slate-900/40 p-0 backdrop-blur-sm"
        aria-label="Đóng"
        disabled={busy}
        onClick={onClose}
      />
      <div
        className="ring-slate-900/[0.06] relative z-10 w-full min-w-0 max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.2)] ring-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-base font-semibold leading-snug text-slate-900"
        >
          {title}
        </h2>
        <div
          id={descId}
          className="mt-2 min-w-0 max-w-full text-sm leading-relaxed text-slate-600 break-words [overflow-wrap:anywhere]"
        >
          {description}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={[
              'inline-flex min-w-[5.5rem] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-[filter,opacity] disabled:opacity-50',
              danger
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 shadow-sm shadow-rose-500/20 hover:brightness-105'
                : 'bg-gradient-to-r from-slate-800 to-slate-900 shadow-sm hover:brightness-105',
            ].join(' ')}
          >
            {busy && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
