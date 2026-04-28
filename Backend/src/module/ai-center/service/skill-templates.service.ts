import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspacesService } from 'src/module/accounts/service/workspaces.service';
import { toObjectId } from 'src/common/util/object-id.util';
import { CreateSkillTemplateDto } from '../dto/create-skill-template.dto';
import { AdminSeedSkillTemplateDto } from '../dto/admin-seed-skill-template.dto';
import { UpdateSkillTemplateDto } from '../dto/update-skill-template.dto';
import {
  SkillTemplate,
  SkillTemplateDocument,
} from '../schema/skill-template.schema';
import { resolveAttachableTemplateIds as resolveAttachableTemplateIdsCore } from './resolve-attachable-template-ids';

@Injectable()
export class SkillTemplatesService {
  constructor(
    @InjectModel(SkillTemplate.name)
    private templateModel: Model<SkillTemplateDocument>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private requireContent(text: string | undefined | null): string {
    const s = text?.trim() ?? '';
    if (!s) {
      throw new BadRequestException('Cần `content` (nội dung không được để trống)');
    }
    return s;
  }

  /** Đảm bảo workspace thuộc user, trả về (workspaceOid, userOid). */
  private async assertWorkspace(userId: string, workspaceId: string) {
    await this.workspacesService.findOne(userId, workspaceId);
    return {
      wid: toObjectId(workspaceId),
      uid: toObjectId(userId),
    };
  }

  /** Mẫu do user tạo trong workspace: xem được nếu là chủ sở hữu hoặc template workspace. */
  private readPermFilter(wid: Types.ObjectId, uid: Types.ObjectId) {
    return {
      is_system: { $ne: true },
      workspace_id: wid,
      $or: [{ created_by: uid }, { visibility: 'workspace' as const }],
    };
  }

  /** Danh sách: mẫu hệ thống + mẫu user đọc được theo `readPermFilter`. */
  private listFilterForUser(wid: Types.ObjectId, uid: Types.ObjectId) {
    return {
      $or: [
        { is_system: true },
        this.readPermFilter(wid, uid) as Record<string, unknown>,
      ],
    };
  }

  private assertNotSystem(
    action: 'sửa' | 'xóa',
    doc: { is_system?: boolean } | null,
  ): void {
    if (doc && doc.is_system === true) {
      throw new ForbiddenException(
        `Mẫu hệ thống — không ${action} qua API này (chỉ seed / quản trị)`,
      );
    }
  }

  /** Mongoose `toJSON()` kiểu hay bị suy `any` với @typescript-eslint — gói kiểu gọi rõ ràng. */
  private templateDocToObject(doc: SkillTemplateDocument): object {
    const withJson: { toJSON: () => object } = doc as unknown as {
      toJSON: () => object;
    };
    return withJson.toJSON();
  }

  /**
   * Khi gắn template lên agent: cùng workspace, template private → chỉ creator.
   * Trả mảng ObjectId (bỏ trùng) hoặc [] nếu không gửi.
   */
  async resolveAttachableTemplateIds(
    userId: string,
    agentWorkspaceId: Types.ObjectId,
    templateIdStrings: string[] | undefined,
  ): Promise<Types.ObjectId[]> {
    return resolveAttachableTemplateIdsCore(
      this.templateModel,
      userId,
      agentWorkspaceId,
      templateIdStrings,
    );
  }

  async create(
    userId: string,
    dto: CreateSkillTemplateDto,
  ): Promise<object> {
    const { workspace_id, name, content, visibility, source_url, icon, description } =
      dto;
    const { wid, uid } = await this.assertWorkspace(userId, workspace_id);
    const body = this.requireContent(content);
    const su =
      typeof source_url === 'string' ? source_url.trim() : '';
    const extra: { source_url?: string } = su ? { source_url: su } : {};
    const desc =
      typeof description === 'string' && description.trim()
        ? description.trim()
        : null;
    const doc = await this.templateModel.create({
      is_system: false,
      name,
      description: desc,
      content: body,
      workspace_id: wid,
      created_by: uid,
      visibility,
      icon: icon ?? null,
      ...extra,
    });
    return this.templateDocToObject(doc);
  }

  /**
   * Tạo template qua API admin/seed: `is_system: true` → workspace_id/created_by null;
   * `is_system: false` → cần `workspace_id` + `created_by` (ObjectId hợp lệ).
   */
  async adminSeedCreate(dto: AdminSeedSkillTemplateDto): Promise<object> {
    const body = this.requireContent(dto.content);
    const name = dto.name.trim();
    const visibility = dto.visibility ?? 'workspace';
    const desc =
      typeof dto.description === 'string' && dto.description.trim()
        ? dto.description.trim()
        : null;
    const seedSu =
      typeof dto.source_url === 'string' ? dto.source_url.trim() : '';
    const source: { source_url?: string } = seedSu
      ? { source_url: seedSu }
      : {};

    if (dto.is_system === true) {
      const doc = await this.templateModel.create({
        is_system: true,
        name,
        description: desc,
        content: body,
        workspace_id: null,
        created_by: null,
        visibility,
        icon: dto.icon ?? null,
        ...source,
      });
      return this.templateDocToObject(doc);
    }

    if (!dto.workspace_id || !dto.created_by) {
      throw new BadRequestException(
        'Khi is_system: false, bắt buộc `workspace_id` và `created_by` (ObjectId hợp lệ).',
      );
    }
    const doc = await this.templateModel.create({
      is_system: false,
      name,
      description: desc,
      content: body,
      workspace_id: toObjectId(dto.workspace_id),
      created_by: toObjectId(dto.created_by),
      visibility,
      icon: dto.icon ?? null,
      ...source,
    });
    return this.templateDocToObject(doc);
  }

  /** Trả toàn bộ template hệ thống (is_system: true) — dùng cho admin/seed kiểm tra. */
  async adminSeedFindSystem(): Promise<object[]> {
    const rows = await this.templateModel
      .find({ is_system: true })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as object[];
  }

  async findAllByWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<object[]> {
    const { wid, uid } = await this.assertWorkspace(userId, workspaceId);
    const rows = await this.templateModel
      .find(this.listFilterForUser(wid, uid))
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    return rows as object[];
  }

  async findOne(
    userId: string,
    workspaceId: string,
    templateId: string,
  ): Promise<object> {
    const { wid, uid } = await this.assertWorkspace(userId, workspaceId);
    const doc = await this.templateModel
      .findOne({
        _id: toObjectId(templateId),
        ...this.listFilterForUser(wid, uid),
      })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('Không tìm thấy skill template');
    }
    return doc as object;
  }

