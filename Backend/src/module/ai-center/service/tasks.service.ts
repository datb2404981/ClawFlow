import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { toObjectId } from 'src/common/util/object-id.util';
import { WorkspacesService } from 'src/module/accounts/service/workspaces.service';
import { Agents, AgentsDocument, Task, TaskDocument, TaskMessage, TaskMessageDocument } from '../schema/ai-center.schema';
import { CreateTaskDto } from '../dto/create-task.dto';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { SendTaskMessageDto } from '../dto/send-task-message.dto';
import { AiCoreService } from './ai-core.service';
import { GeminiEmbeddingService } from 'src/module/accounts/service/gemini-embedding.service';
import { KnowledgeChunk, KnowledgeChunkDocument } from 'src/module/workspace-documents-module/schema/workspace-document.schema';
import { SkillTemplate, SkillTemplateDocument } from '../schema/skill-template.schema';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TasksGateway } from '../gateway/tasks.gateway';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Agents.name) private agentsModel: Model<AgentsDocument>,
    @InjectModel(TaskMessage.name) private taskMessageModel: Model<TaskMessageDocument>,
    @InjectModel(KnowledgeChunk.name) private knowledgeChunkModel: Model<KnowledgeChunkDocument>,
    @InjectModel(SkillTemplate.name) private skillTemplateModel: Model<SkillTemplateDocument>,
    private readonly workspacesService: WorkspacesService,
    private readonly aiCoreService: AiCoreService,
    private readonly geminiEmbeddingService: GeminiEmbeddingService,
    @InjectQueue('tasks_queue') private readonly tasksQueue: Queue,
    private readonly tasksGateway: TasksGateway,
  ) {}

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

  async create(userId: string, dto: CreateTaskDto): Promise<object> {
    const wid = toObjectId(dto.workspace_id);
    const aid = toObjectId(dto.agent_id);
    await this.workspacesService.findOne(userId, dto.workspace_id);
    await this.assertAgentInWorkspace(aid, wid);
    const uid = toObjectId(userId);
    const doc = await this.taskModel.create({
      workspace_id: wid,
      agent_id: aid,
      created_by: uid,
      title: dto.title,
      description: dto.description,
      status: dto.status ?? 'scheduled',
      thread_id: dto.thread_id,
    });

    // Lưu tin nhắn đầu tiên (user message = mô tả task) vào lịch sử hội thoại
    if (dto.description) {
      await this.taskMessageModel.create({
        task_id: doc._id,
        workspace_id: wid,
        role: 'user',
        content: dto.description,
      });
    }

    // Bắn Job vào Redis Queue để chạy ngầm an toàn
    await this.tasksQueue.add('process_task', { taskId: doc._id.toString() }, {
      removeOnComplete: true,
      removeOnFail: false,
    });

    return doc.toJSON() as object;
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
    const workspaceIdStr = taskDoc.workspace_id.toString();
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

          // Gọi AI_Core để xin danh sách ID các kỹ năng cần thiết
          const selectedSkillIds = await this.aiCoreService.routeSkills(
            taskDoc.description || 'Không có mô tả chi tiết', 
            availableSkills
          );

          // Lọc ra các kỹ năng mà AI_Core đã chọn
          const selectedSkills = allSkills.filter(s => selectedSkillIds.includes(s._id.toString()));

          if (selectedSkills.length > 0) {
            skillsContext = '### KỸ NĂNG ĐƯỢC CUNG CẤP TỪ HỆ THỐNG (ĐÃ ĐƯỢC LỌC THEO NGỮ CẢNH):\n';
            selectedSkills.forEach((s, idx) => {
              skillsContext += `\n--- Skill ${idx + 1}: ${s.name} ---\n${s.content}\n`;
            });
            this.logger.log(`Task ${taskDoc._id}: Skill Router đã chọn ${selectedSkills.length}/${allSkills.length} kỹ năng.`);
          } else {
            this.logger.log(`Task ${taskDoc._id}: Skill Router không chọn kỹ năng nào.`);
          }
        }
      }

      // 4. RAG: Vector Search trên KnowledgeChunks
      let ragContext = '';
      if (taskDoc.description && taskDoc.description.trim() !== '') {
        try {
          const queryVector = await this.geminiEmbeddingService.embedOne(taskDoc.description);
          
          // Thực hiện truy vấn $vectorSearch trên MongoDB Atlas
          const chunks = await this.knowledgeChunkModel.aggregate([
            {
              $vectorSearch: {
                index: 'default', // Cần đảm bảo index đúng tên (hoặc cấu hình)
                path: 'embedding',
                queryVector: queryVector,
                numCandidates: 100,
                limit: 3,
              },
            },
            {
              $match: {
                workspace_id: taskDoc.workspace_id,
              },
            },
          ]);

          if (chunks && chunks.length > 0) {
            ragContext = '### DỮ LIỆU TÀI LIỆU KHO (RAG CONTEXT):\n';
            chunks.forEach((c) => {
              ragContext += `- ${c.chunk_text}\n`;
            });
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
      const taskReq = `### NHIỆM VỤ CỦA BẠN (TỪ NGƯỜI DÙNG):\n${taskDoc.description || 'Hãy xem tài liệu và xử lý yêu cầu.'}`;

      const compiledPrompt = [
        systemPrompt,
        customSkills,
        skillsContext,
        ragContext,
        taskReq
      ].filter(Boolean).join('\n\n');

      // 6. Cập nhật compiled_prompt vào Database để lưu vết
      await this.taskModel.updateOne({ _id: taskDoc._id }, { $set: { compiled_prompt: compiledPrompt } });

      // 7. Gọi API tới AI_Core
      const result = await this.aiCoreService.chatWithAi(
        compiledPrompt,
        taskDoc.created_by.toString(),
        taskDoc._id.toString()
      );

      // 8. Cập nhật trạng thái thành công
      await this.taskModel.updateOne(
        { _id: taskDoc._id },
        { $set: { status: 'completed', result: result } }
      );

      // Lưu phản hồi AI vào lịch sử hội thoại
      await this.taskMessageModel.create({
        task_id: taskDoc._id,
        workspace_id: taskDoc.workspace_id,
        role: 'assistant',
        content: result,
      });

      this.tasksGateway.emitTaskStatus(workspaceIdStr, taskId, 'completed', result);
      this.logger.log(`Task ${taskDoc._id} hoàn thành thành công.`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi thực thi Task ${taskDoc._id}: ${errorMessage}`);
      await this.taskModel.updateOne(
        { _id: taskDoc._id },
        { 
          $set: { 
            status: 'failed', 
            result: `Lỗi hệ thống: ${errorMessage}` 
          } 
        }
      );
      this.tasksGateway.emitTaskStatus(workspaceIdStr, taskId, 'failed', errorMessage);
    }
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
    const doc = await this.taskModel
      .findOneAndUpdate(
        { _id: toObjectId(taskId), workspace_id: wid },
        { $set: dto },
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

  async getMessages(
    userId: string,
    taskId: string,
    workspaceId: string,
  ): Promise<object[]> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const tid = toObjectId(taskId);
    // Verify the task belongs to this workspace
    const task = await this.taskModel.findOne({ _id: tid, workspace_id: wid }).lean();
    if (!task) {
      throw new NotFoundException('Không tìm thấy task');
    }
    const messages = await this.taskMessageModel
      .find({ task_id: tid, workspace_id: wid })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return messages as object[];
  }

  async sendMessage(
    userId: string,
    taskId: string,
    workspaceId: string,
    dto: SendTaskMessageDto,
  ): Promise<object> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    const tid = toObjectId(taskId);

    const taskDoc = await this.taskModel.findOne({ _id: tid, workspace_id: wid });
    if (!taskDoc) {
      throw new NotFoundException('Không tìm thấy task');
    }

    // Lưu tin nhắn người dùng
    await this.taskMessageModel.create({
      task_id: tid,
      workspace_id: wid,
      role: 'user',
      content: dto.content,
    });

    // Cập nhật trạng thái task
    await this.taskModel.updateOne({ _id: tid }, { $set: { status: 'in_progress' } });
    this.tasksGateway.emitTaskStatus(workspaceId, taskId, 'in_progress');

    try {
      // Gọi AI_Core với nội dung tin nhắn mới
      const result = await this.aiCoreService.chatWithAi(
        dto.content,
        taskDoc.created_by.toString(),
        taskDoc._id.toString(),
      );

      // Lưu phản hồi AI
      const assistantMsg = await this.taskMessageModel.create({
        task_id: tid,
        workspace_id: wid,
        role: 'assistant',
        content: result,
      });

      // Cập nhật kết quả và trạng thái task
      await this.taskModel.updateOne(
        { _id: tid },
        { $set: { status: 'completed', result: result } },
      );
      this.tasksGateway.emitTaskStatus(workspaceId, taskId, 'completed', result);

      return assistantMsg.toJSON() as object;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.taskModel.updateOne(
        { _id: tid },
        { $set: { status: 'failed' } },
      );
      this.tasksGateway.emitTaskStatus(workspaceId, taskId, 'failed', errorMessage);
      throw error;
    }
  }
}
