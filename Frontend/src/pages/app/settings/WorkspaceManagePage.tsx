import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom'
import {
  AlertCircle,
  BarChart3,
  Bot,
  ChevronRight,
  FileText,
  FileType2,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { getApiErrorMessage } from '../../../api/errors'
import {
  createWorkspace,
  fetchWorkspace,
  updateWorkspace,
  type CreateWorkspaceBody,
  type UpdateWorkspaceBody,
} from '../../../api/workspaces'
import {
  deleteKnowledgeFile,
  fetchKnowledgeFiles,
  uploadKnowledgeFile,
  type KbFileListItem,
} from '../../../api/workspaceKnowledge'
import { deleteAgent } from '../../../api/agents'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import type { WsOutlet } from '../../../layouts/WorkspaceAppLayout'

const fieldLabel =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500'

const inputBase =
  'w-full rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 text-[14px] font-[family-name:var(--font-text)] text-slate-900 antialiased ' +
  'placeholder:text-slate-400 shadow-[0_1px_0_rgba(15,23,42,0.04)] ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-200/80'

const pageShell =
  'min-h-full font-[family-name:var(--font-text)] bg-[#F1F5F9] px-4 py-8 pb-20 sm:px-6 sm:py-10 sm:pb-24'

const cardClass =
  'rounded-2xl border border-slate-200/40 bg-white p-5 ' +
  'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_24px_-4px_rgba(15,23,42,0.07),0_12px_48px_-12px_rgba(15,23,42,0.1)] ' +
  'sm:p-6'

/** Cùng tông với tiêu đề AGENT / Lịch sử task ở `WorkspaceAppLayout`. */
const brandGradientText =
  'bg-gradient-to-r from-[#2563eb] via-blue-600 to-sky-500 bg-clip-text text-transparent'
const sectionHeading = [
  'inline-block text-[12px] font-bold uppercase tracking-[0.22em] [word-spacing:0.08em]',
  brandGradientText,
].join(' ')

const sectionHeaderRow = 'mb-4 flex min-w-0 items-center gap-2'
const sectionHeaderIcon = 'h-4 w-4 shrink-0 text-indigo-600'

const dropZoneClass =
  'flex min-h-[11rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-[border-color,background-color] '

/** Đồng bộ với `limits.fileSize` API knowledge (100MB). */
const MAX_KNOWLEDGE_FILE_BYTES = 100 * 1024 * 1024

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

type IngestLine =
  | { kind: 'none' }
  | { kind: 'pending' }
  | { kind: 'ok' }
  | { kind: 'err'; detail: string }

function kbIngestLine(f: KbFileListItem): IngestLine {
  const s = f.ingest_status
  if (s == null) return { kind: 'none' }
  if (s === 'failed') {
    return {
      kind: 'err',
      detail: f.ingest_error?.trim() || 'Lập chỉ mục thất bại (không có chi tiết).',
    }
  }
  if (s === 'indexed') return { kind: 'ok' }
  return { kind: 'pending' }
}

function fileIcon(mime: string | undefined, name: string) {
  const t = (mime ?? '').toLowerCase()
  if (t.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
    return <FileType2 className="h-4 w-4 text-red-500" strokeWidth={1.5} />
  }
  if (
    t.includes('word') ||
    t.includes('document') ||
    name.toLowerCase().endsWith('.docx')
  ) {
    return <FileText className="h-4 w-4 text-sky-600" strokeWidth={1.5} />
  }
  return <FileText className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
}

export function WorkspaceManagePage() {
  const { refresh, agents } = useOutletContext<WsOutlet>()
  const { workspaceId = '' } = useParams<{ workspaceId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const base = `/app/w/${workspaceId}`
  const isCreate = location.pathname.endsWith('/settings/workspace/new')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kbFiles, setKbFiles] = useState<KbFileListItem[]>([])
  const [plan, setPlan] = useState<string>('free')
  const [tokenLimit, setTokenLimit] = useState(0)
  const [tokensUsed, setTokensUsed] = useState(0)

  const [loadErr, setLoadErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [kbLoading, setKbLoading] = useState(!isCreate)
  const [kbBusy, setKbBusy] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [kbNotice, setKbNotice] = useState<{
    tone: 'error' | 'success'
    text: string
  } | null>(null)
  const [kbDeleteTarget, setKbDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [kbDeleteBusy, setKbDeleteBusy] = useState(false)
  const [agentDeleteTarget, setAgentDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [agentDeleteBusy, setAgentDeleteBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadEdit = useCallback(async () => {
    if (!workspaceId) return
    setLoadErr('')
    setKbLoading(true)
    try {
      const w = await fetchWorkspace(workspaceId)
      setName(w.name)
      setDescription((w.description ?? '').trim())
      setPlan(w.plan ?? 'free')
      setTokenLimit(w.token_limit ?? 0)
      setTokensUsed(w.tokens_used ?? 0)
      const files = await fetchKnowledgeFiles(workspaceId)
      setKbFiles(files)
    } catch (e) {
      setLoadErr(getApiErrorMessage(e, 'Không tải được workspace.'))
    } finally {
      setKbLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId || isCreate) return
    // Tách khỏi lượt commit của effect: ESLint cấm gọi hàm gây setState đồng bộ từ thân effect.
    const id = window.setTimeout(() => {
      void loadEdit()
    }, 0)
    return () => window.clearTimeout(id)
  }, [workspaceId, isCreate, loadEdit])

  useEffect(() => {
    document.title = isCreate
      ? 'Tạo workspace — ClawFlow'
      : 'Workspace & Kho tài liệu AI — ClawFlow'
  }, [isCreate])

  useEffect(() => {
    if (!kbNotice) return
    const t = window.setTimeout(() => setKbNotice(null), 7000)
    return () => window.clearTimeout(t)
  }, [kbNotice])

  const hasPendingIngest = useMemo(
    () => kbFiles.some((f) => f.ingest_status === 'pending'),
    [kbFiles],
  )

  useEffect(() => {
    if (!workspaceId || isCreate || !hasPendingIngest) return
    const id = window.setInterval(() => {
      void loadEdit()
    }, 2000)
    return () => window.clearInterval(id)
  }, [workspaceId, isCreate, hasPendingIngest, loadEdit])

  const totalKbBytes = useMemo(
    () => kbFiles.reduce((s, f) => s + f.size_bytes, 0),
    [kbFiles],
  )
  const tokenRatio =
    tokenLimit > 0
      ? Math.min(100, Math.round((tokensUsed / tokenLimit) * 100))
      : 0

  const onDropFiles = useCallback(
    async (files: FileList | null) => {
      if (isCreate || !files?.length || !workspaceId) return
      for (const f of Array.from(files)) {
        const ext = f.name.toLowerCase().split('.').pop()
        if (!ext || !['pdf', 'docx', 'txt'].includes(ext)) continue
        if (f.size > MAX_KNOWLEDGE_FILE_BYTES) {
          setKbNotice({
            tone: 'error',
            text: `“${f.name}” vượt quá 100MB. Hãy chọn tệp nhỏ hơn.`,
          })
          continue
        }
        setKbBusy(true)
        try {
          const row = await uploadKnowledgeFile(workspaceId, f)
          setKbFiles((list) => [row, ...list])
          setKbNotice({
            tone: 'success',
            text: `Đã tải lên “${f.name}”.`,
          })
        } catch (e) {
          setKbNotice({
            tone: 'error',
            text: getApiErrorMessage(e, 'Không tải lên được tệp.'),
          })
          break
        } finally {
          setKbBusy(false)
        }
      }
    },
    [isCreate, workspaceId],
  )

  const onKbDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropActive(true)
  }
  const onKbDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropActive(false)
  }
  const onKbDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropActive(false)
    void onDropFiles(e.dataTransfer?.files ?? null)
  }

  const confirmAgentDelete = async () => {
    if (!agentDeleteTarget || !workspaceId) return
    const { id, name } = agentDeleteTarget
    setAgentDeleteBusy(true)
    try {
      await deleteAgent(id)
      refresh()
      setAgentDeleteTarget(null)
      setKbNotice({
        tone: 'success',
        text: `Đã xoá agent “${name}”.`,
      })
    } catch (e) {
      setKbNotice({
        tone: 'error',
        text: getApiErrorMessage(e, 'Không xoá được agent.'),
      })
    } finally {
      setAgentDeleteBusy(false)
    }
  }

  const confirmKbFileDelete = async () => {
    if (!kbDeleteTarget || !workspaceId) return
    const { id } = kbDeleteTarget
    setKbDeleteBusy(true)
    try {
      await deleteKnowledgeFile(workspaceId, id)
      setKbFiles((l) => l.filter((f) => f._id !== id))
      setKbNotice({ tone: 'success', text: 'Đã xoá tệp khỏi Kho tài liệu AI.' })
      setKbDeleteTarget(null)
    } catch (e) {
      setKbNotice({
        tone: 'error',
        text: getApiErrorMessage(e, 'Không xoá được tệp.'),
      })
    } finally {
      setKbDeleteBusy(false)
    }
  }

  const onSave = async () => {
    if (!workspaceId) return
    setSaveErr('')
    if (isCreate && !name.trim()) {
      setSaveErr('Nhập tên cho workspace mới.')
      return
    }
    setSaving(true)
    try {
      if (isCreate) {
        const createBody: CreateWorkspaceBody = {
          name: name.trim(),
          description: description.trim() || undefined,
        }
        const created = await createWorkspace(createBody)
        refresh()
        navigate(`/app/w/${created._id}/settings/workspace`, { replace: true })
        return
      }
      const body: UpdateWorkspaceBody = {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      }
      await updateWorkspace(workspaceId, body)
      refresh()
      void loadEdit()
    } catch (e) {
      setSaveErr(
        getApiErrorMessage(
          e,
          isCreate
            ? 'Không tạo được. Có thể tài khoản đã có workspace.'
            : 'Không lưu được. Kiểm tra mạng hoặc thử lại.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loadErr) {
    return (
      <div className={pageShell}>
        <p className="text-center text-sm text-red-600" role="alert">
          {loadErr}
        </p>
      </div>
    )
  }

  return (
    <div className={pageShell}>
      <div className="mx-auto mb-[25px] grid w-full max-w-6xl grid-cols-1 items-start gap-4 sm:mb-[33px] sm:grid-cols-[1fr_minmax(0,40rem)_1fr] sm:items-start sm:gap-y-0">
        <div className="min-w-0 text-center sm:col-start-2 sm:row-start-1">
          <h1 className="text-[1.65rem] font-bold leading-tight tracking-[-0.03em] text-slate-900 sm:text-2xl">
            {isCreate ? 'Tạo workspace' : 'Workspace & Kho tài liệu AI'}
          </h1>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-500 sm:mt-2.5">
            {isCreate
              ? 'Form trống để thêm workspace mới. Sau khi tạo, bạn sẽ vào trang cấu hình — có sẵn dữ liệu vừa lưu, có thể tải tài liệu và tinh chỉnh tiếp.'
              : 'Đặt tên workspace và tài liệu tham khảo cho AI. Cách AI trả lời hoặc quy trình làm việc — chỉnh trong từng agent.'}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end sm:self-start">
          {isCreate && (
            <Link
              to={base + '/dashboard'}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              Hủy
            </Link>
          )}
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || (kbLoading && !isCreate)}
            className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-[filter,transform,box-shadow] duration-200 hover:brightness-[1.05] hover:shadow-indigo-500/35 active:translate-y-px active:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? '…'
              : isCreate
                ? 'Tạo workspace'
                : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {saveErr && (
        <p
          className="mx-auto mb-4 max-w-6xl text-sm text-red-600"
          role="alert"
        >
          {saveErr}
        </p>
      )}

      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr] lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <section className={cardClass}>
              <div className={sectionHeaderRow}>
                <FileText
                  className={sectionHeaderIcon}
                  strokeWidth={2}
                  aria-hidden
                />
                <h2 className={sectionHeading}>Thông tin workspace</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={fieldLabel} htmlFor="ws-name">
                    Tên workspace
                  </label>
                  <input
                    id="ws-name"
                    className={inputBase}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="ws-desc">
                    Mô tả dự án
                  </label>
                  <textarea
                    id="ws-desc"
                    className={inputBase + ' min-h-[5.5rem] resize-y'}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ngắn gọn: mục tiêu, bối cảnh, phạm vi — đặc biệt hữu ích khi tạo workspace mới…"
                    rows={4}
                  />
                </div>
              </div>
            </section>

            <section className={cardClass}>
              <div className={sectionHeaderRow}>
                <Upload
                  className={sectionHeaderIcon}
                  strokeWidth={2}
                  aria-hidden
                />
                <h2 className={sectionHeading}>Kho tài liệu AI</h2>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-slate-600">
                {isCreate
                  ? 'Tải tài liệu gắn với từng workspace — chỉ bật sau khi workspace đã được tạo và bạn ở trang cấu hình (có sẵn dữ liệu).'
                  : 'Tài liệu PDF, Word hoặc văn bản phục vụ AI tra cứu thông minh. Kéo thả hoặc chọn tệp — không thay thế Kỹ năng (Skill) hay Chỉ thị hệ thống của agent.'}
              </p>
              {kbNotice && (
                <div
                  role="alert"
                  className={[
                    'mb-4 flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm shadow-sm',
                    kbNotice.tone === 'error'
                      ? 'border-rose-200/90 bg-rose-50/95 text-rose-950'
                      : 'border-emerald-200/90 bg-emerald-50/95 text-emerald-950',
                  ].join(' ')}
                >
                  {kbNotice.tone === 'error' ? (
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                      aria-hidden
                    />
                  )}
                  <p className="min-w-0 flex-1 leading-relaxed">{kbNotice.text}</p>
                  <button
                    type="button"
                    onClick={() => setKbNotice(null)}
                    className={[
                      '-m-1 shrink-0 rounded-lg p-1.5 transition-colors',
                      kbNotice.tone === 'error'
                        ? 'text-rose-600 hover:bg-rose-100/80'
                        : 'text-emerald-700 hover:bg-emerald-100/80',
                    ].join(' ')}
                    aria-label="Đóng thông báo"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              )}
              {isCreate ? (
                <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
                  Sau khi bấm <strong className="text-slate-700">Tạo workspace</strong>, hệ
                  thống sẽ mở trang cấu hình cho workspace mới (đã điền) — tại
                  đó bạn tải .pdf, .docx, .txt như bình thường.
                </div>
              ) : (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        fileInputRef.current?.click()
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={onKbDragOver}
                    onDragLeave={onKbDragLeave}
                    onDrop={onKbDrop}
                    className={[
                      dropZoneClass,
                      dropActive
                        ? 'border-indigo-400/80 bg-indigo-50/50'
                        : 'border-slate-200/80 bg-slate-50/40 hover:border-slate-300/90 hover:bg-slate-50/70',
                    ].join(' ')}
                  >
                    {kbBusy ? (
                      <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                    ) : (
                      <Upload
                        className="h-7 w-7 text-slate-400"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="text-sm font-medium text-slate-700">
                      Thả tệp .pdf, .docx, .txt vào đây
                    </span>
                    <span className="text-xs text-slate-500">
                      Tối đa 100MB mỗi tệp
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      multiple
                      onChange={(e) => {
                        void onDropFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Tệp đã tải lên
                    </p>
                    {kbLoading ? (
                      <p className="text-sm text-slate-500">Đang tải danh sách…</p>
                    ) : kbFiles.length === 0 ? (
                      <p className="rounded-xl bg-slate-50/80 px-3 py-2 text-sm text-slate-500">
                        Chưa có tệp nào.
                      </p>
                    ) : (
                      <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                        {kbFiles.map((f) => (
                          <li
                            key={f._id}
                            className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100/90 bg-slate-50/50 px-2.5 py-2"
                          >
                            <span className="shrink-0" aria-hidden>
                              {fileIcon(f.mime_type, f.original_name)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-slate-800">
                                {f.original_name}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {formatBytes(f.size_bytes)} ·{' '}
                                {formatDate(f.createdAt)}
                              </p>
                              {(() => {
                                const line = kbIngestLine(f)
                                if (line.kind === 'none') return null
                                if (line.kind === 'pending') {
                                  return (
                                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
                                      <Loader2
                                        className="h-3 w-3 shrink-0 animate-spin"
                                        strokeWidth={2}
                                        aria-hidden
                                      />
                                      Đang phân tích dữ liệu cho AI…
                                    </p>
                                  )
                                }
                                if (line.kind === 'ok') {
                                  return (
                                    <p className="mt-0.5 text-[11px] font-medium text-emerald-800">
                                      Đã lập chỉ mục
                                    </p>
                                  )
                                }
                                return (
                                  <p
                                    className="mt-0.5 text-[11px] font-medium text-rose-800"
                                    title={line.detail}
                                  >
                                    Lỗi lập chỉ mục:{' '}
                                    <span className="font-normal text-rose-700/95">
                                      {line.detail}
                                    </span>
                                  </p>
                                )
                              })()}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setKbDeleteTarget({
                                  id: f._id,
                                  name: f.original_name,
                                })
                              }
                              disabled={kbBusy || kbDeleteBusy || kbDeleteTarget != null}
                              className="text-slate-400 hover:text-rose-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-rose-50/80"
                              title="Xoá"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <section className={cardClass}>
              <div className={sectionHeaderRow}>
                <Bot className={sectionHeaderIcon} strokeWidth={2} aria-hidden />
                <h2 className={sectionHeading}>Agent</h2>
              </div>
              {isCreate ? (
                <p className="text-sm leading-relaxed text-slate-600">
                  Tạo xong workspace, màn <strong className="text-slate-800">cấu hình (đã có dữ
                  liệu)</strong> sẽ có nút tạo agent. Bạn cũng mở từ thanh
                  bên: <em>AGENT</em> → tạo mới.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-sm leading-relaxed text-slate-600">
                    Agent dùng ngữ cảnh workspace bạn vừa cấu hình. Mở một agent
                    để sửa hoặc tạo thêm bên dưới.
                  </p>
                  {agents.length > 0 && (
                    <ul className="mb-4 max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-slate-100/90 bg-slate-50/50 p-1">
                      {agents.map((a) => (
                        <li
                          key={a._id}
                          className="flex min-w-0 items-center gap-0.5 rounded-lg"
                        >
                          <Link
                            to={`${base}/agents/${a._id}`}
                            state={{
                              returnTo: `${base}/settings/workspace`,
                            }}
                            className="group flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-2 text-left text-sm font-medium text-slate-800 transition hover:bg-white hover:shadow-sm"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {a.name}
                            </span>
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-600"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setAgentDeleteTarget({ id: a._id, name: a.name })
                            }
                            disabled={
                              agentDeleteBusy || agentDeleteTarget != null
                            }
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50/80 hover:text-rose-600 disabled:opacity-40"
                            title="Xoá agent"
                            aria-label={`Xoá agent ${a.name}`}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {agents.length === 0 && (
                    <p className="mb-3 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-center text-xs text-slate-500">
                      Chưa có agent nào trong workspace này.
                    </p>
                  )}
                  <Link
                    to={`${base}/agents/new`}
                    state={{
                      returnTo: `${base}/settings/workspace`,
                    }}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-105"
                  >
                    <Bot className="h-4 w-4" strokeWidth={1.5} />
                    Tạo agent mới
                  </Link>
                </>
              )}
            </section>

            <section className={cardClass}>
              <div className={sectionHeaderRow}>
                <BarChart3
                  className={sectionHeaderIcon}
                  strokeWidth={2}
                  aria-hidden
                />
                <h2 className={sectionHeading}>Thông số</h2>
              </div>
              <dl className="space-y-2.5 text-sm text-slate-700">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Gói</dt>
                  <dd className="font-medium text-slate-800">{plan}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Token đã dùng</dt>
                  <dd className="font-medium text-slate-800 tabular-nums">
                    {tokensUsed.toLocaleString('vi-VN')} /{' '}
                    {tokenLimit.toLocaleString('vi-VN')}
                  </dd>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-[#2563eb] transition-[width] duration-300"
                    style={{ width: `${tokenRatio}%` }}
                    role="progressbar"
                    aria-valuenow={tokenRatio}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Tệp knowledge</dt>
                  <dd className="font-medium text-slate-800 tabular-nums">
                    {kbFiles.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Dung lượng tài liệu</dt>
                  <dd className="font-medium text-slate-800 tabular-nums">
                    {formatBytes(totalKbBytes)}
                  </dd>
                </div>
                <div className="text-[11px] text-slate-500">
                  Đồng bộ dữ liệu phụ thuộc bản sao lưu server.
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={agentDeleteTarget != null}
        title="Xoá agent?"
        description={
          agentDeleteTarget ? (
            <>
              Agent{' '}
              <span className="font-medium text-slate-800 break-all">
                “{agentDeleteTarget.name}”
              </span>{' '}
              sẽ bị gỡ khỏi workspace. Nếu agent còn task, hệ thống sẽ từ chối
              xoá — hãy xử lý task trước.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Xoá agent"
        cancelLabel="Hủy"
        onClose={() => {
          if (!agentDeleteBusy) setAgentDeleteTarget(null)
        }}
        onConfirm={() => void confirmAgentDelete()}
        busy={agentDeleteBusy}
        danger
      />
      <ConfirmDialog
        open={kbDeleteTarget != null}
        title="Xoá tệp knowledge?"
        description={
          kbDeleteTarget ? (
            <>
              Tệp{' '}
              <span className="font-medium text-slate-800 break-all">
                “{kbDeleteTarget.name}”
              </span>{' '}
              sẽ bị gỡ khỏi Kho tài liệu AI và kho lưu trữ. Bạn chắc chắn?
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Xoá tệp"
        cancelLabel="Hủy"
        onClose={() => {
          if (!kbDeleteBusy) setKbDeleteTarget(null)
        }}
        onConfirm={() => void confirmKbFileDelete()}
        busy={kbDeleteBusy}
        danger
      />
    </div>
  )
}
