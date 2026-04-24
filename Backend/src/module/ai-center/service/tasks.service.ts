import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { toObjectId } from 'src/common/util/object-id.util';
import { WorkspacesService } from 'src/module/accounts/service/workspaces.service';
import { Agents, AgentsDocument, Task, TaskDocument } from '../schema/ai-center.schema';
import { CreateTaskDto } from '../dto/create-task.dto';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Agents.name) private agentsModel: Model<AgentsDocument>,
    private readonly workspacesService: WorkspacesService,
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
    return doc.toJSON() as object;
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
        { new: true },
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
