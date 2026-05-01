import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  Loader2,
  Moon,
  Shield,
  Sun,
} from 'lucide-react'
import {
  siGmail,
  siGoogle,
  siGooglecalendar,
  siGoogledrive,
  siNotion,
} from 'simple-icons'
import { useParams } from 'react-router-dom'
import { useAppTheme } from '../../../theme/useAppTheme'
import {
  fetchAgents,
  type Agent,
} from '../../../api/agents'
import {
  disconnectIntegration,
  fetchAppSettings,
  fetchIntegrationsStatus,
  fetchIntegrationConnectUrl,
  updateAppSettings,
  type IntegrationProvider,
  type IntegrationSettings,
  type IntegrationStatusItem,
} from '../../../api/appSettings'

function ToggleSwitch({
  checked,
  disabled,
  onToggle,
  ariaLabel,
}: {
  checked: boolean
  disabled?: boolean
  onToggle: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={[
        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
        checked ? 'bg-[var(--cf-electric)]' : 'bg-[rgb(148_163_184/0.18)]',
        'disabled:opacity-50',
      ].join(' ')}
    >
      <span
        className={[
            // Neo vị trí thumb từ cạnh trái để tránh bị lệch theo layout.
            'absolute left-0.5 top-0.5 h-6 w-6 rounded-full shadow transition-transform',
          'bg-[var(--cf-switch-thumb)]',
            // Track: 48px, thumb: 24px, left-0.5 ≈ 2px => dịch khoảng 20px.
            checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
        aria-hidden
      />
    </button>
  )
}

function BrandIcon({
  path,
  color,
  label,
  withBadge = false,
}: {
  path: string
  color: string
  label: string
  withBadge?: boolean
}) {
  return (
    <span
      className={[
        'inline-flex h-5 w-5 items-center justify-center',
        withBadge ? 'rounded-sm bg-white/95' : '',
      ].join(' ')}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={color} aria-hidden>
        <path d={path} />
      </svg>
    </span>
  )
}

export function AppSettingsPage() {
  const { theme, setTheme } = useAppTheme()
  const { workspaceId = '' } = useParams<{ workspaceId: string }>()

  const [notif, setNotif] = useState(() => {
    const v = localStorage.getItem('clawflow.notifApprovalReminder')
    return v === '0' ? false : true
  })

  const [compact, setCompact] = useState(() => {
    return localStorage.getItem('clawflow-sidebar-collapsed') === '1'
  })

  const [lang, setLang] = useState<'vi' | 'en'>(() => {
    const v = localStorage.getItem('clawflow.uiLang')
    return v === 'en' ? 'en' : 'vi'
  })
  const [loadingIntegrations, setLoadingIntegrations] = useState(true)
  const [savingIntegrations, setSavingIntegrations] = useState(false)
  const [linkingProvider, setLinkingProvider] = useState<IntegrationProvider | null>(null)
  const [integrationsErr, setIntegrationsErr] = useState('')
  const [integrationItems, setIntegrationItems] = useState<IntegrationStatusItem[]>([])

  const [gmailEnabled, setGmailEnabled] = useState(true)
  const [calendarEnabled, setCalendarEnabled] = useState(true)
  const [driveEnabled, setDriveEnabled] = useState(true)
  const [notionEnabled, setNotionEnabled] = useState(true)

  const [initialIntegrations, setInitialIntegrations] = useState<
    IntegrationSettings | null
  >(null)

  const [agents, setAgents] = useState<Agent[]>([])
  const [defaultAgentId, setDefaultAgentId] = useState(() => {
    return localStorage.getItem('clawflow.defaultAgentId') ?? ''
  })

  useEffect(() => {
    document.title = 'Cài đặt ứng dụng — ClawFlow'
  }, [])

  useEffect(() => {
    if (!workspaceId) return
    void fetchAgents(workspaceId)
      .then((list) => setAgents(list))
      .catch(() => setAgents([]))
  }, [workspaceId])

  useEffect(() => {
    void Promise.all([fetchAppSettings(), fetchIntegrationsStatus()])
      .then(([s, status]) => {
        setInitialIntegrations(s)
        setGmailEnabled(s.integration_gmail_enabled ?? true)
        setCalendarEnabled(s.integration_google_calendar_enabled ?? true)
        setDriveEnabled(s.integration_drive_enabled ?? true)
        setNotionEnabled(s.integration_notion_enabled ?? true)
        setIntegrationItems(status.providers)
      })
      .catch(() => {
        setIntegrationsErr('Không tải được cấu hình kết nối.')
      })
      .finally(() => setLoadingIntegrations(false))
  }, [])

  const refreshIntegrationsStatus = async () => {
    const status = await fetchIntegrationsStatus()
    setIntegrationItems(status.providers)
  }

  const integrationsDirty = useMemo(() => {
    if (!initialIntegrations) return false
    return (
      (gmailEnabled ?? true) !==
        (initialIntegrations.integration_gmail_enabled ?? true) ||
      (calendarEnabled ?? true) !==
        (initialIntegrations.integration_google_calendar_enabled ?? true) ||
      (driveEnabled ?? true) !==
        (initialIntegrations.integration_drive_enabled ?? true) ||
      (notionEnabled ?? true) !==
        (initialIntegrations.integration_notion_enabled ?? true)
    )
  }, [
    initialIntegrations,
    gmailEnabled,
    calendarEnabled,
    driveEnabled,
    notionEnabled,
  ])

  const persistCompact = (next: boolean) => {
    localStorage.setItem('clawflow-sidebar-collapsed', next ? '1' : '0')
    setCompact(next)
    // Rail sidebar trong WorkspaceAppLayout chỉ sync theo localStorage khi mount.
    // Refresh để đảm bảo cập nhật ngay lập tức.
    window.location.reload()
  }

  const persistLang = (next: 'vi' | 'en') => {
    setLang(next)
    localStorage.setItem('clawflow.uiLang', next)
  }

  const persistNotif = (next: boolean) => {
    setNotif(next)
    localStorage.setItem('clawflow.notifApprovalReminder', next ? '1' : '0')
  }

  const saveIntegrations = async () => {
    setIntegrationsErr('')
    setSavingIntegrations(true)
    try {
      const next = {
        integration_gmail_enabled: gmailEnabled,
        integration_google_calendar_enabled: calendarEnabled,
        integration_drive_enabled: driveEnabled,
        integration_notion_enabled: notionEnabled,
      }
      const saved = await updateAppSettings(next)
      setInitialIntegrations(saved)
      await refreshIntegrationsStatus()
    } catch {
      setIntegrationsErr('Không lưu được cấu hình kết nối.')
    } finally {
      setSavingIntegrations(false)
    }
  }

  const providerEnabled = (
    provider: IntegrationProvider,
  ): boolean => {
    if (provider === 'gmail') return gmailEnabled
    if (provider === 'google_calendar') return calendarEnabled
    if (provider === 'google_drive') return driveEnabled
    return notionEnabled
  }

  const setProviderEnabled = (
    provider: IntegrationProvider,
    next: boolean,
  ) => {
    if (provider === 'gmail') setGmailEnabled(next)
    else if (provider === 'google_calendar') setCalendarEnabled(next)
    else if (provider === 'google_drive') setDriveEnabled(next)
    else setNotionEnabled(next)
  }

  const providerIcon = (provider: IntegrationProvider) => {
    if (provider === 'gmail') {
      return <BrandIcon path={siGmail.path} color={`#${siGmail.hex}`} label="Gmail" />
    }
    if (provider === 'google_calendar') {
      return (
        <BrandIcon
          path={siGooglecalendar.path}
          color={`#${siGooglecalendar.hex}`}
          label="Google Calendar"
        />
      )
    }
    if (provider === 'google_drive') {
      return (
        <BrandIcon
          path={siGoogledrive.path}
          color={`#${siGoogledrive.hex}`}
          label="Google Drive"
        />
      )
    }
    return (
      <BrandIcon
        path={siNotion.path}
        color={`#${siNotion.hex}`}
        label="Notion"
        withBadge
      />
    )
  }

  const connectOrDisconnect = async (provider: IntegrationProvider, connected: boolean) => {
    setIntegrationsErr('')
    setLinkingProvider(provider)
    try {
      if (!workspaceId.trim()) {
        setIntegrationsErr('Thiếu workspace — không tạo được link liên kết.')
        return
      }
      if (connected) {
        await disconnectIntegration(provider)
      } else {
        const { connect_url } = await fetchIntegrationConnectUrl(
          provider,
          workspaceId,
        )
        window.location.href = connect_url
        return // Bắt đầu redirect nên không cần refresh ngay
      }
      await refreshIntegrationsStatus()
    } catch {
      setIntegrationsErr('Không cập nhật được trạng thái liên kết integration.')
    } finally {
      setLinkingProvider(null)
    }
  }

  const googleItems = integrationItems.filter(
    (x) => x.provider_group === 'google',
  )
  const notionItem = integrationItems.find((x) => x.provider === 'notion')

  const googleConnected =
    googleItems.length > 0 &&
    googleItems.every(
      (x) =>
        x.connection_state.connected && !x.connection_state.needs_reauth,
    )
  const googleNeedsReauth = googleItems.some(
    (x) => x.connection_state.needs_reauth,
  )

  const connectOrDisconnectGoogleGroup = async () => {
    setIntegrationsErr('')
    setLinkingProvider('gmail')
    try {
      if (!workspaceId.trim()) {
        setIntegrationsErr('Thiếu workspace — không tạo được link liên kết.')
        return
      }
      if (googleConnected) {
        await Promise.all([
          disconnectIntegration('gmail'),
          disconnectIntegration('google_calendar'),
          disconnectIntegration('google_drive'),
        ])
      } else {
        const { connect_url } = await fetchIntegrationConnectUrl(
          'gmail',
          workspaceId,
        )
        window.location.href = connect_url
        return
      }
      await refreshIntegrationsStatus()
    } catch {
      setIntegrationsErr('Không cập nhật được trạng thái liên kết Google integrations.')
    } finally {
      setLinkingProvider(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-1 py-2">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-sm cf-ui-text-muted"
      >
        <span>Cài đặt ứng dụng</span>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-50" strokeWidth={2} aria-hidden />
        <span className="cf-ui-text">Giao diện</span>
      </nav>

      <div className="mb-8 pt-2">
        <h1 className="text-3xl font-semibold tracking-tight cf-ui-text sm:text-4xl">
          Cài đặt ứng dụng
        </h1>
        <p className="cf-ui-text-muted mt-3 max-w-2xl text-base leading-relaxed">
          Không gian quản lý tinh gọn, đồng bộ theme sâu tối và điều khiển hiện đại.
        </p>
      </div>

      <div className="max-w-3xl space-y-4">
        {/* Appearance */}
        <section className="cf-ui-surface rounded-xl border border-slate-800/60 p-6 sm:p-8">
          <h2 className="cf-ui-text-muted mb-2 text-xs font-semibold uppercase tracking-widest">
            Giao diện (Appearance)
          </h2>
          <p className="cf-ui-text-muted mb-6 text-sm leading-relaxed">
            <strong className="cf-ui-text">Persistence</strong> lưu theme và chế độ thu nhỏ rail trong
            <code className="cf-ui-text-muted ml-2 rounded bg-[var(--cf-field-bg)] px-2 py-0.5 text-[0.78rem] ring-1 ring-[var(--cf-field-border)]">
              localStorage
            </code>
            .
          </p>

          <div className="space-y-5">
            <div>
              <h3 className="cf-ui-text-muted mb-3 text-xs font-semibold uppercase tracking-widest">
                Theme System
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={[
                    'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                    theme === 'light'
                      ? 'border-sky-400 bg-sky-50 text-sky-900'
                      : 'border-[var(--cf-field-border)] bg-[var(--cf-panel-surface-bg)] cf-ui-text hover:bg-[var(--cf-sidebar-row-hover)]',
                  ].join(' ')}
                >
                  <Sun className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  Sáng
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={[
                    'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                    theme === 'dark'
                      ? 'border-[var(--cf-electric)] bg-[var(--cf-app-shell-bg)] text-[var(--cf-electric)] ring-1 ring-[var(--cf-electric)]/25'
                      : 'border-[var(--cf-field-border)] bg-[var(--cf-panel-surface-bg)] cf-ui-text hover:bg-[var(--cf-sidebar-row-hover)]',
                  ].join(' ')}
                >
                  <Moon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  Tối
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg py-1 cf-ui-text">
              <span className="flex items-center gap-2 text-sm font-medium cf-ui-text">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--cf-accent-soft-bg)] ring-1 ring-[var(--cf-accent-soft-border)]">
                  <span className="text-[var(--cf-electric)]">↔</span>
                </span>
                Chế độ thu nhỏ Sidebar
              </span>
              <ToggleSwitch
                checked={compact}
                ariaLabel="Chế độ thu nhỏ Sidebar"
                onToggle={() => persistCompact(!compact)}
              />
            </label>
          </div>
        </section>

        {/* Agent Behavior */}
        <section className="cf-ui-surface rounded-xl border border-slate-800/60 p-6 sm:p-8">
          <h2 className="cf-ui-text-muted mb-2 text-xs font-semibold uppercase tracking-widest">
            Hành vi Agent
          </h2>
          <p className="cf-ui-text-muted mb-6 text-sm leading-relaxed">
            Điều chỉnh cách giao diện hiển thị và Agent mặc định (được lưu cục bộ trên trình duyệt).
          </p>

          <div className="space-y-5">
            <div>
              <h3 className="cf-ui-text-muted mb-3 text-xs font-semibold uppercase tracking-widest">
                Ngôn ngữ hiển thị
              </h3>
              <div className="cf-ui-field flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors hover:border-[var(--cf-accent-soft-border)]">
                <span className="text-[0.95rem]" aria-hidden>
                  {lang === 'en' ? '🇬🇧' : '🇻🇳'}
                </span>
                <select
                  id="language-select"
                  name="language"
                  value={lang}
                  onChange={(e) => persistLang((e.target.value === 'en' ? 'en' : 'vi') as 'vi' | 'en')}
                  className="w-full bg-transparent text-sm outline-none"
                  aria-label="Ngôn ngữ hiển thị"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <div>
              <h3 className="cf-ui-text-muted mb-3 text-xs font-semibold uppercase tracking-widest">
                Agent mặc định
              </h3>
              <div className="cf-ui-field rounded-lg px-3 py-2.5">
                <select
                  value={defaultAgentId}
                  onChange={(e) => {
                    const next = e.target.value
                    setDefaultAgentId(next)
                    localStorage.setItem('clawflow.defaultAgentId', next)
                  }}
                  className="w-full bg-transparent text-sm outline-none"
                  aria-label="Agent mặc định"
                  disabled={agents.length === 0}
                >
                  <option value="" disabled={agents.length > 0}>
                    {agents.length === 0
                      ? 'Chưa có Agent'
                      : 'Chọn Agent mặc định'}
                  </option>
                  {agents.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="cf-ui-text-muted mt-2 text-sm leading-relaxed">
                Dùng cho các thao tác “mặc định” trong UI (hiện MVP: lưu cục bộ).
              </p>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section className="cf-ui-surface rounded-xl border border-slate-800/60 p-6 sm:p-8">
          <h2 className="cf-ui-text-muted mb-2 text-xs font-semibold uppercase tracking-widest">
            Kết nối (Integrations)
          </h2>
          <p className="cf-ui-text-muted mb-6 text-sm leading-relaxed">
            Bật/tắt ở đây áp dụng global theo user. Tắt connector đồng nghĩa mọi hành động liên quan sẽ bị chặn sau khi
            bạn bấm <b>Approve</b>.
          </p>

          {integrationsErr ? (
            <p className="mb-4 text-sm text-rose-600">{integrationsErr}</p>
          ) : null}

          <div className="space-y-4">
            {googleItems.length > 0 && (
              <div className="rounded-xl border border-[var(--cf-field-border)] bg-[var(--cf-field-bg)] px-4 py-3">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold cf-ui-text">
                      <BrandIcon path={siGoogle.path} color={`#${siGoogle.hex}`} label="Google" />
                      <span>Google</span>
                    </div>
                    <p className="cf-ui-text-muted mt-1 text-xs">
                      Gmail, Google Calendar và Google Drive dùng chung liên kết OAuth Google.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void connectOrDisconnectGoogleGroup()}
                    disabled={linkingProvider != null}
                    className="rounded-lg border border-[var(--cf-field-border)] px-3 py-1.5 text-xs font-medium cf-ui-text transition hover:bg-[var(--cf-sidebar-row-hover)] disabled:opacity-60"
                  >
                    {linkingProvider ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          strokeWidth={2}
                          aria-hidden
                        />
                        Đang xử lý
                      </span>
                    ) : googleConnected ? (
                      'Ngắt kết nối'
                    ) : googleNeedsReauth ? (
                      'Nâng quyền'
                    ) : (
                      'Liên kết'
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  {googleItems.map((item) => {
                    const enabled = providerEnabled(item.provider)
                    const canToggle =
                      savingIntegrations ||
                      loadingIntegrations ||
                      !googleConnected
                    return (
                      <div
                        key={item.provider}
                        className="rounded-lg border border-[var(--cf-panel-divider)] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-sm font-medium cf-ui-text">
                            {providerIcon(item.provider)}
                            {item.display_name}
                          </span>
                          <ToggleSwitch
                            checked={enabled}
                            disabled={canToggle}
                            ariaLabel={`${item.display_name} enabled`}
                            onToggle={() =>
                              setProviderEnabled(item.provider, !enabled)
                            }
                          />
                        </div>
                        <ul className="cf-ui-text-muted mt-2 list-disc space-y-0.5 pl-4 text-xs leading-relaxed">
                          {item.features.map((f, idx) => (
                            <li key={`${item.provider}-f-${idx}`}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {notionItem && (
              <div className="rounded-xl border border-[var(--cf-field-border)] bg-[var(--cf-field-bg)] px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold cf-ui-text">
                      {providerIcon(notionItem.provider)}
                      <span>{notionItem.display_name}</span>
                    </div>
                    <p className="cf-ui-text-muted mt-1 text-xs">
                      Notion có OAuth riêng, không dùng chung Google.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      checked={providerEnabled('notion')}
                      disabled={
                        savingIntegrations ||
                        loadingIntegrations ||
                        !notionItem.connection_state.connected
                      }
                      ariaLabel="Notion enabled"
                      onToggle={() =>
                        setProviderEnabled(
                          'notion',
                          !providerEnabled('notion'),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void connectOrDisconnect(
                          'notion',
                          notionItem.connection_state.connected,
                        )
                      }
                      disabled={linkingProvider != null}
                      className="rounded-lg border border-[var(--cf-field-border)] px-3 py-1.5 text-xs font-medium cf-ui-text transition hover:bg-[var(--cf-sidebar-row-hover)] disabled:opacity-60"
                    >
                      {linkingProvider ? 'Đang xử lý' : notionItem.connection_state.connected ? 'Ngắt kết nối' : notionItem.connection_state.needs_reauth ? 'Nâng quyền' : 'Liên kết'}
                    </button>
                  </div>
                </div>

                <ul className="cf-ui-text-muted mt-3 list-disc space-y-0.5 pl-4 text-xs leading-relaxed">
                  {notionItem.features.map((f, idx) => (
                    <li key={`notion-f-${idx}`}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={() => void saveIntegrations()}
              disabled={savingIntegrations || loadingIntegrations || !integrationsDirty}
              className={[
                'rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition',
                'shadow-[0_0_0_1px_rgba(0,168,255,0.25),0_10px_26px_rgba(0,168,255,0.14)]',
                'bg-[var(--cf-btn-primary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:brightness-[1.05]',
              ].join(' ')}
            >
              {savingIntegrations ? 'Đang lưu…' : 'Lưu kết nối'}
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section className="cf-ui-surface rounded-xl border border-slate-800/60 p-6 sm:p-8">
          <h2 className="cf-ui-text-muted mb-2 text-xs font-semibold uppercase tracking-widest">
            Thông báo (Notifications)
          </h2>
          <p className="cf-ui-text-muted mb-6 text-sm leading-relaxed">
            Nhắc nhở khi task cần duyệt. Lưu cục bộ trên trình duyệt để không phụ thuộc backend.
          </p>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg py-1 cf-ui-text">
            <span className="flex items-center gap-2 text-sm font-medium cf-ui-text">
              <Shield className="h-4 w-4 cf-ui-text-muted" strokeWidth={1.5} aria-hidden />
              Nhắc khi task cần duyệt
            </span>
            <ToggleSwitch
              checked={notif}
              ariaLabel="Nhắc khi task cần duyệt"
              onToggle={() => persistNotif(!notif)}
            />
          </label>
        </section>
      </div>
    </div>
  )
}
