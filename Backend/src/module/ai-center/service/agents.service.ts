import { setTimeout as delay } from 'node:timers/promises';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { toObjectId } from 'src/common/util/object-id.util';
import { WorkspacesService } from 'src/module/accounts/service/workspaces.service';
import {
  SkillTemplate,
  SkillTemplateDocument,
} from '../schema/skill-template.schema';
import {
  Agents,
  AgentsDocument,
  Task,
  TaskDocument,
} from '../schema/ai-center.schema';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { UpdateAgentDto } from '../dto/update-agent.dto';
import { resolveAttachableTemplateIds } from './resolve-attachable-template-ids';

/** Base URL AI_Core (không dấu / cuối). Ưu tiên process.env — Docker gắn biến ở đó; tránh lệch với .env rỗng. */
function resolveAiCoreBaseUrl(config: ConfigService): string {
  const fromProcess = process.env.AI_CORE_BASE_URL?.trim();
  if (fromProcess) {
    return fromProcess.replace(/\/$/, '');
  }
  const fromFile = config.get<string>('AI_CORE_BASE_URL')?.trim();
  if (fromFile) {
    return fromFile.replace(/\/$/, '');
  }
  return 'http://127.0.0.1:8000';
}

/** Lấy mô tả lỗi từ body JSON của FastAPI (thường là `{ "detail": "..." }`). */
function parseFastApiErrorBody(text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === 'string') {
      return j.detail;
    }
    if (Array.isArray(j.detail)) {
      const arr = j.detail;
      return arr
        .map((x) => {
          if (x && typeof x === 'object' && 'msg' in x) {
            return String((x as { msg?: string }).msg ?? x);
          }
          return String(x);
        })
        .join('; ');
    }
  } catch {
    // không phải JSON
  }
  return text;
}

const AI_CORE_FETCH_TIMEOUT_MS = 180_000;
const AI_CORE_FETCH_RETRIES = 3;

/** Gọi lại vài lần nếu lỗi kết nối nhanh (container chưa sẵn sàng). Không lặp khi timeout. */
async function fetchAiCoreWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let last: Error = new Error('fetch failed');
  for (let i = 0; i < AI_CORE_FETCH_RETRIES; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (last.name === 'TimeoutError' || last.name === 'AbortError') {
        throw last;
      }
      if (i < AI_CORE_FETCH_RETRIES - 1) {
        await delay(800 * (i + 1));
      }
    }
  }
  throw last;
}

function connectionHintForAiCore(targetUrl: string, errMessage: string): string {
  const parts: string[] = [];
  if (/ai_core|openclaw_ai/i.test(targetUrl)) {
    parts.push(
      'Tên host `ai_core` chỉ hoạt động khi backend và service AI Core cùng chạy trong một stack Docker Compose. Nếu bạn chạy Nest bằng `npm` trên máy, hãy đặt `AI_CORE_BASE_URL=http://127.0.0.1:8000` trong `Backend/.env` (AI Core cần lắng nghe 127.0.0.1:8000 trên host).',
    );
  }
  if (
    /fetch failed|ECONNREFUSED|ENOTFOUND|getaddrinfo|ETIMEDOUT|ECONNRESET|UND_ERR_?CONNECT/i.test(
      errMessage,
    )
  ) {
    parts.push(
      'Nếu dùng Docker: `docker compose up -d ai_core` rồi `docker ps` (container `openclaw_ai` phải Up) và nếu cần `docker logs openclaw_ai`.',
    );
  }
  if (parts.length === 0) {
    return '';
  }
  return ' — ' + parts.join(' ');
}

function pickEnabledTemplateIds(
  dto: Pick<CreateAgentDto | UpdateAgentDto, 'enabled_skill_template_ids'>,
): string[] | undefined {
  return dto.enabled_skill_template_ids;
}

