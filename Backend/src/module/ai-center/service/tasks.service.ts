import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { toObjectId } from 'src/common/util/object-id.util';
import { WorkspacesService } from 'src/module/accounts/service/workspaces.service';
import { UsersService } from 'src/module/accounts/service/users.service';
import {
  Agents,
  AgentsDocument,
  Task,
  TaskDocument,
  TaskStatus,
} from '../schema/ai-center.schema';
import { CreateTaskDto } from '../dto/create-task.dto';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { AiCoreService } from './ai-core.service';
import { GeminiEmbeddingService } from 'src/module/accounts/service/gemini-embedding.service';
import { KnowledgeChunk, KnowledgeChunkDocument } from 'src/module/workspace-documents-module/schema/workspace-document.schema';
import { SkillTemplate, SkillTemplateDocument } from '../schema/skill-template.schema';
import { TasksGateway } from '../gateway/tasks.gateway';
import { MemoryFlowService } from './memory-flow.service';
import { ThirdPartyExecutorService } from './third-party-executor.service';

/** Tách từ khoá — dùng RegExp object để tránh no-useless-escape trong literal /[...]/. */
const KEYWORD_SPLIT_RE = new RegExp('[\\s.,!?;:"()\\[\\]{}]+', 'g');

type RagVectorChunk = { _id?: Types.ObjectId; chunk_text?: string };

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Agents.name) private agentsModel: Model<AgentsDocument>,
    @InjectModel(KnowledgeChunk.name) private knowledgeChunkModel: Model<KnowledgeChunkDocument>,
    @InjectModel(SkillTemplate.name) private skillTemplateModel: Model<SkillTemplateDocument>,
    private readonly workspacesService: WorkspacesService,
    private readonly aiCoreService: AiCoreService,
    private readonly geminiEmbeddingService: GeminiEmbeddingService,
    private readonly memoryFlowService: MemoryFlowService,
    private readonly tasksGateway: TasksGateway,
    @InjectQueue('tasks_queue') private readonly tasksQueue: Queue,
    private readonly thirdPartyExecutor: ThirdPartyExecutorService,
    private readonly usersService: UsersService,
  ) {}

  /** Hex / id string cho log, queue, filter — tránh unsafe ObjectId từ HydratedDocument. */
  private idHex(value: Types.ObjectId | string | undefined | null): string {
    if (value == null) return '';
    return typeof value === 'string' ? value : String(value);
  }

  private async assertAgentInWorkspace(
    agentId: Types.ObjectId,
    workspaceId: Types.ObjectId,
  ): Promise<void> {
    const a = await this.agentsModel.findById(agentId).lean();
    if (!a || String(a.workspace_id) !== String(workspaceId)) {
      throw new BadRequestException(
        'Trợ lý không tồn tại hoặc không thuộc workspace',
      );
    }
  }

  private extractKeywords(text: string): string {
    if (!text || text.length === 0) return '';
    
    // Loại bỏ các từ phổ biến (stopwords tiếng Việt)
    const stopwords = new Set([
      'cái', 'có', 'của', 'để', 'là', 'và', 'được', 'những', 'với', 'từ', 'hay', 'hoặc',
      'bởi', 'nên', 'này', 'kia', 'cách', 'giữa', 'hết', 'thì', 'hay', 'ngoài', 'nữa',
      'như', 'không', 'không phải', 'nhưng', 'chỉ', 'rất', 'lại', 'cũng', 'vì', 'mà', 'hay',
      'tôi', 'tui', 'bạn', 'anh', 'chị', 'em', 'ông', 'bà', 'cô', 'chú', 'dì', 'thầy', 'cô',
      'hãy', 'đã', 'đang', 'sẽ', 'có thể', 'nên', 'phải', 'được', 'bị', 'cho', 'nó', 'mình',
    ]);

    // Tách từ và lọc
    const words = text
      .toLowerCase()
      .split(KEYWORD_SPLIT_RE)
      .filter((word) => word.length > 2 && !stopwords.has(word.trim()));
    
    // Lấy 5-10 từ khoá chính
    const uniqueWords = [...new Set(words)];
    return uniqueWords.slice(0, 10).join(' ');
  }

  /** Câu user cho embedding RAG: giữ ngữ nghĩa, chỉ cắt độ dài (embedding từ khoá-only hay lệch vector). */
  private prepareRagEmbedText(raw: string): string {
    const t = raw.replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const max = 2800;
    return t.length <= max ? t : t.slice(0, max);
  }

  /** Tên index Atlas $vectorSearch (mặc định `default`). */
  private ragVectorIndexName(): string {
    return (
      process.env.MONGODB_VECTOR_INDEX_NAME?.trim() ||
      process.env.ATLAS_VECTOR_SEARCH_INDEX?.trim() ||
      'default'
    );
  }

  /** Vector + `$text` trên `chunk_text`; tắt: `RAG_HYBRID_TEXT=0`. */
  private ragHybridTextEnabled(): boolean {
    const v = process.env.RAG_HYBRID_TEXT?.trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') {
      return false;
    }
    return true;
  }

  private ragMergedMax(): number {
    const n = Number(process.env.RAG_MERGED_MAX_CHUNKS);
    if (Number.isFinite(n) && n >= 1 && n <= 24) return Math.floor(n);
    return 6;
  }

  /** Chuỗi cho MongoDB `$text` (tránh `-` negation, dư ngoặc). */
  private prepareTextSearchQuery(raw: string): string {
    const fromKw = this.extractKeywords(raw)
      .replace(/-/g, ' ')
      .replace(/"/g, ' ')
      .trim();
    if (fromKw.length >= 2) return fromKw;
    const words = (raw || '')
      .toLowerCase()
      .split(KEYWORD_SPLIT_RE)
      .filter((w) => w.length >= 2)
      .slice(0, 14)
      .join(' ')
      .replace(/-/g, ' ')
      .trim();
    return words;
  }

  private mergeRagChunks(
    vector: RagVectorChunk[],
    text: RagVectorChunk[],
    maxTotal: number,
  ): RagVectorChunk[] {
    const seen = new Set<string>();
    const out: RagVectorChunk[] = [];
    const push = (row: RagVectorChunk) => {
      const id = row._id != null ? String(row._id) : '';
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      const piece = typeof row.chunk_text === 'string' ? row.chunk_text : '';
      if (!piece.trim()) return;
      out.push({ _id: row._id, chunk_text: piece });
    };
    for (const r of vector) push(r);
    for (const r of text) {
      if (out.length >= maxTotal) break;
      push(r);
    }
    return out.slice(0, maxTotal);
  }

  private async ragFullTextChunks(
    workspaceOid: Types.ObjectId,
    lastUserMessage: string,
  ): Promise<RagVectorChunk[]> {
    const q = this.prepareTextSearchQuery(lastUserMessage);
    if (q.length < 2) return [];
    type RagTextHit = { _id: Types.ObjectId; chunk_text?: string };
    const hits = (await this.knowledgeChunkModel
      .find(
        { workspace_id: workspaceOid, $text: { $search: q } },
        { score: { $meta: 'textScore' }, chunk_text: 1 },
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(5)
      .lean()
      .exec()) as RagTextHit[];
    return hits.map((d) => ({
      _id: d._id,
      chunk_text: typeof d.chunk_text === 'string' ? d.chunk_text : '',
    }));
  }

  /** Tin user gần nhất cho RAG / skill routing / prompt lượt hiện tại. */
  private lastUserContent(taskDoc: TaskDocument): string {
    const raw = taskDoc.messages as
      | Array<{ role?: string; content?: string }>
      | undefined;
    if (raw?.length) {
      for (let i = raw.length - 1; i >= 0; i--) {
        if (raw[i].role === 'user' && raw[i].content?.trim()) {
          return raw[i].content!.trim();
        }
      }
    }
    return (taskDoc.description || '').trim();
  }

  async create(userId: string, dto: CreateTaskDto): Promise<object> {
    const wid = toObjectId(dto.workspace_id);
    const aid = toObjectId(dto.agent_id);
    await this.workspacesService.findOne(userId, dto.workspace_id);
    await this.assertAgentInWorkspace(aid, wid);
    const uid = toObjectId(userId);
    const descTrim = dto.description?.trim() ?? '';
    const initialMessages =
      descTrim.length > 0
        ? [{ role: 'user' as const, content: descTrim, createdAt: new Date() }]
        : [];
    const scheduleEnabled = Boolean(dto.schedule_enabled);
    const doc = await this.taskModel.create({
      workspace_id: wid,
      agent_id: aid,
      created_by: uid,
      title: dto.title,
      description: dto.description,
      status: dto.status ?? 'scheduled',
      thread_id: dto.thread_id,
      messages: initialMessages,
      draft_payload: null,
      schedule_enabled: scheduleEnabled,
      schedule_cron: dto.schedule_cron ?? null,
      next_run_at: dto.next_run_at ? new Date(dto.next_run_at) : null,
    });
    const newTaskIdHex = String(doc._id);
    const docOid = new Types.ObjectId(newTaskIdHex);
    if (!String(dto.thread_id ?? '').trim()) {
      await this.taskModel.updateOne(
        { _id: docOid },
        { $set: { thread_id: newTaskIdHex } },
      );
    }

    // Bắn Job vào Redis Queue để chạy ngầm an toàn
    // Nếu bật schedule: KHÔNG chạy ngay, scheduler sẽ enqueue sau.
    if (!scheduleEnabled) {
      await this.tasksQueue.add(
        'process_task',
        { taskId: newTaskIdHex },
        { removeOnComplete: true, removeOnFail: false },
      );
    } else {
      // MVP scheduler: tick mỗi phút để enqueue task đến lịch.
      // jobId cố định để tránh tạo trùng repeatable job.
      await this.tasksQueue.add(
        'scheduler_tick',
        {},
        {
          jobId: 'scheduler_tick_v1',
          repeat: { pattern: '* * * * *' },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    }

    const out = await this.taskModel.findById(docOid).lean().exec();
    if (!out) {
      throw new BadRequestException('Không đọc lại được task vừa tạo.');
    }
    return out as object;
  }

  /**
   * Phương thức tổng hợp bối cảnh, gọi RAG và gọi AI_Core để xử lý Task.
   */
  async compileAndRunTaskById(taskId: string): Promise<void> {
    const taskDoc = await this.taskModel.findById(taskId);
    if (!taskDoc) {
      this.logger.error(`Task ${taskId} không tồn tại.`);
      return;
    }
    const workspaceIdStr = this.idHex(taskDoc.workspace_id);
    const taskIdHex = this.idHex(taskDoc._id);
    const creatorHex = this.idHex(taskDoc.created_by);
    const initialStatus = String(taskDoc.status ?? '');
    const isDraftMode =
      initialStatus === 'draft_ready' || initialStatus === 'waiting_human_input';
    // Waiting execute/reject: không được chạy AI hoặc ingest memory ở đây.
    if (initialStatus === 'waiting_execute_approval' || initialStatus === 'rejected') {
      this.logger.warn(
        `Task ${taskIdHex} đang ${initialStatus} — bỏ qua compileAndRunTaskById.`,
      );
      return;
    }
    const ACTION_PLAN_START = '<!--CF_ACTION_PLAN_START-->';
    const ACTION_PLAN_END = '<!--CF_ACTION_PLAN_END-->';
    this.tasksGateway.emitTaskStatus(workspaceIdStr, taskId, 'in_progress');
    try {
      // 1. Cập nhật status thành in_progress
      await this.taskModel.updateOne({ _id: taskDoc._id }, { $set: { status: 'in_progress' } });

      // 2. Lấy thông tin Agent
      const agent = await this.agentsModel.findById(taskDoc.agent_id).lean();
      if (!agent) throw new Error('Không tìm thấy Agent');

      // 3. Nạp nội dung Skills thông qua Skill Router (Điều hướng)
      let skillsContext = '';
      if (agent.enabled_skill_template_ids && agent.enabled_skill_template_ids.length > 0) {
        // Lấy toàn bộ danh sách kỹ năng mà Agent sở hữu
        const allSkills = await this.skillTemplateModel.find({
          _id: { $in: agent.enabled_skill_template_ids }
        }).lean();
        
        if (allSkills.length > 0) {
          // Chuẩn bị dữ liệu metadata (chỉ lấy Title, Description) để gửi sang AI_Core Router
          const availableSkills = allSkills.map(s => ({
            id: s._id.toString(),
            title: s.name || '',
            description: s.description || s.name || '',
          }));

          const lastUser = this.lastUserContent(taskDoc);
          // Gọi AI_Core để xin danh sách ID các kỹ năng cần thiết
          const selectedSkillIds = await this.aiCoreService.routeSkills(
            lastUser || 'Không có mô tả chi tiết',
            availableSkills
          );

          // Lọc ra các kỹ năng mà AI_Core đã chọn
          const selectedSkills = allSkills.filter(s => selectedSkillIds.includes(s._id.toString()));

          if (selectedSkills.length > 0) {
            skillsContext = '### KỸ NĂNG ĐƯỢC CUNG CẤP TỪ HỆ THỐNG (ĐÃ ĐƯỢC LỌC THEO NGỮ CẢNH):\n';
            selectedSkills.forEach((s, idx) => {
              skillsContext += `\n--- Skill ${idx + 1}: ${s.name} ---\n${s.content}\n`;
            });
            this.logger.log(
              `Task ${taskIdHex}: Skill Router đã chọn ${selectedSkills.length}/${allSkills.length} kỹ năng.`,
            );
          } else {
            this.logger.log(
              `Task ${taskIdHex}: Skill Router không chọn kỹ năng nào.`,
            );
          }
        }
      }

      // 4. RAG: Atlas $vectorSearch + MongoDB `$text` trên chunk_text (gộp trong Node)
      let ragContext = '';
      const lastUserMessage = this.lastUserContent(taskDoc);

      if (lastUserMessage && lastUserMessage.trim() !== '') {
        try {
          const queryForEmbed = this.prepareRagEmbedText(lastUserMessage);
          this.logger.log(
            `RAG: embed ${queryForEmbed.length} ký tự (đầu): "${queryForEmbed.slice(0, 100)}…"`,
          );

          const queryVector =
            await this.geminiEmbeddingService.embedOne(queryForEmbed);

          const indexName = this.ragVectorIndexName();
          const workspaceOid = taskDoc.workspace_id;

          // Lọc workspace_id TRONG $vectorSearch — nếu $match sau cùng, top-K toàn DB có thể
          // không có chunk nào của workspace → RAG luôn rỗng dù kho có dữ liệu.
          const vectorChunks: RagVectorChunk[] =
            await this.knowledgeChunkModel.aggregate<RagVectorChunk>([
              {
                $vectorSearch: {
                  index: indexName,
                  path: 'embedding',
                  queryVector,
                  numCandidates: 200,
                  limit: 3,
                  filter: { workspace_id: { $eq: workspaceOid } },
                },
              },
            ]);

          let mergedChunks = vectorChunks;
          if (this.ragHybridTextEnabled()) {
            try {
              const textChunks = await this.ragFullTextChunks(
                workspaceOid,
                lastUserMessage,
              );
              mergedChunks = this.mergeRagChunks(
                vectorChunks,
                textChunks,
                this.ragMergedMax(),
              );
              this.logger.log(
                `RAG hybrid: vector=${vectorChunks.length} text=${textChunks.length} merged=${mergedChunks.length} (max=${this.ragMergedMax()})`,
              );
            } catch (textErr) {
              const tm =
                textErr instanceof Error ? textErr.message : String(textErr);
              this.logger.warn(
                `RAG full-text bỏ qua: ${tm} — chạy syncIndexes / tạo text index trên chunk_text, hoặc RAG_HYBRID_TEXT=0.`,
              );
              mergedChunks = vectorChunks;
            }
          }

          if (mergedChunks?.length) {
            ragContext = '### DỮ LIỆU TÀI LIỆU KHO (RAG CONTEXT):\n';
            mergedChunks.forEach((c, idx) => {
              const piece =
                typeof c.chunk_text === 'string' ? c.chunk_text : '';
              ragContext += `${idx + 1}. ${piece}\n\n`;
            });
            this.logger.log(
              `RAG: ${mergedChunks.length} chunk(s) · index=${indexName} · workspace=${workspaceIdStr}`,
            );
          } else {
            this.logger.warn(
              `RAG: không có chunk (vector=${vectorChunks.length}, workspace=${workspaceIdStr}, index=${indexName}). Kiểm tra upload, vector index, embedding; hybrid text cần text index trên chunk_text.`,
            );
          }
        } catch (e) {
          const errMessage = e instanceof Error ? e.message : String(e);
          this.logger.warn(`Lỗi khi truy vấn Vector Search: ${errMessage}`);
          // Tiếp tục thực thi mà không có RAG nếu có lỗi
        }
      }

      // 5. Tổng hợp thành compiled_prompt
      const systemPrompt = agent.system_prompt ? `### CHỈ THỊ CỦA AGENT:\n${agent.system_prompt}\n\n` : '';
      const customSkills = agent.custom_skills ? `### KỸ NĂNG TÙY CHỈNH:\n${agent.custom_skills}\n\n` : '';
      const taskModeLine = isDraftMode ? '### TASK MODE: DRAFT\n\n' : '';
      const taskReq = `${taskModeLine}### NHIỆM VỤ CỦA BẠN (TỪ NGƯỜI DÙNG):\n${lastUserMessage || 'Hãy xem tài liệu và xử lý yêu cầu.'}`;
      const currentMessages =
        (taskDoc.messages as Array<{ role?: string; content?: string; createdAt?: Date }>) || [];
      let memoryContext = '';
      try {
        memoryContext = await this.memoryFlowService.buildMemoryContext({
          workspaceId: taskDoc.workspace_id,
          userId: taskDoc.created_by,
          threadId:
            String(taskDoc.thread_id ?? '').trim() || taskIdHex,
          userQuery: lastUserMessage || '',
          currentMessages,
        });
      } catch (memErr) {
        this.memoryFlowService.logMemoryError(memErr, 'build_memory_context');
      }

      const ragPreamble = ragContext
        ? '### ƯU TIÊN NGUỒN TRI THỨC WORKSPACE\n'
          + 'Phần **DỮ LIỆU TÀI LIỆU KHO** bên dưới là trích từ tài liệu đã upload trong workspace. '
          + 'Hãy **dựa vào đó trước** để trả lời; chỉ gọi **Search_Tavily** khi tài liệu kho không chứa đủ thông tin hoặc user yêu cầu rõ tin mới / tra cứu ngoài tài liệu. '
          + 'Trả lời **đủ từng ý** user hỏi. Phần hiển thị cho user (sau thẻ `</thought>` nếu có) **chỉ tiếng Việt**.\n\n'
        : '';

      const compiledPrompt = [
        systemPrompt,
        customSkills,
        skillsContext,
        memoryContext,
        ragPreamble,
        ragContext,
        taskReq,
      ]
        .filter(Boolean)
        .join('\n\n');

      // 6. Cập nhật compiled_prompt vào Database để lưu vết
      await this.taskModel.updateOne({ _id: taskDoc._id }, { $set: { compiled_prompt: compiledPrompt } });

      // 7. Gọi API tới AI_Core (session_id = thread_id để đa lượt checkpoint)
      const sessionId =
        String(taskDoc.thread_id ?? '').trim() || taskIdHex;
      // Nest inject đúng AiCoreService; strict-eslint đôi khi không suy ra kiểu phương thức.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- chatWithAiStream → Promise<string>
      const streamResult: unknown = await this.aiCoreService.chatWithAiStream(
        compiledPrompt,
        creatorHex,
        sessionId,
        (chunk: string) =>
          this.tasksGateway.emitTaskStream(workspaceIdStr, taskId, chunk),
      );
      const result =
        typeof streamResult === 'string' ? streamResult : String(streamResult);

      // 8. Cập nhật trạng thái + lịch sử assistant
      const assistantBubble = {
        role: 'assistant' as const,
        content: result,
        createdAt: new Date(),
      };
      const rawMsgs = (taskDoc.messages || []) as Array<{ role?: string }>;
      const legacyHydrate =
        rawMsgs.length === 0 && (taskDoc.description || '').trim().length > 0;

      if (isDraftMode) {
        // Parse action plan contract from AI_Core output.
        const startIdx = result.indexOf(ACTION_PLAN_START);
        const endIdx = result.indexOf(ACTION_PLAN_END, startIdx + ACTION_PLAN_START.length);
        if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
          throw new Error(
            `AI/Core draft output thiếu marker action plan (${ACTION_PLAN_START}...${ACTION_PLAN_END}).`,
          );
        }
        const jsonText = result.slice(
          startIdx + ACTION_PLAN_START.length,
          endIdx,
        );
        let actionPlan: unknown = null;
        try {
          actionPlan = JSON.parse(jsonText);
        } catch (e) {
          throw new Error(`Parse JSON action plan thất bại: ${e instanceof Error ? e.message : String(e)}`);
        }

        const userVisibleMessage = (
          result.slice(0, startIdx) + result.slice(endIdx + ACTION_PLAN_END.length)
        )
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        const requiresHuman = Boolean((actionPlan as any)?.requires_human);
        const nextStatus = requiresHuman ? 'waiting_human_input' : 'waiting_execute_approval';
        const draftPayload = JSON.stringify(actionPlan);

        const draftAssistantBubble = {
          ...assistantBubble,
          content: userVisibleMessage,
        };

        if (legacyHydrate) {
          await this.taskModel.updateOne(
            { _id: taskDoc._id },
            {
              $set: {
                status: nextStatus,
                result: userVisibleMessage,
                draft_payload: draftPayload,
                messages: [
                  {
                    role: 'user',
                    content: (taskDoc.description || '').trim(),
                    createdAt: taskDoc.createdAt ?? new Date(),
                  },
                  draftAssistantBubble,
                ],
              },
            },
          );
        } else {
          await this.taskModel.updateOne(
            { _id: taskDoc._id },
            {
              $set: { status: nextStatus, result: userVisibleMessage, draft_payload: draftPayload },
              $push: { messages: draftAssistantBubble },
            },
          );
        }

        this.tasksGateway.emitTaskStatus(
          workspaceIdStr,
          taskId,
          nextStatus,
          userVisibleMessage,
        );
        this.logger.log(`Task ${taskIdHex}: draft ready → ${nextStatus}`);
      } else {
        // Execute mode: giữ luồng cũ.
        if (legacyHydrate) {
          await this.taskModel.updateOne(
            { _id: taskDoc._id },
            {
              $set: {
                status: 'completed',
                result,
                messages: [
                  {
                    role: 'user',
                    content: (taskDoc.description || '').trim(),
                    createdAt: taskDoc.createdAt ?? new Date(),
                  },
                  assistantBubble,
                ],
              },
            },
          );
        } else {
          await this.taskModel.updateOne(
            { _id: taskDoc._id },
            {
              $set: { status: 'completed', result },
              $push: { messages: assistantBubble },
            },
          );
        }
        this.tasksGateway.emitTaskStatus(
          workspaceIdStr,
          taskId,
          'completed',
          result,
        );
        try {
          await this.memoryFlowService.ingestTaskOutcome({
            workspaceId: taskDoc.workspace_id,
            userId: taskDoc.created_by,
            threadId: sessionId,
            taskId: taskDoc._id,
            status: 'completed',
            userPrompt: lastUserMessage || '',
            assistantAnswer: result,
            messages: currentMessages,
          });
        } catch (memErr) {
          this.memoryFlowService.logMemoryError(memErr, 'ingest_completed');
        }
        this.logger.log(`Task ${taskIdHex} hoàn thành thành công.`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi thực thi Task ${taskIdHex}: ${errorMessage}`);
      const failText = `Lỗi hệ thống: ${errorMessage}`;
      const assistantBubble = {
        role: 'assistant' as const,
        content: failText,
        createdAt: new Date(),
      };
      const rawMsgs = (taskDoc.messages || []) as Array<{ role?: string }>;
      const legacyHydrate =
        rawMsgs.length === 0 && (taskDoc.description || '').trim().length > 0;

      if (legacyHydrate) {
        await this.taskModel.updateOne(
          { _id: taskDoc._id },
          {
            $set: {
              status: 'failed',
              result: failText,
              messages: [
                {
                  role: 'user',
                  content: (taskDoc.description || '').trim(),
                  createdAt: taskDoc.createdAt ?? new Date(),
                },
                assistantBubble,
              ],
            },
          },
        );
      } else {
        await this.taskModel.updateOne(
          { _id: taskDoc._id },
          {
            $set: { status: 'failed', result: failText },
            $push: { messages: assistantBubble },
          },
        );
      }
      this.tasksGateway.emitTaskStatus(workspaceIdStr, taskId, 'failed', errorMessage);
      if (!isDraftMode) {
        try {
          await this.memoryFlowService.ingestTaskOutcome({
            workspaceId: taskDoc.workspace_id,
            userId: taskDoc.created_by,
            threadId:
              String(taskDoc.thread_id ?? '').trim() || taskIdHex,
            taskId: taskDoc._id,
            status: 'failed',
            userPrompt: this.lastUserContent(taskDoc),
            assistantAnswer: failText,
            messages:
              ((taskDoc.messages || []) as Array<{
                role?: string;
                content?: string;
                createdAt?: Date;
              }>) || [],
          });
        } catch (memErr) {
          this.memoryFlowService.logMemoryError(memErr, 'ingest_failed');
        }
      }
    }
  }

  private extractActionPlanFromDraftResult(
    resultText: string,
  ): { actionPlan: unknown | null; userVisibleMessage: string } {
    const ACTION_PLAN_START = '<!--CF_ACTION_PLAN_START-->';
    const ACTION_PLAN_END = '<!--CF_ACTION_PLAN_END-->';
    const startIdx = resultText.indexOf(ACTION_PLAN_START);
    const endIdx = resultText.indexOf(
      ACTION_PLAN_END,
      startIdx + ACTION_PLAN_START.length,
    );
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return { actionPlan: null, userVisibleMessage: resultText.trim() };
    }

    const jsonText = resultText.slice(
      startIdx + ACTION_PLAN_START.length,
      endIdx,
    );
    let actionPlan: unknown = null;
    try {
      actionPlan = JSON.parse(jsonText);
    } catch {
      actionPlan = null;
    }

    const userVisibleMessage = (
      resultText.slice(0, startIdx) +
      resultText.slice(endIdx + ACTION_PLAN_END.length)
    )
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { actionPlan, userVisibleMessage };
  }

  async humanAnswer(
    userId: string,
    taskId: string,
    workspaceId: string,
    answer: string,
  ): Promise<object> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const tid = toObjectId(taskId);

    const taskDoc = await this.taskModel
      .findOne({ _id: tid, workspace_id: wid })
      .exec();
    if (!taskDoc) throw new NotFoundException('Không tìm thấy task');

    if (taskDoc.status !== 'waiting_human_input') {
      throw new BadRequestException(
        `Không thể gửi câu trả lời khi task.status=${String(taskDoc.status)}`,
      );
    }

    const taskIdHex = this.idHex(taskDoc._id);
    const sessionId =
      String(taskDoc.thread_id ?? '').trim() || taskIdHex;
    const creatorHex = this.idHex(taskDoc.created_by);

    // Gửi trực tiếp sang AI_Core để cập nhật draft/action-plan.
    const userAnswerText = answer.trim();
    if (!userAnswerText) {
      throw new BadRequestException('Câu trả lời không được để trống.');
    }

    const query = [
      '### TASK MODE: DRAFT',
      '',
      'Người dùng trả lời các câu hỏi sau (tóm tắt theo đúng cấu trúc đã hỏi):',
      userAnswerText,
      '',
      'Hãy cập nhật action plan contract (marker JSON) và phản hồi user_visible_message ngắn gọn.',
    ].join('\n');

    let aiText: string;
    try {
      aiText = await this.aiCoreService.chatWithAiStream(
        query,
        creatorHex,
        sessionId,
        () => {
          /* Không stream chunk xuống FE trong vòng human-answer MVP */
        },
      );
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : `Lỗi kết nối AI_Core: ${String(e)}`;
      this.tasksGateway.emitTaskStatus(this.idHex(taskDoc.workspace_id), taskId, 'failed', msg);
      throw new Error(msg);
    }

    const { actionPlan, userVisibleMessage } =
      this.extractActionPlanFromDraftResult(aiText);

    if (!actionPlan) {
      // Nếu không parse được hợp đồng, giữ ở waiting_human_input để UI có thể hỏi lại.
      await this.taskModel.updateOne(
        { _id: taskDoc._id },
        {
          $set: {
            status: 'waiting_human_input',
            result: userVisibleMessage,
          },
          $push: {
            messages: {
              role: 'user',
              content: userAnswerText,
              createdAt: new Date(),
            },
          },
        },
      );
      this.tasksGateway.emitTaskStatus(
        this.idHex(taskDoc.workspace_id),
        taskId,
        'waiting_human_input',
        userVisibleMessage,
      );
      const updated = await this.taskModel
        .findById(taskDoc._id)
        .lean()
        .exec();
      if (!updated) throw new BadRequestException('Không đọc lại được task.');
      return updated as object;
    }

    const requiresHuman = Boolean((actionPlan as any)?.requires_human);
    const nextStatus = requiresHuman
      ? 'waiting_human_input'
      : 'waiting_execute_approval';
    const draftPayload = JSON.stringify(actionPlan);

    const assistantBubble = {
      role: 'assistant' as const,
      content: userVisibleMessage,
      createdAt: new Date(),
    };

    await this.taskModel.updateOne(
      { _id: taskDoc._id },
      {
        $set: {
          status: nextStatus,
          result: userVisibleMessage,
          draft_payload: draftPayload,
        },
        $push: {
          messages: {
            $each: [
              {
                role: 'user',
                content: userAnswerText,
                createdAt: new Date(),
              },
              assistantBubble,
            ],
          },
        },
      },
    );

    this.tasksGateway.emitTaskStatus(
      this.idHex(taskDoc.workspace_id),
      taskId,
      nextStatus,
      userVisibleMessage,
    );

    const updated = await this.taskModel.findById(taskDoc._id).lean().exec();
    if (!updated) throw new BadRequestException('Không đọc lại được task.');
    return updated as object;
  }

  /**
   * MVP scheduler tick:
   * - Lặp mỗi phút (bull repeatable job `scheduler_tick`)
   * - Quét task schedule_enabled=true và next_run_at đã tới
   * - Reset task -> draft_ready và enqueue lại `process_task`
   *
   * Lưu ý: Đây là MVP; bước hoàn chỉnh sẽ tách "rule" và "task instance"
   * theo đúng semantics của plan (scheduler tạo instance mới mỗi chu kỳ).
   */
  async schedulerTick(): Promise<{ enqueued: number }> {
    const now = new Date();
    const dueTasks = await this.taskModel
      .find({
        schedule_enabled: true,
        next_run_at: { $lte: now },
      })
      .exec();

    let enqueued = 0;

    const addDays = (d: Date, days: number) => {
      const x = new Date(d);
      x.setDate(x.getDate() + days);
      return x;
    };

    for (const t of dueTasks) {
      const taskIdHex = this.idHex(t._id);
      const scheduleCron = String(t.schedule_cron ?? '').toLowerCase();

      const isWaiting =
        t.status === 'waiting_human_input' ||
        t.status === 'waiting_execute_approval';

      const nextRunAt = (() => {
        // MVP: chỉ phân biệt daily vs weekly_tue (dò theo schedule_cron).
        const weeklyLike =
          scheduleCron.includes('weekly') ||
          scheduleCron.includes('tuesday') ||
          scheduleCron.includes('t3') ||
          scheduleCron.includes('thứ 3') ||
          scheduleCron.endsWith(' 3') ||
          scheduleCron.endsWith('* 3') ||
          scheduleCron.includes(' 3 ');
        return addDays(t.next_run_at ?? now, weeklyLike ? 7 : 1);
      })();

      await this.taskModel.updateOne(
        { _id: t._id },
        {
          $set: {
            next_run_at: nextRunAt,
            // Nếu đang chờ user, không reset/xoá để tránh mất dữ liệu.
            ...(isWaiting
              ? {}
              : {
                  status: 'draft_ready',
                  draft_payload: null,
                  result: null,
                  compiled_prompt: null,
                  messages: [],
                }),
          },
        },
      );

      if (isWaiting) {
        continue;
      }

      await this.tasksQueue.add(
        'process_task',
        { taskId: taskIdHex },
        {
          jobId: `process_task:${taskIdHex}:${now.getTime()}`,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      enqueued++;
    }

    return { enqueued };
  }

  async approveTask(
    userId: string,
    taskId: string,
    workspaceId: string,
  ): Promise<object> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const tid = toObjectId(taskId);
    const taskDoc = await this.taskModel
      .findOne({ _id: tid, workspace_id: wid })
      .exec();
    if (!taskDoc) throw new NotFoundException('Không tìm thấy task');

    if (taskDoc.status !== 'waiting_execute_approval') {
      throw new BadRequestException(
        `Chỉ có thể approve khi task đang waiting_execute_approval (hiện=${String(taskDoc.status)})`,
      );
    }

    const taskIdHex = this.idHex(taskDoc._id);
    const workspaceIdStr = this.idHex(taskDoc.workspace_id);
    const threadId =
      String(taskDoc.thread_id ?? '').trim() || taskIdHex;

    this.tasksGateway.emitTaskStatus(workspaceIdStr, taskId, 'in_progress');
    await this.taskModel.updateOne(
      { _id: taskDoc._id },
      { $set: { status: 'in_progress' } },
    );

    // Parse action plan (sẽ dùng để execute connectors ở bước sau).
    let actionPlan: any | null = null;
    if (taskDoc.draft_payload) {
      try {
        actionPlan = JSON.parse(String(taskDoc.draft_payload));
      } catch {
        actionPlan = null;
      }
    }

    // Execute connectors (MVP simulated), sau này sẽ thay bằng Gmail/Calendar/Drive/Notion thực.
    const idempotencyKey = String(
      (actionPlan as any)?.idempotency_key ??
        (actionPlan as any)?.execution_key ??
        `approve:${taskIdHex}`,
    );

    const integrationsEnabled =
      await this.usersService.getExecutorIntegrationsGate(
        String(taskDoc.created_by),
      );

    const { executeResultText, executionLog } =
      await this.thirdPartyExecutor.executeActionPlanMvp(
        actionPlan ?? {},
        idempotencyKey,
        integrationsEnabled,
      );

    const assistantBubble = {
      role: 'assistant' as const,
      content: executeResultText,
      createdAt: new Date(),
    };

    await this.taskModel.updateOne(
      { _id: taskDoc._id },
      {
        $set: {
          status: 'completed',
          result: executeResultText,
          last_execution_idempotency_key: idempotencyKey,
          execution_log: executionLog,
          executed_at: new Date(),
        },
        $push: { messages: assistantBubble },
      },
    );

    this.tasksGateway.emitTaskStatus(
      workspaceIdStr,
      taskId,
      'completed',
      executeResultText,
    );

    // Ingest memory sau khi approve/execute thật (MVP hiện tại coi như execute).
    const currentMessages = (taskDoc.messages || []) as Array<{
      role?: string;
      content?: string;
      createdAt?: Date;
    }>;
    try {
      await this.memoryFlowService.ingestTaskOutcome({
        workspaceId: taskDoc.workspace_id,
        userId: taskDoc.created_by,
        threadId,
        taskId: taskDoc._id,
        status: 'completed',
        userPrompt: this.lastUserContent(taskDoc) || '',
        assistantAnswer: executeResultText,
        messages: currentMessages,
      });
    } catch (memErr) {
      this.memoryFlowService.logMemoryError(memErr, 'ingest_approve_completed');
    }

    const updated = await this.taskModel.findById(taskDoc._id).lean().exec();
    if (!updated) throw new BadRequestException('Không đọc lại được task.');
    return updated as object;
  }

  async rejectTask(
    userId: string,
    taskId: string,
    workspaceId: string,
  ): Promise<object> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const tid = toObjectId(taskId);
    const taskDoc = await this.taskModel
      .findOne({ _id: tid, workspace_id: wid })
      .exec();
    if (!taskDoc) throw new NotFoundException('Không tìm thấy task');

    if (taskDoc.status !== 'waiting_execute_approval') {
      throw new BadRequestException(
        `Chỉ có thể reject khi task đang waiting_execute_approval (hiện=${String(taskDoc.status)})`,
      );
    }

    const rejectText = 'Người dùng đã từ chối dự thảo.';

    await this.taskModel.updateOne(
      { _id: taskDoc._id },
      {
        $set: { status: 'rejected', result: rejectText },
      },
    );

    const workspaceIdStr = this.idHex(taskDoc.workspace_id);
    this.tasksGateway.emitTaskStatus(
      workspaceIdStr,
      taskId,
      'rejected',
      rejectText,
    );

    const updated = await this.taskModel.findById(taskDoc._id).lean().exec();
    if (!updated) throw new BadRequestException('Không đọc lại được task.');
    return updated as object;
  }

  async appendUserMessage(
    userId: string,
    taskId: string,
    workspaceId: string,
    content: string,
  ): Promise<object> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const tid = toObjectId(taskId);
    const doc = await this.taskModel.findOne({
      _id: tid,
      workspace_id: wid,
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy task');
    }
    const allowed: TaskStatus[] = [
      'completed',
      'failed',
      'waiting_approval',
    ];
    if (!allowed.includes(doc.status)) {
      throw new BadRequestException(
        'Chỉ có thể nhắn tiếp khi task đã xong, lỗi hoặc chờ duyệt.',
      );
    }
    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống.');
    }
    await this.taskModel.updateOne(
      { _id: doc._id },
      {
        $set: { status: 'scheduled' },
        $push: {
          messages: {
            role: 'user',
            content: trimmed,
            createdAt: new Date(),
          },
        },
      },
    );
    await this.tasksQueue.add(
      'process_task',
      { taskId: this.idHex(doc._id) },
      { removeOnComplete: true, removeOnFail: false },
    );
    const updated = await this.taskModel
      .findById(doc._id)
      .lean()
      .exec();
    return updated as object;
  }

  async findAllByWorkspace(
    userId: string,
    q: ListTasksQueryDto,
  ): Promise<object[]> {
    await this.workspacesService.findOne(userId, q.workspace_id);
    const wid = toObjectId(q.workspace_id);
    const filter: Record<string, unknown> = { workspace_id: wid };
    if (q.agent_id) {
      filter.agent_id = toObjectId(q.agent_id);
    }
    if (q.status) {
      filter.status = q.status;
    }
    const rows = await this.taskModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as object[];
  }

  async findOne(
    userId: string,
    taskId: string,
    workspaceId: string,
  ): Promise<object> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const doc = await this.taskModel
      .findOne({ _id: toObjectId(taskId), workspace_id: wid })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('Không tìm thấy task');
    }
    return doc as object;
  }

  async update(
    userId: string,
    taskId: string,
    workspaceId: string,
    dto: UpdateTaskDto,
  ): Promise<object> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const $set: Record<string, unknown> = {};
    if (dto.title !== undefined) $set.title = dto.title;
    if (dto.description !== undefined) $set.description = dto.description;
    if (dto.status !== undefined) $set.status = dto.status;
    if (dto.thread_id !== undefined) $set.thread_id = dto.thread_id;
    if (dto.schedule_enabled !== undefined) $set.schedule_enabled = dto.schedule_enabled;
    if (dto.schedule_cron !== undefined) $set.schedule_cron = dto.schedule_cron;
    if (dto.next_run_at !== undefined) {
      $set.next_run_at = dto.next_run_at ? new Date(dto.next_run_at) : null;
    }
    if (dto.agent_id != null && String(dto.agent_id).trim() !== '') {
      const aid = toObjectId(String(dto.agent_id));
      await this.assertAgentInWorkspace(aid, wid);
      $set.agent_id = aid;
    }
    if (Object.keys($set).length === 0) {
      const cur = await this.taskModel
        .findOne({ _id: toObjectId(taskId), workspace_id: wid })
        .exec();
      if (!cur) {
        throw new NotFoundException('Không tìm thấy task');
      }
      return cur.toJSON() as object;
    }
    const doc = await this.taskModel
      .findOneAndUpdate(
        { _id: toObjectId(taskId), workspace_id: wid },
        { $set },
        { returnDocument: 'after' },
      )
      .exec();
    if (!doc) {
      throw new NotFoundException('Không tìm thấy task');
    }
    return doc.toJSON() as object;
  }

  async remove(
    userId: string,
    taskId: string,
    workspaceId: string,
  ): Promise<string> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const res = await this.taskModel.deleteOne({
      _id: toObjectId(taskId),
      workspace_id: wid,
    });
    if (res.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy task');
    }
    return 'OK';
  }
}
