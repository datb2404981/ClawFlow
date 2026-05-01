import { HydratedDocument, Types } from "mongoose";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { User } from "src/module/accounts/schema/user.schema";
import { Workspace } from "src/module/accounts/schema/workspace.schema";
import { SkillTemplate } from "./skill-template.schema";

@Schema({ timestamps: true })
export class Agents {
  @Prop({
    type: Types.ObjectId,
    ref: Workspace.name,
    required: true,
    index: true
  })
  workspace_id!: Types.ObjectId;

  @Prop()
  name!: string;

  @Prop()
  description!: string;

  @Prop()
  system_prompt!: string;
  
  @Prop()
  built_in_tools!: string[];

  @Prop()
  custom_skills!: string;

  /**
   * Skill theo thư viện template: chỉ tham chiếu id; bật/tắt = sửa mảng này.
   */
  @Prop({
    type: [{ type: Types.ObjectId, ref: SkillTemplate.name }],
    default: [],
  })
  enabled_skill_template_ids!: Types.ObjectId[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type AgentsDocument = HydratedDocument<Agents>;
export const AgentsSchema = SchemaFactory.createForClass(Agents);

export const TASK_STATUS_VALUES = [
  'pending',
  'scheduled',
  'in_progress',
  'waiting_approval',
  'draft_ready',
  'waiting_human_input',
  'waiting_execute_approval',
  'rejected',
  'completed',
  'failed',
] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

@Schema({ _id: false })
export class TaskMessage {
  @Prop({ type: String, enum: ['user', 'assistant'], required: true })
  role!: 'user' | 'assistant';

  @Prop({ type: String, required: true })
  content!: string;

  /** Các bước xử lý (Gemini-like steps) */
  @Prop({ type: [String], default: [] })
  steps?: string[];

  @Prop({ type: Date, default: () => new Date() })
  createdAt?: Date;
}

export const TaskMessageSchema = SchemaFactory.createForClass(TaskMessage);

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({
    type: Types.ObjectId,
    ref: Workspace.name,
    required: true,
    index: true,
  })
  workspace_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Agents.name, required: true, index: true })
  agent_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  created_by!: Types.ObjectId;

  @Prop()
  title!: string;

  @Prop()
  description!: string;

  @Prop({
    type: String,
    enum: TASK_STATUS_VALUES,
    default: 'scheduled',
    index: true,
  })
  status!: TaskStatus;

  /** Luồng hội thoại AI_Core; mặc định = task _id khi tạo nếu client không gửi. */
  @Prop({ index: true, sparse: true })
  thread_id?: string;

  /** Lịch sử hội thoại đa lượt (user / assistant). */
  @Prop({ type: [TaskMessageSchema], default: [] })
  messages?: TaskMessage[];

  /** Lưu toàn bộ ngữ cảnh đã được nhúng vào (Skill + RAG + Prompt) để gửi cho AI */
  @Prop()
  compiled_prompt?: string;

  /**
   * Draft/human loop: backend lưu action-plan contract (JSON stringify)
   * parse từ marker `<!--CF_ACTION_PLAN_START-->...<!--CF_ACTION_PLAN_END-->` do AI_Core xuất.
   */
  @Prop({ type: String, default: null })
  draft_payload?: string | null;

  /**
   * Scheduler gate: nếu bật thì create() không enqueue chạy ngay,
   * chỉ scheduler mới enqueue khi tới thời điểm.
   */
  @Prop({ type: Boolean, default: false, index: true })
  schedule_enabled?: boolean;

  /** Cron/ruledsl (chuỗi) do FE/backend thống nhất; scheduler worker tự parse. */
  @Prop({ type: String, default: null })
  schedule_cron?: string | null;

  /** Hỗ trợ lần chạy đầu tiên “chờ đúng thời điểm”. */
  @Prop({ type: Date, default: null })
  next_run_at?: Date | null;

  /** Lý do reject (nếu có). */
  @Prop({ type: String, default: null })
  reject_reason?: string | null;

  /** Idempotency để tránh gửi mail / tạo event trùng. */
  @Prop({ type: String, default: null })
  last_execution_idempotency_key?: string | null;

  /** Audit log cho connector execution (stringify JSON). */
  @Prop({ type: String, default: null })
  execution_log?: string | null;

  /** Thời điểm execute thật (hoặc tạm MVP). */
  @Prop({ type: Date, default: null })
  executed_at?: Date | null;

  /** Lưu kết quả phản hồi của AI */
  @Prop()
  result?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type TaskDocument = HydratedDocument<Task>;
export const TaskSchema = SchemaFactory.createForClass(Task);