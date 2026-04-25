import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { Workspace, WorkspaceDocument } from '../schema/workspace.schema';
import { CreateWorkspacesDto } from '../dto/create-workspaces.dto';
import { UpdateWorkspacesDto } from '../dto/update-workspaces.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name) private workspaceModel: Model<WorkspaceDocument>,
  ) {}

  private toObjectId(id: string): Types.ObjectId {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('id workspace không hợp lệ');
    }
    return new Types.ObjectId(id);
  }

  private normalizeLanes(
    lanes: { key: string; title: string; order?: number }[] | undefined,
  ): { key: string; title: string; order: number }[] | undefined {
    if (lanes === undefined) return undefined;
    return lanes.map((lane, i) => ({
      key: lane.key,
      title: lane.title,
      order: lane.order ?? i,
    }));
  }

  private async clearDefaultForUser(
    userId: Types.ObjectId,
    exceptWorkspaceId?: Types.ObjectId,
  ) {
    const q: { user_id: Types.ObjectId; is_default: boolean; _id?: { $ne: Types.ObjectId } } = {
      user_id: userId,
      is_default: true,
    };
    if (exceptWorkspaceId) {
      q._id = { $ne: exceptWorkspaceId };
    }
    await this.workspaceModel.updateMany(q, { $set: { is_default: false } });
  }

  /**
   * Mỗi user một workspace: tạo bản mặc định nếu chưa có (dùng khi liệt kê lần đầu / user cũ).
   */
  private async ensureDefaultWorkspaceForUser(userId: string): Promise<void> {
    const owner = this.toObjectId(userId);
    const n = await this.workspaceModel.countDocuments({ user_id: owner });
    if (n > 0) {
      return;
    }
    await this.workspaceModel.create({
      user_id: owner,
      name: 'Workspace',
      is_default: true,
    });
  }

  async create(
    userId: string,
    dto: CreateWorkspacesDto,
  ): Promise<Workspace> {
    const owner = this.toObjectId(userId);
    const existing = await this.workspaceModel.countDocuments({ user_id: owner });
    if (existing >= 1) {
      throw new ConflictException('Mỗi tài khoản chỉ có một workspace');
    }
    if (dto.is_default) {
      await this.clearDefaultForUser(owner);
    }
    const task_lanes = this.normalizeLanes(dto.task_lanes);
    const createPayload: Record<string, unknown> = {
      user_id: owner,
      name: dto.name,
      is_default: dto.is_default ?? false,
    };
    if (dto.description !== undefined) createPayload.description = dto.description;
    if (dto.slug !== undefined) createPayload.slug = dto.slug;
    if (dto.memory_enabled !== undefined) createPayload.memory_enabled = dto.memory_enabled;
    if (dto.memory_scope !== undefined) createPayload.memory_scope = dto.memory_scope;
    if (task_lanes !== undefined) createPayload.task_lanes = task_lanes;
    try {
      const doc = await this.workspaceModel.create(createPayload);
      return doc.toJSON() as unknown as Workspace;
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new ConflictException('Slug workspace đã tồn tại (trong tài khoản của bạn).');
      }
      throw e;
    }
  }

  async findAllByUser(userId: string): Promise<Workspace[]> {
    await this.ensureDefaultWorkspaceForUser(userId);
    const owner = this.toObjectId(userId);
    return this.workspaceModel
      .find({ user_id: owner })
      .sort({ is_default: -1, updatedAt: -1 })
      .lean()
      .exec() as Promise<Workspace[]>;
  }

  async findOne(userId: string, workspaceId: string): Promise<Workspace> {
    const owner = this.toObjectId(userId);
    const id = this.toObjectId(workspaceId);
    const w = await this.workspaceModel
      .findOne({ _id: id, user_id: owner })
      .lean()
      .exec();
    if (!w) {
      throw new NotFoundException('Không tìm thấy workspace');
    }
    return w as unknown as Workspace;
  }

  async update(
    userId: string,
    workspaceId: string,
    dto: UpdateWorkspacesDto,
  ): Promise<Workspace> {
    const owner = this.toObjectId(userId);
    const id = this.toObjectId(workspaceId);
    if (dto.is_default === true) {
      await this.clearDefaultForUser(owner, id);
    }
    const task_lanes = this.normalizeLanes(dto.task_lanes);
    const $set: Record<string, unknown> = {};
    if (dto.name !== undefined) $set.name = dto.name;
    if (dto.description !== undefined) $set.description = dto.description;
    if (dto.slug !== undefined) $set.slug = dto.slug;
    if (dto.is_default !== undefined) $set.is_default = dto.is_default;
    if (dto.memory_enabled !== undefined) $set.memory_enabled = dto.memory_enabled;
    if (dto.memory_scope !== undefined) $set.memory_scope = dto.memory_scope;
    if (task_lanes !== undefined) $set.task_lanes = task_lanes;
    if (dto.status !== undefined) $set.status = dto.status;
    if (Object.keys($set).length === 0) {
      return this.findOne(userId, workspaceId);
    }
    try {
      const doc = await this.workspaceModel
        .findOneAndUpdate(
          { _id: id, user_id: owner },
          { $set },
          { new: true, runValidators: true },
        )
        .lean()
        .exec();
      if (!doc) {
        throw new NotFoundException('Không tìm thấy workspace');
      }
      return doc as unknown as Workspace;
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new ConflictException('Slug workspace đã tồn tại (trong tài khoản của bạn).');
      }
      throw e;
    }
  }

  remove(userId: string, workspaceId: string): never {
    this.toObjectId(userId);
    this.toObjectId(workspaceId);
    throw new BadRequestException(
      'Mỗi tài khoản chỉ có một workspace, không hỗ trợ xóa.',
    );
  }
}