  async update(
    userId: string,
    workspaceId: string,
    templateId: string,
    dto: UpdateSkillTemplateDto,
  ): Promise<object> {
    const { wid, uid } = await this.assertWorkspace(userId, workspaceId);
    const existing = await this.templateModel
      .findById(toObjectId(templateId))
      .exec();
    if (!existing) {
      throw new NotFoundException('Không tìm thấy skill template');
    }
    this.assertNotSystem('sửa', existing);
    const doc = await this.templateModel.findOne({
      _id: toObjectId(templateId),
      workspace_id: wid,
      created_by: uid,
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy hoặc không có quyền sửa');
    }
    this.requireContent(
      dto.content !== undefined ? dto.content : doc.content,
    );
    const $set: Record<string, unknown> = { ...dto };
    if (dto.content !== undefined) {
      $set.content = this.requireContent(dto.content);
    }
    if (dto.description !== undefined) {
      const d = dto.description?.trim();
      $set.description = d ? d : null;
    }
    const next = await this.templateModel
      .findByIdAndUpdate(doc._id, { $set }, { returnDocument: 'after' })
      .exec();
    if (!next) {
      throw new NotFoundException('Không tìm thấy skill template');
    }
    return this.templateDocToObject(next);
  }

  async remove(
    userId: string,
    workspaceId: string,
    templateId: string,
  ){
    const { wid, uid } = await this.assertWorkspace(userId, workspaceId);
    const existing = await this.templateModel
      .findById(toObjectId(templateId))
      .exec();
    if (!existing) {
      throw new NotFoundException('Không tìm thấy skill template');
    }
    this.assertNotSystem('xóa', existing);
    const res = await this.templateModel.deleteOne({
      _id: toObjectId(templateId),
      workspace_id: wid,
      created_by: uid,
    });
    if (res.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy hoặc không có quyền xóa');
    }
    return "OK";
  }
}
