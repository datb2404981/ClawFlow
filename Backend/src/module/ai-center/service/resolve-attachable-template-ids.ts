import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { toObjectId } from 'src/common/util/object-id.util';
import type { SkillTemplateDocument } from '../schema/skill-template.schema';

type LeanTemplate = {
  _id: Types.ObjectId;
  is_system?: boolean;
  visibility?: 'private' | 'workspace';
  created_by?: Types.ObjectId | null;
  workspace_id?: Types.ObjectId | null;
} | null;

/**
 * Logic gắn template lên agent:
 * - Mẫu hệ thống (`is_system: true`) — mọi user/workspace được gắn.
 * - Mẫu user — cùng `workspace_id` với agent; private → chỉ creator.
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
    const tpl: LeanTemplate = (await templateModel
      .findOne({
        _id: tid,
        $or: [
          { is_system: true },
          { workspace_id: agentWorkspaceId },
        ],
      })
      .lean()
      .exec()) as LeanTemplate;
    if (!tpl) {
      throw new BadRequestException(
        `Template ${rawId} không tồn tại, không cùng workspace với trợ lý, hoặc không tìm thấy`,
      );
    }
    if (tpl.is_system === true) {
      result.push(tid);
      continue;
    }
    if (
      tpl.visibility === 'private' &&
      tpl.created_by != null &&
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
