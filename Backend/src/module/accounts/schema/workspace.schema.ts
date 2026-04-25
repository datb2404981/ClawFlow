import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from './user.schema';

/** Một trong 3 “chỗ” task (tên hiển thị đổi được; `key` dùng trong code/API) */
@Schema({ _id: false })
export class TaskLane {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 0 })
  order: number;
}

@Schema({ timestamps: true, collection: 'workspaces' })
export class Workspace {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  /** Dùng cho URL / filter; unique trong phạm vi user (khi đã set) */
  @Prop()
  slug?: string;

  @Prop({
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
    index: true,
  })
  status: 'active' | 'archived';

  /** Mặc định: mỗi user đúng một workspace (vẫn dùng cờ này khi cần sort/UX) */
  @Prop({ default: false, index: true })
  is_default: boolean;

  @Prop({ type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' })
  plan: 'free' | 'pro' | 'enterprise';

  /** Hạn mức token trong kỳ (theo `plan` hoặc billing) */
  @Prop({ default: 1000 })
  token_limit: number;

  /** Đã tiêu thụ trong kỳ hiện tại (reset theo `last_usage_reset` nếu bạn cài cron) */
  @Prop({ default: 0 })
  tokens_used: number;

  @Prop({ type: Date })
  last_usage_reset?: Date;

  @Prop({
    type: [TaskLane],
    default: () => [
      { key: 'slot_1', title: 'Công việc 1', order: 0 },
      { key: 'slot_2', title: 'Công việc 2', order: 1 },
      { key: 'slot_3', title: 'Công việc 3', order: 2 },
    ],
  })
  task_lanes: TaskLane[];

  /** Ref tới collection cấu hình agent (tạo `AgentConfig` schema sau; tạm ref bằng tên) */
  @Prop({ type: Types.ObjectId, ref: 'AgentConfig' })
  agent_config_id?: Types.ObjectId;

  @Prop({ default: true })
  memory_enabled: boolean;

  @Prop({ type: String, enum: ['user', 'workspace'], default: 'workspace' })
  memory_scope: 'user' | 'workspace';

  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceDocument = HydratedDocument<Workspace>;
export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);

/** Mỗi cặp (user, slug) chỉ một workspace khi `slug` được set (index sparse bỏ qua doc không có slug) */
WorkspaceSchema.index({ user_id: 1, slug: 1 }, { unique: true, sparse: true });
