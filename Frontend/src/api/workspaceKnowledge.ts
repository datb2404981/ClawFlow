import { api } from './client'
import type { ApiEnvelope } from './types'

export type KbFileListItem = {
  _id: string
  original_name: string
  stored_filename: string
  size_bytes: number
  mime_type?: string
  createdAt: string
}

export async function fetchKnowledgeFiles(
  workspaceId: string,
): Promise<KbFileListItem[]> {
  const { data } = await api.get<ApiEnvelope<KbFileListItem[]>>(
    `/workspaces/${workspaceId}/knowledge`,
  )
  return data.data
}

export async function uploadKnowledgeFile(
  workspaceId: string,
  file: File,
): Promise<KbFileListItem> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<ApiEnvelope<KbFileListItem>>(
    `/workspaces/${workspaceId}/knowledge/upload`,
    form,
  )
  return data.data as unknown as KbFileListItem
}

export async function deleteKnowledgeFile(
  workspaceId: string,
  fileId: string,
): Promise<void> {
  await api.delete(
    `/workspaces/${workspaceId}/knowledge/files/${fileId}`,
  )
}
