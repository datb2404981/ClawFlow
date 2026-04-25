import { api } from './client'
import type { ApiEnvelope } from './types'

/** Giá trị backend `icon` — map sang Lucide ở Agent builder. */
export type SkillTemplateIconKey = 'doc' | 'canvas' | 'browser' | 'scan'

export type SkillTemplate = {
  _id: string
  /** Mẫu hệ thống: thường null */
  workspace_id?: string | null
  is_system?: boolean
  name: string
  /** Mô tả ngắn (UI) — nội dung đầy đủ ở `content` */
  description?: string | null
  content: string
  visibility: 'private' | 'workspace'
  created_by?: string | null
  /** Khóa icon gọn (hệ thống thường có) */
  icon?: SkillTemplateIconKey | null
  createdAt?: string
  updatedAt?: string
}

export type CreateSkillTemplateBody = {
  workspace_id: string
  name: string
  description?: string
  content: string
  visibility: 'private' | 'workspace'
  source_url?: string
  icon?: SkillTemplateIconKey
}

export type UpdateSkillTemplateBody = {
  name?: string
  description?: string
  content?: string
  visibility?: 'private' | 'workspace'
  source_url?: string
  icon?: SkillTemplateIconKey
}

export async function fetchSkillTemplates(
  workspaceId: string,
): Promise<SkillTemplate[]> {
  const { data } = await api.get<ApiEnvelope<SkillTemplate[]>>(
    '/skill-templates',
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}

export async function createSkillTemplate(
  body: CreateSkillTemplateBody,
): Promise<SkillTemplate> {
  const { data } = await api.post<ApiEnvelope<SkillTemplate>>(
    '/skill-templates',
    body,
  )
  return data.data
}

export async function updateSkillTemplate(
  workspaceId: string,
  templateId: string,
  body: UpdateSkillTemplateBody,
): Promise<SkillTemplate> {
  const { data } = await api.patch<ApiEnvelope<SkillTemplate>>(
    `/skill-templates/${templateId}`,
    body,
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}
