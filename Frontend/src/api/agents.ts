import { api } from './client'
import type { ApiEnvelope } from './types'

export type Agent = {
  _id: string
  workspace_id: string
  name: string
  description?: string
  system_prompt: string
  built_in_tools?: string[]
  custom_skills?: string
  enabled_skill_template_ids?: string[]
  createdAt?: string
  updatedAt?: string
}

export type CreateAgentBody = {
  name: string
  workspace_id: string
  description?: string
  system_prompt: string
  built_in_tools?: string[]
  custom_skills?: string
  enabled_skill_template_ids?: string[]
}

export async function fetchAgents(
  workspaceId: string,
): Promise<Agent[]> {
  const { data } = await api.get<ApiEnvelope<Agent[]>>(
    '/agents',
    { params: { workspace_id: workspaceId } },
  )
  return data.data
}

export async function fetchAgent(
  id: string,
  workspaceId: string,
): Promise<Agent> {
  const { data } = await api.get<ApiEnvelope<Agent>>(`/agents/${id}`, {
    params: { workspace_id: workspaceId },
  })
  return data.data
}

export async function createAgent(body: CreateAgentBody): Promise<Agent> {
  const { data } = await api.post<ApiEnvelope<Agent>>('/agents', body)
  return data.data
}

export async function updateAgent(
  id: string,
  body: Partial<CreateAgentBody>,
): Promise<Agent> {
  const { data } = await api.put<ApiEnvelope<Agent>>(`/agents/${id}`, body)
  return data.data
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/agents/${id}`)
}

export type RefineSystemPromptResult = {
  message: string
  data: string
}

/** Gọi Nest → AI Core, trả về bản system prompt đã tối ưu. */
export async function refineSystemPrompt(
  systemPromptOfUser: string,
): Promise<RefineSystemPromptResult> {
  const { data: envelope } = await api.post<ApiEnvelope<RefineSystemPromptResult>>(
    '/agents/refine-system-prompt',
    { systemPromptOfUser },
  )
  return envelope.data
}

export type RefineEmailResult = {
  message: string
  data: string
}

/** Gọi Nest → AI Core, trả về nội dung email đã được tối ưu. */
export async function refineEmailDraft(
  emailBody: string,
): Promise<RefineEmailResult> {
  const { data: envelope } = await api.post<ApiEnvelope<RefineEmailResult>>(
    '/agents/refine-email',
    { emailBody },
  )
  return envelope.data
}
