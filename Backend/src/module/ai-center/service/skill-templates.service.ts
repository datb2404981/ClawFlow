import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspacesService } from 'src/module/accounts/service/workspaces.service';
import { toObjectId } from 'src/common/util/object-id.util';
import { CreateSkillTemplateDto } from '../dto/create-skill-template.dto';
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

  /** Filter cơ sở: trong workspace + (creator hoặc visibility=workspace). */
  private readPermFilter(wid: Types.ObjectId, uid: Types.ObjectId) {
    return {
      workspace_id: wid,
      $or: [{ created_by: uid }, { visibility: 'workspace' as const }],
    };
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
    const { workspace_id, name, content, visibility } = dto;
    const { wid, uid } = await this.assertWorkspace(userId, workspace_id);
    const body = this.requireContent(content);
    const doc = await this.templateModel.create({
      name,
      content: body,
      workspace_id: wid,
      created_by: uid,
      visibility,
    });
    return doc.toJSON() as object;
  }

  async findAllByWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<object[]> {
    const { wid, uid } = await this.assertWorkspace(userId, workspaceId);
    const rows = await this.templateModel
      .find(this.readPermFilter(wid, uid))
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
      .findOne({ ...this.readPermFilter(wid, uid), _id: toObjectId(templateId) })
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
    const next = await this.templateModel
      .findByIdAndUpdate(doc._id, { $set }, { new: true })
      .exec();
    return next!.toJSON() as object;
  }

  async remove(
    userId: string,
    workspaceId: string,
    templateId: string,
  ){
    const { wid, uid } = await this.assertWorkspace(userId, workspaceId);
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
