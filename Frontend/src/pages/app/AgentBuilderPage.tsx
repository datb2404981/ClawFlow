import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type DragEvent,
  type MouseEvent,
} from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom'
import {
  Check,
  FileText,
  Globe,
  Info,
  Layers,
  LayoutTemplate,
  Maximize2,
  Paperclip,
  Pencil,
  PlusCircle,
  ScanLine,
  ScrollText,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import {
  createAgent,
  fetchAgent,
  refineSystemPrompt,
  type Agent,
  updateAgent,
} from '../../api/agents'
import { getApiErrorMessage } from '../../api/errors'
import {
  createSkillTemplate,
  fetchSkillTemplates,
  updateSkillTemplate,
  type SkillTemplate,
  type SkillTemplateIconKey,
} from '../../api/skillTemplates'
import type { WsOutlet } from '../../layouts/WorkspaceAppLayout'

const fieldLabel =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500'

const inputBase =
  'w-full rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 text-[14px] font-[family-name:var(--font-text)] text-slate-900 antialiased ' +
  'placeholder:text-slate-400 shadow-[0_1px_0_rgba(15,23,42,0.04)] ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-200/80'

const pageShell =
  'min-h-full font-[family-name:var(--font-text)] bg-[#F1F5F9] px-4 py-8 pb-20 sm:px-6 sm:py-10 sm:pb-24'

/** Card — glass / ambient: nổi trên nền #F1F5F9. */
const cardClass =
  'rounded-2xl border border-slate-200/40 bg-white p-5 ' +
  'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_24px_-4px_rgba(15,23,42,0.07),0_12px_48px_-12px_rgba(15,23,42,0.1)] ' +
  'sm:p-6'

const sectionIcon = 'h-3.5 w-3.5 shrink-0 text-indigo-600'
const sectionIconSm = 'h-3 w-3 shrink-0 text-indigo-600'

const sectionTitle =
  'mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-800'

/** Nhãn khu thêm kỹ năng — khoảng cách tới ô nhập rộng hơn. */
const addSkillFieldLabel =
  'mb-2.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500'

/** Ô form thêm kỹ năng: nền trắng, viền xám mảnh, bo xl. */
const skillFormInputClass =
  'w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-[family-name:var(--font-text)] text-slate-900 antialiased ' +
  'placeholder:text-slate-400 shadow-[0_1px_0_rgba(15,23,42,0.03)] ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200/70'

const skillAttachBtnClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white ' +
  'text-slate-500 shadow-[0_1px_0_rgba(15,23,42,0.03)] ' +
  'transition-[background-color,border-color,color,box-shadow] duration-150 ' +
  'hover:border-slate-300 hover:bg-slate-50/90 hover:text-slate-700 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/50'

const SKILL_ADD_CONTENT_PLACEHOLDER =
  'Dán nội dung hoặc kéo thả file .md, .txt vào đây'

const modalBackdropClass =
  'absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity'

const modalShellClass =
  'relative z-10 flex min-h-0 w-[min(92vw,1200px)] max-h-[min(90vh,900px)] flex-col overflow-hidden ' +
  'rounded-3xl border border-slate-100/90 bg-white shadow-2xl shadow-slate-300/25'

const skillEditorModalTextareaClass =
  'h-full w-full min-h-0 flex-1 resize-none rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4 ' +
  'font-mono text-[13px] leading-relaxed text-slate-800 ' +
  'placeholder:text-slate-400/85 ' +
  'focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/15'

const modalBtnSecondary =
  'rounded-xl border border-slate-200 bg-white/95 px-5 py-2.5 text-sm font-medium text-slate-600 ' +
  'shadow-sm transition-colors hover:bg-slate-50'
const modalBtnPrimary =
  'rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white ' +
  'shadow-md transition-[filter,transform] hover:brightness-110 active:scale-[0.99]'

/** Công tắc gọn, chỉ tại công tắc. */
function SkillSwitch({
  on,
  onToggle,
  id,
}: {
  on: boolean
  onToggle: () => void
  id?: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={on}
      onClick={(e: MouseEvent) => {
        e.stopPropagation()
        onToggle()
      }}
      className={[
        'relative h-[22px] w-10 shrink-0 cursor-pointer rounded-full p-0.5 transition-[background-color,box-shadow] duration-200 ease-out',
        on
          ? 'bg-[#2563ff] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]'
          : 'bg-slate-200/80 hover:bg-slate-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563ff]/30 focus-visible:ring-offset-1',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-sm',
          'ring-0 transition-transform duration-200 will-change-transform [transition-timing-function:cubic-bezier(0.34,1.2,0.64,1)]',
          on ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
        ].join(' ')}
        aria-hidden
      />
    </button>
  )
}

function InfoModal({
  open,
  title,
  description,
  content,
  readOnlyNote,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  content: string
  readOnlyNote?: string
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px] transition-opacity"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(85vh,32rem)] w-full max-w-lg flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50"
        role="dialog"
        aria-modal
        aria-labelledby="skill-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="skill-info-title"
          className="pr-8 text-sm font-semibold leading-snug text-slate-900"
        >
          {title}
        </h2>
        {description.trim() && (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {description.trim()}
          </p>
        )}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100 bg-[#F8FAFC] p-2.5">
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-800">
            {content}
          </pre>
        </div>
        {readOnlyNote && (
          <p className="mt-2 text-[10px] text-slate-500">{readOnlyNote}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg border border-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Đóng
        </button>
      </div>
    </div>
  )
}

function SkillContentEditorModal({
  open,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  open: boolean
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5"
      role="presentation"
    >
      <button
        type="button"
        className={modalBackdropClass}
        aria-label="Hủy"
        onClick={onCancel}
      />
      <div
        className={modalShellClass + ' h-[min(90vh,880px)]'}
        role="dialog"
        aria-modal
        aria-labelledby="skill-draft-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2
            id="skill-draft-modal-title"
            className="text-base font-semibold tracking-tight text-slate-900"
          >
            Soạn thảo nội dung kỹ năng
          </h2>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 sm:px-5">
          <textarea
            className={skillEditorModalTextareaClass + ' min-h-0 flex-1'}
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Markdown, hướng dẫn, logic — font monospace."
          />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3.5 sm:px-6">
          <button type="button" onClick={onCancel} className={modalBtnSecondary}>
            Hủy
          </button>
          <button type="button" onClick={onConfirm} className={modalBtnPrimary}>
            Xong
          </button>
        </div>
      </div>
    </div>
  )
}

const PLACEHOLDERS = {
  name: 'Ví dụ: Trợ lý tóm tắt báo cáo',
  description:
    'Ví dụ: Đọc tài liệu dài, trích ý chính và gợi ý bước tiếp theo cho team',
  systemPrompt: [
    'Bạn là trợ lý hỗ trợ workspace này.',
    '',
    'Trả lời ngắn gọn. Khi tham chiếu web, ghi kèm một dòng nguồn.',
    'Nếu thiếu dữ liệu, hãy nói rõ cần thêm thông tin gì.',
  ].join('\n'),
} as const

const MAX_SKILL_FILE_BYTES = 2 * 1024 * 1024

function stripFileBaseName(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename
  return base.replace(/\.[^.]+$/, '') || 'Kỹ năng'
}

function scanSkillContentForWarnings(text: string): string[] {
  const w: string[] = []
  if (/<\s*script/i.test(text) || /<\s*\/\s*script/i.test(text)) {
    w.push('Có mẫu thẻ script — hãy xác minh nội dung trước khi lưu.')
  }
  if (/javascript:\s*[^\s]/i.test(text)) {
    w.push('Có "javascript:" — kiểm tra lại.')
  }
  if (
    /ignore\s+(previous|prior|all|above)\s+instructions?/i.test(text) ||
    /system\s*:\s*you\s+are\s+now/i.test(text)
  ) {
    w.push('Có chuỗi giống kỹ thuật prompt-injection — xem lại nội dung.')
  }
  if (/\b(?:curl|wget|\/bin\/|exec\s*\(|child_process)\b/i.test(text)) {
    w.push('Có từ khóa/ lệnh có thể nhạy cảm — hãy xác minh nguồn file.')
  }
  if (
    /AKIA[0-9A-Z]{16}/.test(text) ||
    /\bsk-[a-zA-Z0-9]{20,}/.test(text) ||
    /\bghp_[a-zA-Z0-9]{20,}/.test(text) ||
    /\bxox[baprs]-[a-zA-Z0-9-]+/.test(text)
  ) {
    w.push(
      'Có thể chứa chuỗi giống API key/secret — không dùng FE làm bảo vệ tuyệt đối.',
    )
  }
  return w
}

const TEMPLATE_ICON_BOX = 'bg-amber-50 text-amber-700'

const SKILL_ICON_UI: Record<
  SkillTemplateIconKey,
  { Icon: typeof FileText; iconBox: string }
> = {
  doc: {
    Icon: FileText,
    iconBox: 'bg-sky-50 text-sky-600',
  },
  canvas: {
    Icon: LayoutTemplate,
    iconBox: 'bg-violet-50 text-violet-600',
  },
  browser: {
    Icon: Globe,
    iconBox: 'bg-emerald-50 text-emerald-600',
  },
  scan: {
    Icon: ScanLine,
    iconBox: 'bg-amber-50 text-amber-800',
  },
}

function skillTemplateIconUI(t: SkillTemplate) {
  const k = t.icon
  if (k && k in SKILL_ICON_UI) {
    return SKILL_ICON_UI[k as SkillTemplateIconKey]
  }
  return { Icon: FileText, iconBox: TEMPLATE_ICON_BOX }
}

type AgentBuilderLocationState = {
  returnTo?: string
}

/** Chỉ cho phép quay lại đúng `/app/w/:id/settings/workspace` của workspace hiện tại (tránh open redirect). */
function safeWorkspaceSettingsReturn(
  raw: string | undefined,
  workspaceId: string | undefined,
): string | null {
  if (!raw?.trim() || !workspaceId) return null
  const path = raw.trim().replace(/\/$/, '') || raw.trim()
  const m = /^\/app\/w\/([^/]+)\/settings\/workspace$/.exec(path)
  if (!m || m[1] !== workspaceId) return null
  return path
}

export function AgentBuilderPage() {
  const { refresh } = useOutletContext<WsOutlet>()
  const { workspaceId, agentId } = useParams<{
    workspaceId: string
    agentId?: string
  }>()
  const loc = useLocation()
  const nav = useNavigate()
  const isCreate = !agentId

  const returnToWorkspace = useMemo(
    () =>
      safeWorkspaceSettingsReturn(
        (loc.state as AgentBuilderLocationState | null)?.returnTo,
        workspaceId,
      ),
    [loc.state, workspaceId],
  )

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [templates, setTemplates] = useState<SkillTemplate[]>([])
  const [selectedTpl, setSelectedTpl] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [refining, setRefining] = useState(false)
  const [err, setErr] = useState('')

  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillDescription, setNewSkillDescription] = useState('')
  const [newSkillContent, setNewSkillContent] = useState('')
  const [newSkillFileLabel, setNewSkillFileLabel] = useState<string | null>(
    null,
  )
  const [newSkillWarnings, setNewSkillWarnings] = useState<string[]>([])
  const [skillSubmitting, setSkillSubmitting] = useState(false)
  const [skillMsg, setSkillMsg] = useState('')

  const [infoTemplate, setInfoTemplate] = useState<SkillTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<SkillTemplate | null>(
    null,
  )
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [skillContentModalOpen, setSkillContentModalOpen] = useState(false)
  const skillContentModalSnapshotRef = useRef('')
  const [skillDropActive, setSkillDropActive] = useState(false)
  const skillFileInputRef = useRef<HTMLInputElement>(null)

  /** Toast sau lưu agent — không dùng banner; tự ẩn sau vài giây. */
  const [saveSuccessToast, setSaveSuccessToast] = useState<{
    open: boolean
    workspacePath: string | null
  }>({ open: false, workspacePath: null })
  const saveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismissSaveToast = () => {
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current)
      saveToastTimerRef.current = null
    }
    setSaveSuccessToast({ open: false, workspacePath: null })
  }

  const showSaveSuccessToast = (workspacePath: string | null) => {
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current)
    }
    setSaveSuccessToast({ open: true, workspacePath })
    saveToastTimerRef.current = setTimeout(() => {
      saveToastTimerRef.current = null
      setSaveSuccessToast({ open: false, workspacePath: null })
    }, 6500)
  }

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!workspaceId) return
    void fetchSkillTemplates(workspaceId)
      .then(setTemplates)
      .catch(() => [])
  }, [workspaceId])

  useEffect(() => {
    if (isCreate || !agentId || !workspaceId) return
    void (async () => {
      const a: Agent = await fetchAgent(agentId, workspaceId)
      setName(a.name)
      setDescription(a.description ?? '')
      setSystemPrompt(a.system_prompt)
      setSelectedTpl(
        new Set(
          (a.enabled_skill_template_ids ?? []).map((x) =>
            typeof x === 'string' ? x : (x as { _id: string })._id,
          ),
        ),
      )
    })()
  }, [agentId, isCreate, workspaceId])

  const toggleTemplate = (id: string) => {
    setSelectedTpl((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const loadTemplates = () => {
    if (!workspaceId) return
    void fetchSkillTemplates(workspaceId)
      .then(setTemplates)
      .catch(() => [])
  }

  const beginEditSkill = (t: SkillTemplate) => {
    setInfoTemplate(null)
    setEditError('')
    setEditingTemplate(t)
    setEditName(t.name)
    setEditDescription((t.description ?? '').toString().trim())
    setEditContent(t.content)
  }

  const closeEdit = () => {
    setEditError('')
    setEditingTemplate(null)
  }

  const saveEditSkill = async () => {
    if (!workspaceId || !editingTemplate) return
    setEditSaving(true)
    setEditError('')
    setSkillMsg('')
    try {
      const nextName = editName.trim()
      const content = editContent.trim()
      if (!content) {
        setEditError('Nội dung kỹ năng không được để trống.')
        return
      }
      await updateSkillTemplate(workspaceId, editingTemplate._id, {
        name: nextName || 'Kỹ năng',
        content,
        description: editDescription.trim(),
      })
      closeEdit()
      loadTemplates()
    } catch (e) {
      setEditError(
        e instanceof Error
          ? e.message
          : 'Không cập nhật được (chỉ người tạo mới sửa được mẫu workspace).',
      )
    } finally {
      setEditSaving(false)
    }
  }

  const applySkillFile = async (f: File) => {
    setSkillMsg('')
    if (f.size > MAX_SKILL_FILE_BYTES) {
      setSkillMsg(
        `File lớn hơn ${MAX_SKILL_FILE_BYTES / 1024 / 1024}MB. Chọn file nhỏ hơn.`,
      )
      return
    }
    setNewSkillFileLabel(f.name)
    const text = await f.text()
    setNewSkillContent(text)
    setNewSkillWarnings(scanSkillContentForWarnings(text))
    setNewSkillName((n) => (n.trim() ? n : stripFileBaseName(f.name)))
  }

  const onSkillFile: ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    await applySkillFile(f)
  }

  const onSkillContentDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSkillDropActive(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    const allowed =
      /\.(md|txt|json|markdown)$/i.test(f.name) ||
      /^text\//.test(f.type) ||
      f.type === 'application/json'
    if (!allowed) {
      setSkillMsg('Chỉ hỗ trợ .md, .txt, .json hoặc văn bản thuần.')
      return
    }
    await applySkillFile(f)
  }

  const openSkillContentModal = () => {
    skillContentModalSnapshotRef.current = newSkillContent
    setSkillContentModalOpen(true)
  }

  const confirmSkillContentModal = () => {
    setSkillContentModalOpen(false)
  }

  const cancelSkillContentModal = () => {
    setNewSkillContent(skillContentModalSnapshotRef.current)
    setNewSkillWarnings(
      scanSkillContentForWarnings(skillContentModalSnapshotRef.current),
    )
    setSkillContentModalOpen(false)
  }

  const onCreateSkillFromContent = async () => {
    if (!workspaceId) return
    setSkillMsg('')
    const content = newSkillContent.trim()
    if (!newSkillName.trim() || !content) {
      setSkillMsg('Nhập tên skill và nội dung (từ file hoặc dán bên dưới).')
      return
    }
    setSkillSubmitting(true)
    try {
      const desc = newSkillDescription.trim()
      const created = await createSkillTemplate({
        workspace_id: workspaceId,
        name: newSkillName.trim(),
        ...(desc ? { description: desc } : {}),
        content,
        visibility: 'workspace',
      })
      setNewSkillFileLabel(null)
      setNewSkillContent('')
      setNewSkillName('')
      setNewSkillDescription('')
      setNewSkillWarnings([])
      loadTemplates()
      if (agentId) {
        setSelectedTpl((s) => {
          const n = new Set(s)
          n.add(created._id)
          return n
        })
        setSkillMsg(
          'Đã tạo kỹ năng và bật cho agent. Nhấn Lưu agent để lưu danh sách.',
        )
      } else {
        setSkillMsg(
          'Đã tạo kỹ năng trong workspace. Bật công tắc ở thư viện rồi Lưu agent.',
        )
      }
    } catch (e) {
      setSkillMsg(
        e instanceof Error ? e.message : 'Không tạo được skill template',
      )
    } finally {
      setSkillSubmitting(false)
    }
  }

  const onRefineSystemPrompt = async () => {
    const raw = systemPrompt.trim()
    if (!raw) {
      setErr('Nhập nội dung system prompt trước khi tối ưu.')
      return
    }
    setErr('')
    setRefining(true)
    try {
      const r = await refineSystemPrompt(raw)
      setSystemPrompt(r.data)
    } catch (e) {
      console.error('[refineSystemPrompt]', e)
      setErr(
        getApiErrorMessage(
          e,
          'Không tối ưu được prompt. Vui lòng thử lại.',
        ),
      )
    } finally {
      setRefining(false)
    }
  }

  const onSave = async () => {
    setErr('')
    setSaving(true)
    const enabled = [...selectedTpl]
    try {
      if (isCreate) {
        const created = await createAgent({
          name: name.trim(),
          workspace_id: workspaceId!,
          description: description.trim() || undefined,
          system_prompt:
            systemPrompt.trim() ||
            'Bạn là trợ lý cho workspace. Trả lời súc tích, thân thiện.',
          built_in_tools: [],
          enabled_skill_template_ids: enabled.length ? enabled : undefined,
        })
        refresh()
        const ret = (loc.state as AgentBuilderLocationState | null)?.returnTo
        nav(`/app/w/${workspaceId}/agents/${created._id}`, {
          replace: true,
          state: ret ? { returnTo: ret } : undefined,
        })
        showSaveSuccessToast(returnToWorkspace)
      } else {
        await updateAgent(agentId!, {
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          system_prompt: systemPrompt.trim() || undefined,
          built_in_tools: [],
          enabled_skill_template_ids: enabled,
        })
        refresh()
        showSaveSuccessToast(returnToWorkspace)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không lưu được. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={pageShell}>
      <SkillContentEditorModal
        open={skillContentModalOpen}
        value={newSkillContent}
        onChange={(v) => {
          setNewSkillContent(v)
          setNewSkillWarnings(scanSkillContentForWarnings(v))
        }}
        onConfirm={confirmSkillContentModal}
        onCancel={cancelSkillContentModal}
      />
      <InfoModal
        open={!!infoTemplate}
        title={infoTemplate?.name ?? ''}
        description={
          infoTemplate
            ? (() => {
                const d = (infoTemplate.description ?? '').toString().trim()
                return d
                  ? d
                  : 'Chưa có mô tả ngắn. Nội dung đầy đủ bên dưới.'
              })()
            : ''
        }
        content={infoTemplate?.content ?? ''}
        readOnlyNote={
          infoTemplate?.is_system
            ? 'Mẫu hệ thống — chỉ xem, không sửa từ đây.'
            : undefined
        }
        onClose={() => setInfoTemplate(null)}
      />

      {editingTemplate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className={modalBackdropClass}
            aria-label="Đóng"
            onClick={closeEdit}
          />
          <div
            className={modalShellClass + ' h-[min(90vh,880px)]'}
            role="dialog"
            aria-modal
            aria-labelledby="edit-skill-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2
                id="edit-skill-modal-title"
                className="text-base font-semibold tracking-tight text-slate-900"
              >
                Sửa kỹ năng
              </h2>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
              <div className="flex min-h-0 min-h-[min(40vh,20rem)] flex-col border-slate-100 p-4 sm:p-5 lg:min-h-0 lg:border-r">
                <label
                  className={addSkillFieldLabel + ' text-slate-600'}
                  htmlFor="modal-edit-content"
                >
                  Nội dung
                </label>
                <textarea
                  id="modal-edit-content"
                  className={
                    skillEditorModalTextareaClass +
                    ' mt-2.5 min-h-0 flex-1 !rounded-xl'
                  }
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  spellCheck={false}
                  placeholder="Nội dung đầy đủ (markdown)…"
                />
              </div>
              <div className="flex min-h-0 flex-col p-4 sm:p-5">
                <div className="space-y-4">
                  <div>
                    <label
                      className={addSkillFieldLabel}
                      htmlFor="modal-edit-name"
                    >
                      Tên kỹ năng
                    </label>
                    <input
                      id="modal-edit-name"
                      className={skillFormInputClass + ' h-10 text-sm'}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label
                      className={addSkillFieldLabel}
                      htmlFor="modal-edit-desc"
                    >
                      Mô tả ngắn
                    </label>
                    <input
                      id="modal-edit-desc"
                      className={skillFormInputClass + ' text-sm'}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Tùy chọn"
                      autoComplete="off"
                    />
                  </div>
                </div>
                {editError && (
                  <p
                    className="mt-4 text-sm leading-relaxed text-red-600"
                    role="alert"
                  >
                    {editError}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap justify-end gap-2 pt-6">
                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={editSaving}
                    className={
                      modalBtnSecondary + ' disabled:cursor-not-allowed disabled:opacity-50'
                    }
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={saveEditSkill}
                    disabled={editSaving}
                    className={
                      modalBtnPrimary +
                      ' min-w-[5.5rem] disabled:cursor-not-allowed disabled:opacity-50'
                    }
                  >
                    {editSaving ? '…' : 'Lưu'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {saveSuccessToast.open && (
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[220] flex max-w-[min(22rem,calc(100vw-2rem))] flex-col items-end gap-2 sm:bottom-6 sm:right-6"
          role="status"
          aria-live="polite"
        >
          <div
            className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-3 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.12)] backdrop-blur-md"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-600">
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug text-slate-700">
                Đã lưu thành công!
                {saveSuccessToast.workspacePath ? (
                  <>
                    {' '}
                    <Link
                      to={saveSuccessToast.workspacePath}
                      onClick={dismissSaveToast}
                      className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-[3px] transition-colors hover:decoration-slate-500"
                    >
                      Quay về Workspace
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissSaveToast}
              className="-m-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100/80 hover:text-slate-600"
              aria-label="Đóng thông báo"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto mb-10 flex max-w-6xl flex-col gap-4 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[1.65rem] font-bold leading-tight tracking-[-0.03em] text-slate-900 sm:text-2xl">
            {isCreate ? 'Cấu hình agent' : 'Chỉnh sửa agent'}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
            Điều khiển hành vi, prompt hệ thống và bộ kỹ năng cho agent trong workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || refining}
          className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-[filter,transform,box-shadow] duration-200 hover:brightness-[1.05] hover:shadow-indigo-500/35 active:translate-y-px active:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? '…' : 'Lưu agent'}
        </button>
      </div>
      {err && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {err}
        </p>
      )}

      <div className="mx-auto max-w-6xl">
        <div
          className={
            workspaceId
              ? 'grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr] lg:items-start lg:gap-8'
              : 'flex flex-col gap-6'
          }
        >
            <div className="flex min-w-0 flex-col gap-6">
              <section className={cardClass}>
                <h2 className={sectionTitle}>
                  <User className={sectionIcon} strokeWidth={2} aria-hidden />
                  Thông tin cơ bản
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <div className="min-w-0">
                    <label className={fieldLabel} htmlFor="agent-name">
                      Tên agent
                    </label>
                    <input
                      id="agent-name"
                      className={inputBase + ' bg-slate-50/50'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={PLACEHOLDERS.name}
                      autoComplete="off"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={fieldLabel} htmlFor="agent-desc">
                      Mô tả
                    </label>
                    <input
                      id="agent-desc"
                      className={inputBase + ' bg-slate-50/50'}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={PLACEHOLDERS.description}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </section>

              <section
                className={
                  cardClass +
                  ' flex min-h-0 flex-col lg:min-h-[min(70vh,calc(36rem+100px))]'
                }
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-800">
                    <ScrollText
                      className={sectionIcon}
                      strokeWidth={2}
                      aria-hidden
                    />
                    System prompt
                  </h2>
                  <button
                    type="button"
                    onClick={onRefineSystemPrompt}
                    disabled={refining || !systemPrompt.trim()}
                    title="Gửi tới server — tối ưu bằng AI"
                    className={[
                      'inline-flex items-center gap-1 rounded-lg border border-indigo-200/60 bg-indigo-50/60 px-2.5 py-1.5 text-[10px] font-semibold',
                      'text-indigo-800 transition-colors',
                      refining || !systemPrompt.trim()
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:border-indigo-300 hover:bg-indigo-50',
                    ].join(' ')}
                  >
                    <Sparkles
                      className="h-3 w-3 shrink-0 text-indigo-600"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    {refining ? 'Đang tối ưu…' : 'Tối ưu bằng AI'}
                  </button>
                </div>
                <textarea
                  id="agent-system"
                  spellCheck={false}
                  className={
                    'w-full min-h-[calc(20rem)] flex-1 resize-y rounded-xl border border-indigo-200/50 bg-indigo-50/30 ' +
                    'px-3.5 py-3 font-[family-name:var(--font-orch)] text-[13px] leading-[1.65] text-slate-800 antialiased ' +
                    'placeholder:text-slate-400/90 shadow-[inset_0_1px_2px_rgba(79,70,229,0.05)] ' +
                    'selection:bg-indigo-200/40 ' +
                    'focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ' +
                    'sm:min-h-[calc(22rem+100px)] lg:min-h-0'
                  }
                  rows={14}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={PLACEHOLDERS.systemPrompt}
                />
              </section>
            </div>

            {workspaceId && (
            <aside className="flex w-full min-w-0 flex-col gap-5 self-stretch lg:sticky lg:top-6">
              <section className={`${cardClass} w-full`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="mb-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-800">
                    <Layers
                      className={sectionIconSm}
                      strokeWidth={2}
                      aria-hidden
                    />
                    Kỹ năng
                  </h2>
                  {templates.length > 0 && (
                    <span className="text-[9px] font-medium tabular-nums text-slate-500">
                      {templates.length}
                    </span>
                  )}
                </div>
                <p className="mb-2 text-[10px] leading-snug text-slate-500">
                  Bật/tắt mẫu. (i) xem toàn bộ nội dung.
                </p>
                <div className="relative -mx-0.5 min-h-0">
                  <div
                    className={
                      'claw-skill-list-scroll scrollbar-hide min-h-0 max-h-[min(15rem,40vh)] overflow-x-hidden ' +
                      'overflow-y-auto overscroll-y-contain px-0.5 sm:max-h-60'
                    }
                  >
                  <div className="divide-y divide-slate-200/60 border-t border-slate-200/50">
                    {templates.length === 0 && (
                      <p className="py-5 text-center text-[11px] text-slate-400">
                        Chưa có mẫu
                      </p>
                    )}
                    {templates.map((t) => {
                const sel = selectedTpl.has(t._id)
                const { Icon, iconBox } = skillTemplateIconUI(t)
                const descHint = (t.description ?? '').toString().trim()
                const nameTitle =
                  descHint || 'Xem mô tả & nội dung qua biểu tượng (i).'
                return (
                  <div
                    key={t._id}
                    className={[
                      'group/skill flex w-full min-w-0 items-center gap-2 py-2.5 pr-0 pl-0.5',
                      'transition-colors duration-150',
                      sel
                        ? 'bg-indigo-50/35'
                        : 'hover:bg-slate-50/60',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        'opacity-80 transition-opacity group-hover/skill:opacity-100',
                        iconBox,
                      ].join(' ')}
                      aria-hidden
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <p
                      className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold text-slate-800"
                      title={nameTitle}
                    >
                      {t.name}
                    </p>
                    <span
                      className={[
                        'shrink-0 rounded-md border text-[7px] font-bold uppercase leading-none',
                        'px-1.5 py-0.5 tracking-wide',
                        t.is_system
                          ? 'border-slate-200/90 bg-slate-50/90 text-slate-600'
                          : 'border-amber-200/60 bg-amber-50/90 text-amber-800/90',
                      ].join(' ')}
                      title={t.is_system ? 'Hệ thống' : 'Workspace'}
                    >
                      {t.is_system ? 'HT' : 'WS'}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
                      {!t.is_system && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            beginEditSkill(t)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100/90 hover:text-slate-600"
                          aria-label="Sửa kỹ năng"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInfoTemplate(t)
                        }}
                        title={descHint || 'Xem mô tả & nội dung'}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100/90 hover:text-slate-600"
                        aria-label="Thông tin kỹ năng"
                      >
                        <Info className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <div className="pl-0.5">
                        <SkillSwitch
                          on={sel}
                          onToggle={() => toggleTemplate(t._id)}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
                  </div>
                </div>
                </div>
              </section>

              <section
                className={[
                  cardClass,
                  'w-full border-t-0',
                  'bg-white',
                ].join(' ')}
              >
                <h2 className="mb-5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-800">
                  <PlusCircle
                    className={sectionIconSm}
                    strokeWidth={2}
                    aria-hidden
                  />
                  Thêm kỹ năng tùy chỉnh
                </h2>
                <input
                  ref={skillFileInputRef}
                  id="skill-file-attach"
                  type="file"
                  accept=".md,.txt,.json,text/plain,text/markdown,application/json"
                  onChange={onSkillFile}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                />
                <div className="flex flex-col gap-5">
                  <div>
                    <label
                      className={addSkillFieldLabel}
                      htmlFor="skill-name"
                    >
                      Tên kỹ năng
                    </label>
                    <div className="flex h-10 w-full min-w-0 items-stretch gap-2">
                      <input
                        id="skill-name"
                        className={skillFormInputClass + ' h-10 min-w-0 flex-1 py-0 leading-10'}
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        placeholder="Đặt tên hoặc tải từ file"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => skillFileInputRef.current?.click()}
                        title="Tải file .md, .txt, .json"
                        className={skillAttachBtnClass}
                        aria-label="Đính kèm file"
                      >
                        <Paperclip
                          className="h-[18px] w-[18px] opacity-70"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </button>
                    </div>
                    {newSkillFileLabel && (
                      <p className="mt-2 flex min-w-0 items-center gap-1 text-[10px] text-slate-500">
                        <FileText
                          className="h-2.5 w-2.5 shrink-0 text-slate-400"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span className="truncate">{newSkillFileLabel}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className={addSkillFieldLabel}
                      htmlFor="skill-short-desc"
                    >
                      Mô tả ngắn
                    </label>
                    <input
                      id="skill-short-desc"
                      className={skillFormInputClass + ' text-[13px]'}
                      value={newSkillDescription}
                      onChange={(e) => setNewSkillDescription(e.target.value)}
                      placeholder="Tùy chọn — gợi ý nhanh khi cần"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <div className="mb-2.5 flex items-end justify-between gap-2">
                      <label
                        className="mb-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                        htmlFor="skill-content"
                      >
                        Nội dung
                      </label>
                      <button
                        type="button"
                        onClick={openSkillContentModal}
                        className="inline-flex max-w-[10rem] shrink-0 items-center gap-1 text-[10px] font-medium text-slate-400 transition-colors hover:text-slate-700"
                        title="Soạn ở màn hình lớn"
                      >
                        <Maximize2
                          className="h-3 w-3 opacity-50"
                          strokeWidth={2}
                          aria-hidden
                        />
                        Mở rộng soạn thảo
                      </button>
                    </div>
                    <div
                      role="presentation"
                      onDragEnter={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (e.dataTransfer.types?.includes('Files')) {
                          setSkillDropActive(true)
                        }
                      }}
                      onDragLeave={(e) => {
                        const r = e.relatedTarget as Node | null
                        if (r && e.currentTarget.contains(r)) return
                        setSkillDropActive(false)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (e.dataTransfer.types?.includes('Files')) {
                          e.dataTransfer.dropEffect = 'copy'
                        }
                        setSkillDropActive(true)
                      }}
                      onDrop={onSkillContentDrop}
                      className={[
                        'overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200',
                        skillDropActive
                          ? 'border-indigo-300/50 bg-indigo-50/60 shadow-[0_0_0_1px_rgba(99,102,241,0.12)]'
                          : 'border-slate-200/70 bg-white',
                      ].join(' ')}
                    >
                      <textarea
                        id="skill-content"
                        spellCheck={false}
                        rows={5}
                        className={
                          'w-full min-h-[8.5rem] resize-y border-0 bg-transparent px-3 py-2.5 ' +
                          'font-mono text-[12px] leading-[1.6] text-slate-800 ' +
                          'placeholder:text-slate-400/90 ' +
                          'focus:outline-none focus:ring-0'
                        }
                        value={newSkillContent}
                        onChange={(e) => {
                          const t = e.target.value
                          setNewSkillContent(t)
                          setNewSkillWarnings(scanSkillContentForWarnings(t))
                        }}
                        placeholder={SKILL_ADD_CONTENT_PLACEHOLDER}
                      />
                    </div>
                    <p className="mt-1.5 text-[9px] leading-snug text-slate-400/90">
                      Kéo thả file vào vùng trên; nội dung gộp với bản gõ nội
                      tuyến.
                    </p>
                  </div>
                  {newSkillWarnings.length > 0 && (
                    <ul
                      className="list-inside list-disc space-y-0.5 text-[10px] font-medium text-amber-800/90"
                      role="status"
                    >
                      {newSkillWarnings.map((line, i) => (
                        <li key={i + line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  {skillMsg && (
                    <p
                      className={
                        'text-[10px] font-medium leading-snug ' +
                        (skillMsg.startsWith('Đã ')
                          ? 'text-emerald-700'
                          : 'text-red-600')
                      }
                      role="status"
                    >
                      {skillMsg}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={onCreateSkillFromContent}
                    disabled={skillSubmitting}
                    className={
                      'w-full rounded-xl border border-slate-200/90 bg-slate-50/50 py-1.5 text-[13px] font-medium ' +
                      'text-slate-600 transition-[background-color,border-color,color,transform] ' +
                      'hover:border-slate-300/90 hover:bg-slate-100/50 hover:text-slate-800 ' +
                      'active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'
                    }
                  >
                    {skillSubmitting ? '…' : 'Tạo kỹ năng tùy chỉnh'}
                  </button>
                </div>
              </section>
            </aside>
            )}
        </div>
      </div>
    </div>
  )
}
