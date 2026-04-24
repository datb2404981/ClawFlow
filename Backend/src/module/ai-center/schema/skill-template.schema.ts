import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'skill_templates' })
export class SkillTemplate {
  @Prop({ required: true })
  name: string;

  /** Nội dung do FE gửi (đã cào URL/file ở client nếu cần). */
  @Prop({ required: true })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspace_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  created_by: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['private', 'workspace'],
    default: 'private',
    index: true,
  })
  visibility: 'private' | 'workspace';

  createdAt: Date;
  updatedAt: Date;
}

export type SkillTemplateDocument = HydratedDocument<SkillTemplate>;
export const SkillTemplateSchema = SchemaFactory.createForClass(SkillTemplate);

SkillTemplateSchema.index({ workspace_id: 1, name: 1, created_by: 1 });
