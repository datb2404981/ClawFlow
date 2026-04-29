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
    @InjectModel(TaskMessage.name) private taskMessageModel: Model<TaskMessageDocument>,
    @InjectModel(Agents.name) private agentsModel: Model<AgentsDocument>,
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

  private async saveMessage(taskId: Types.ObjectId, role: 'user' | 'assistant', content: string): Promise<void> {
    await this.taskMessageModel.create({
      task_id: taskId,
      role,
      content,
    });
  }

  private async getMessages(taskId: Types.ObjectId): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.taskMessageModel.find({ task_id: taskId }).sort({ createdAt: 1 }).lean();
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async getTaskMessages(
    userId: string,
    taskId: string,
    workspaceId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);
    
    const task = await this.taskModel
      .findOne({ _id: toObjectId(taskId), workspace_id: wid })
      .lean()
      .exec();
    if (!task) {
      throw new NotFoundException('Không tìm thấy task');
    }

    return this.getMessages(task._id);
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

    // Bắn Job vào Redis Queue để chạy ngầm an toàn
    await this.tasksQueue.add('process_task', { taskId: doc._id.toString() }, {
      jobId: doc._id.toString(),
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
    const taskIdObj = taskDoc._id;
    this.tasksGateway.emitTaskStatus(workspaceIdStr, taskId, 'in_progress');
    try {
      // 1. Cập nhật status thành in_progress
      await this.taskModel.updateOne({ _id: taskIdObj }, { $set: { status: 'in_progress' } });

      // 1.5. Lưu initial message nếu đây là lần đầu (chưa có message nào)
      const existingMessages = await this.getMessages(taskIdObj);
      if (existingMessages.length === 0 && taskDoc.description) {
        await this.saveMessage(taskIdObj, 'user', taskDoc.description);
      }

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
          const lastUserMessage = existingMessages
            .reverse()
            .find((m) => m.role === 'user')?.content || taskDoc.description || 'Không có mô tả chi tiết';
          
          const selectedSkillIds = await this.aiCoreService.routeSkills(
            lastUserMessage,
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
      const lastUserMessage = existingMessages
        .reverse()
        .find((m) => m.role === 'user')?.content || taskDoc.description || '';
      
      if (lastUserMessage && lastUserMessage.trim() !== '') {
        try {
          const queryVector = await this.geminiEmbeddingService.embedOne(lastUserMessage);
          
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

      // 5. Tổng hợp thành compiled_prompt với message history
      const systemPrompt = agent.system_prompt ? `### CHỈ THỊ CỦA AGENT:\n${agent.system_prompt}\n\n` : '';
      const customSkills = agent.custom_skills ? `### KỸ NĂNG TÙY CHỈNH:\n${agent.custom_skills}\n\n` : '';
      
      // Tạo message history context
      let messageHistory = '';
      if (existingMessages.length > 1) {
        messageHistory = '### LỊCH SỬ HỘI THOẠI:\n';
        existingMessages.slice(0, -1).forEach((msg) => {
          const sender = msg.role === 'user' ? 'Người dùng' : 'Assistant';
          messageHistory += `${sender}: ${msg.content}\n\n`;
        });
        messageHistory += '\n';
      }

      const taskReq = `### NHIỆM VỤ CỦA BẠN (TỪ NGƯỜI DÙNG):\n${lastUserMessage || 'Hãy xem tài liệu và xử lý yêu cầu.'}`;

      const compiledPrompt = [
        systemPrompt,
        customSkills,
        skillsContext,
        ragContext,
        messageHistory,
        taskReq
      ].filter(Boolean).join('\n\n');

      // 6. Cập nhật compiled_prompt vào Database để lưu vết
      await this.taskModel.updateOne({ _id: taskIdObj }, { $set: { compiled_prompt: compiledPrompt } });

      // Emit Gateway khi bắt đầu tạo kết quả
      this.tasksGateway.emitTaskStream(workspaceIdStr, taskId, "🤖 Agent đang xử lý yêu cầu...");

      // 7. Gọi API tới AI_Core qua chế độ SSE streaming
      const result = await this.aiCoreService.streamChat(
        compiledPrompt,
        taskDoc.created_by.toString(),
        taskDoc._id.toString(),
        (statusMsg) => {
          this.tasksGateway.emitTaskStream(workspaceIdStr, taskId, statusMsg);
        }
      );

      // 8. Lưu assistant message
      await this.saveMessage(taskIdObj, 'assistant', result);

      // 9. Cập nhật trạng thái thành công
      await this.taskModel.updateOne(
        { _id: taskIdObj },
        { $set: { status: 'completed', result: result } }
      );
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
    
    const task = await this.taskModel.findOne({ _id: toObjectId(taskId), workspace_id: wid }).exec();
    if (!task) {
      throw new NotFoundException('Không tìm thấy task');
    }

    const updateData: any = { ...dto };
    const taskIdObj = task._id;

    // Case 1: Multi-turn chat - user gửi message trên completed task
    if (task.status === 'completed' && dto.description) {
      // Lưu message mới từ user
      await this.saveMessage(taskIdObj, 'user', dto.description);
      
      // Đặt lại thành scheduled để chạy lại
      updateData.status = 'scheduled';
      updateData.result = null;
      updateData.compiled_prompt = null;
      // Không update description, vì description là nội dung task ban đầu
      delete updateData.description;
    }
    // Case 2: Retry on failed task
    else if (task.status === 'in_progress' || task.status === 'scheduled' || task.status === 'failed') {
      try {
        const job = await this.tasksQueue.getJob(taskId);
        if (job) {
          await job.remove();
          this.logger.log(`Đã gỡ Job ${taskId} khỏi hàng đợi để thực hiện lại.`);
        }
      } catch (e) {
        this.logger.warn(`Lỗi khi gỡ Job Redis: ${e}`);
      }

      updateData.status = 'scheduled';
      updateData.result = null;
      updateData.compiled_prompt = null;
    }

    const doc = await this.taskModel
      .findOneAndUpdate(
        { _id: taskIdObj },
        { $set: updateData },
        { new: true },
      )
      .exec();

    // Nếu task quay về scheduled, quăng lại vào queue
    if (doc && doc.status === 'scheduled') {
      await this.tasksQueue.add('process_task', { taskId: doc._id.toString() }, {
        jobId: doc._id.toString(),
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.tasksGateway.emitTaskStatus(workspaceId, taskId, 'scheduled', 'Task đã được đưa lại vào hàng đợi.');
    }

    return doc!.toJSON() as object;
  }

  async remove(
    userId: string,
    taskId: string,
    workspaceId: string,
  ): Promise<string> {
    await this.workspacesService.findOne(userId, workspaceId);
    const wid = toObjectId(workspaceId);

    try {
      const job = await this.tasksQueue.getJob(taskId);
      if (job) {
        await job.remove();
        this.logger.log(`Đã gỡ Job ${taskId} khỏi hàng đợi trước khi xóa Task.`);
      }
    } catch (e) {
      this.logger.warn(`Không thể xóa Job trong Redis cho task ${taskId}: ${e}`);
    }

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