function withoutEnabledTemplateIds<T extends { enabled_skill_template_ids?: string[] }>(
  dto: T,
): Omit<T, 'enabled_skill_template_ids'> {
  const { enabled_skill_template_ids, ...rest } = dto;
  void enabled_skill_template_ids;
  return rest;
}

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agents.name) private agentsModel: Model<AgentsDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(SkillTemplate.name)
    private readonly skillTemplateModel: Model<SkillTemplateDocument>,
    private readonly workspacesService: WorkspacesService,
    private readonly config: ConfigService,
  ) {}

  async createAgent(
    userId: string,
    createAgentDto: CreateAgentDto,
  ): Promise<Agents> {
    const rest = withoutEnabledTemplateIds(createAgentDto);
    const enabled_skill_template_ids = pickEnabledTemplateIds(createAgentDto);
    await this.workspacesService.findOne(userId, createAgentDto.workspace_id);

    const existing = await this.agentsModel.findOne({
      name: createAgentDto.name,
    });
    if (existing) {
      throw new ConflictException('Trợ lý đã tồn tại');
    }

    const workspaceOid = toObjectId(createAgentDto.workspace_id);
    const templateOids = await resolveAttachableTemplateIds(
      this.skillTemplateModel,
      userId,
      workspaceOid,
      enabled_skill_template_ids,
    );

    const doc = await this.agentsModel.create({
      ...rest,
      enabled_skill_template_ids: templateOids,
    });
    return doc.toJSON() as Agents;
  }

  async findByWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<object[]> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const rows = await this.agentsModel
      .find({
        $or: [{ workspace_id: wid }, { workspace_id: workspaceId }],
      })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    return rows as object[];
  }

  async findAgentById(
    userId: string,
    _id: string,
    workspaceId: string,
  ): Promise<Agents> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const agent = await this.agentsModel
      .findOne({
        _id,
        $or: [{ workspace_id: wid }, { workspace_id: workspaceId }],
      })
      .populate('enabled_skill_template_ids')
      .exec();
    if (!agent) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    return agent.toJSON() as Agents;
  }

  async updateAgent(
    userId: string,
    _id: string,
    updateAgentDto: UpdateAgentDto,
  ): Promise<Agents> {
    const existing = await this.agentsModel.findById(_id);
    if (!existing) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    await this.workspacesService.findOne(userId, String(existing.workspace_id));

    const other = withoutEnabledTemplateIds(updateAgentDto);
    const enabled_skill_template_ids = pickEnabledTemplateIds(updateAgentDto);
    const setPayload: Record<string, unknown> = { ...other };
    if (enabled_skill_template_ids !== undefined) {
      setPayload.enabled_skill_template_ids = await resolveAttachableTemplateIds(
        this.skillTemplateModel,
        userId,
        existing.workspace_id,
        enabled_skill_template_ids,
      );
    }
    const agent = await this.agentsModel.findOneAndUpdate(
      { _id },
      { $set: setPayload },
      { returnDocument: 'after' },
    );
    if (!agent) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    return agent.toJSON() as Agents;
  }

  async deleteAgent(userId: string, _id: string): Promise<string> {
    const agent = await this.agentsModel.findById(_id).exec();
    if (!agent) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    await this.workspacesService.findOne(userId, String(agent.workspace_id));

    const taskCount = await this.taskModel.countDocuments({
      agent_id: agent._id,
    });
    if (taskCount > 0) {
      throw new ConflictException(
        'Không xóa được agent: còn công việc (task) gắn với agent. Xóa hoặc đổi agent của các task trước.',
      );
    }

    const res = await this.agentsModel.deleteOne({ _id: agent._id }).exec();
    if (res.deletedCount === 0) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    return 'OK';
  }

  async refineSystemPrompt(systemPromptOfUser: string): Promise<{
    message: string;
    data: string;
  }> {
    const base = resolveAiCoreBaseUrl(this.config);
    const url = `${base}/api/v1/refine-system-prompt`;
    let res: Response;
    try {
      res = await fetchAiCoreWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPromptOfUser }),
        signal: AbortSignal.timeout(AI_CORE_FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new HttpException(
          `AI Core không trả lời trong ${AI_CORE_FETCH_TIMEOUT_MS / 1000}s (Ollama/model chậm hoặc tải cao).`,
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      const hint = connectionHintForAiCore(url, err.message);
      throw new HttpException(
        `Không kết nối được AI Core (${url}): ${err.message}${hint}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    const text = await res.text();
    if (!res.ok) {
      const detail = parseFastApiErrorBody(text);
      throw new HttpException(
        `AI Core trả lỗi ${res.status}: ${detail.slice(0, 2000)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    let body: { message?: string; data?: string };
    try {
      body = JSON.parse(text) as { message?: string; data?: string };
    } catch {
      throw new HttpException(
        'AI Core trả về không phải JSON',
        HttpStatus.BAD_GATEWAY,
      );
    }
    if (typeof body.data !== 'string' || typeof body.message !== 'string') {
      throw new HttpException(
        'AI Core thiếu trường message/data',
        HttpStatus.BAD_GATEWAY,
      );
    }
    return { message: body.message, data: body.data };
  }
}
