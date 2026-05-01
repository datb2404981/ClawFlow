import { api } from './client'
import type { ApiEnvelope } from './types'

export type IntegrationSettings = {
  integration_gmail_enabled?: boolean
  integration_google_calendar_enabled?: boolean
  integration_drive_enabled?: boolean
  integration_notion_enabled?: boolean
}

export type IntegrationProvider =
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'notion'

export type IntegrationCatalogItem = {
  provider: IntegrationProvider
  provider_group: 'google' | 'notion'
  display_name: string
  required_scopes: string[]
  features: string[]
  limitations: string[]
  security_notes: string[]
}

export type IntegrationConnectionState = {
  connected: boolean
  needs_reauth: boolean
  granted_scopes: string[]
  connected_at?: string
  expires_at?: string
  last_error?: string
  external_account_email?: string
}

export type IntegrationStatusItem = IntegrationCatalogItem & {
  enabled: boolean
  connection_state: IntegrationConnectionState
}

export async function fetchAppSettings(): Promise<IntegrationSettings> {
  const { data } = await api.get<ApiEnvelope<IntegrationSettings>>('/settings/app')
  return data.data
}

export async function updateAppSettings(
  patch: IntegrationSettings,
): Promise<IntegrationSettings> {
  const { data } = await api.patch<ApiEnvelope<IntegrationSettings>>(
    '/settings/app',
    patch,
  )
  return data.data
}

export async function fetchIntegrationsCatalog(): Promise<IntegrationCatalogItem[]> {
  const { data } = await api.get<ApiEnvelope<IntegrationCatalogItem[]>>(
    '/settings/integrations/catalog',
  )
  return data.data
}

export async function fetchIntegrationsStatus(): Promise<{
  providers: IntegrationStatusItem[]
}> {
  const { data } = await api.get<
    ApiEnvelope<{ providers: IntegrationStatusItem[] }>
  >('/settings/integrations/status')
  return data.data
}

export async function fetchIntegrationConnectUrl(
  provider: IntegrationProvider,
  workspaceId: string,
): Promise<{ provider: IntegrationProvider; connect_url: string; note: string }> {
  const { data } = await api.get<
    ApiEnvelope<{ provider: IntegrationProvider; connect_url: string; note: string }>
  >(`/settings/integrations/${provider}/connect-url`, {
    params: { workspace_id: workspaceId },
  })
  return data.data
}

export async function disconnectIntegration(
  provider: IntegrationProvider,
): Promise<{ provider: IntegrationProvider; disconnected: true }> {
  const { data } = await api.post<
    ApiEnvelope<{ provider: IntegrationProvider; disconnected: true }>
  >(`/settings/integrations/${provider}/disconnect`)
  return data.data
}

export async function connectIntegrationMock(
  provider: IntegrationProvider,
): Promise<{
  provider: IntegrationProvider
  connected: boolean
  needs_reauth: boolean
  granted_scopes: string[]
}> {
  const { data } = await api.get<
    ApiEnvelope<{
      provider: IntegrationProvider
      connected: boolean
      needs_reauth: boolean
      granted_scopes: string[]
    }>
  >(`/settings/integrations/${provider}/callback`, {
    params: { mock: 1 },
  })
  return data.data
}

