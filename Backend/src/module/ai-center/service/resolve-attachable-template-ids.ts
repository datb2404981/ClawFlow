import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { toObjectId } from 'src/common/util/object-id.util';
import type { SkillTemplateDocument } from '../schema/skill-template.schema';

/**
 * Logic gắn template lên agent (cùng workspace, private → chỉ creator).
 * Tách file để AgentsService không import SkillTemplatesService (tránh kiểu `error` / no-unsafe-call trên một số cấu hình ESLint).
 */
export async function resolveAttachableTemplateIds(
  templateModel: Model<SkillTemplateDocument>,
  userId: string,
  agentWorkspaceId: Types.ObjectId,
  templateIdStrings: string[] | undefined,
): Promise<Types.ObjectId[]> {
  if (!templateIdStrings?.length) {
    return [];
  }
  const unique = [...new Set(templateIdStrings)];
  const uid = toObjectId(userId);
  const result: Types.ObjectId[] = [];
  for (const rawId of unique) {
    const tid = toObjectId(rawId);
    const tpl = await templateModel
      .findOne({ _id: tid, workspace_id: agentWorkspaceId })
      .lean()
      .exec();
    if (!tpl) {
      throw new BadRequestException(
        `Template ${rawId} không tồn tại hoặc không cùng workspace với trợ lý`,
      );
    }
    if (
      tpl.visibility === 'private' &&
      String(tpl.created_by) !== String(uid)
    ) {
      throw new ForbiddenException(
        `Bạn không được phép dùng template (riêng tư) ${rawId}`,
      );
    }
    result.push(tid);
  }
  return result;
}
