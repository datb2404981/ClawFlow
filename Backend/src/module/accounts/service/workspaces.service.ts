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

  /** Slug URL — tự sinh từ tên, không lấy từ client. */
  private slugifyName(raw: string): string {
    const t = raw
      .trim()
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return t || 'workspace';
  }

  private async ensureUniqueSlugForUser(
    userId: Types.ObjectId,
    base: string,
    exceptWorkspaceId?: Types.ObjectId,
  ): Promise<string> {
    const maxLen = 80;
    const root = (base || 'workspace').toLowerCase().slice(0, maxLen);
    for (let n = 0; n < 200; n++) {
      const trySlug = (n === 0 ? root : `${root}-${n}`).slice(0, maxLen);
      const q = {
        user_id: userId,
        slug: trySlug,
      };
      if (exceptWorkspaceId) {
        const conflict = await this.workspaceModel
          .findOne({ ...q, _id: { $ne: exceptWorkspaceId } })
          .lean()
          .exec();
        if (!conflict) return trySlug;
      } else {
        const conflict = await this.workspaceModel.findOne(q).lean().exec();
        if (!conflict) return trySlug;
      }
    }
    return `${root}-${Date.now()}`.slice(0, maxLen);
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
    const baseSlug = this.slugifyName(dto.name);
    createPayload.slug = await this.ensureUniqueSlugForUser(owner, baseSlug);
    if (task_lanes !== undefined) createPayload.task_lanes = task_lanes;
    if (dto.brand_color !== undefined) createPayload.brand_color = dto.brand_color;
    if (dto.logo_url !== undefined) createPayload.logo_url = dto.logo_url;
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
    if (dto.name !== undefined) {
      $set.name = dto.name;
      const base = this.slugifyName(dto.name);
      $set.slug = await this.ensureUniqueSlugForUser(owner, base, id);
    }
    if (dto.description !== undefined) $set.description = dto.description;
    if (dto.is_default !== undefined) $set.is_default = dto.is_default;
    if (task_lanes !== undefined) $set.task_lanes = task_lanes;
    if (dto.status !== undefined) $set.status = dto.status;
    if (dto.brand_color !== undefined) $set.brand_color = dto.brand_color;
    if (dto.logo_url !== undefined) $set.logo_url = dto.logo_url;
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
