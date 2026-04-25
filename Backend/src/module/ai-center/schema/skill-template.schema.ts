import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'skill_templates' })
export class SkillTemplate {
  /**
   * Mẫu hệ thống: toàn instance dùng được, `workspace_id` / `created_by` có thể null.
   * Mẫu user: luôn `false`, có `workspace_id` + `created_by` (tạo qua API user).
   */
  @Prop({ type: Boolean, default: false, index: true })
  is_system: boolean;

  @Prop({ required: true })
  name: string;

  /**
   * Mô tả ngắn cho UI (đặc biệt mẫu hệ thống). Nội dung đầy đủ vẫn ở `content`.
   */
  @Prop({ type: String, default: null })
  description: string | null;

  /** Nội dung do FE gửi (đã cào URL/file ở client nếu cần). */
  @Prop({ required: true })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', default: null, index: true })
  workspace_id: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  created_by: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: ['private', 'workspace'],
    default: 'private',
    index: true,
  })
  visibility: 'private' | 'workspace';

  /** Tùy chọn: URL nguồn công bố; nội dung chính vẫn ở `content` (gửi từ FE). */
  @Prop()
  source_url?: string;

  /**
   * Khóa icon gọn cho UI (lucide map trên FE): `doc` | `canvas` | `browser` | `scan`.
   * Mẫu hệ thống/seed: thường có; mẫu user có thể bỏ.
   */
  @Prop({ type: String, default: null })
  icon: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export type SkillTemplateDocument = HydratedDocument<SkillTemplate>;
export const SkillTemplateSchema = SchemaFactory.createForClass(SkillTemplate);

SkillTemplateSchema.index(
  { workspace_id: 1, name: 1, created_by: 1 },
  { sparse: true },
);
SkillTemplateSchema.index({ is_system: 1, name: 1 });
