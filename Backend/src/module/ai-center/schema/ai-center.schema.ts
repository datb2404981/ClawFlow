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
  workspace_id: Types.ObjectId;

  @Prop()
  name: string;

  @Prop()
  description: string;

  @Prop()
  system_prompt: string;
  
  @Prop()
  built_in_tools: string[];

  @Prop()
  custom_skills: string;

  /**
   * Skill theo thư viện template: chỉ tham chiếu id; bật/tắt = sửa mảng này.
   */
  @Prop({
    type: [{ type: Types.ObjectId, ref: SkillTemplate.name }],
    default: [],
  })
  enabled_skill_template_ids: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

export type AgentsDocument = HydratedDocument<Agents>;
export const AgentsSchema = SchemaFactory.createForClass(Agents);

export const TASK_STATUS_VALUES = [
  'scheduled',
  'in_progress',
  'waiting_approval',
  'completed',
  'failed',
] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({
    type: Types.ObjectId,
    ref: Workspace.name,
    required: true,
    index: true,
  })
  workspace_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Agents.name, required: true, index: true })
  agent_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  created_by: Types.ObjectId;

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop({
    type: String,
    enum: TASK_STATUS_VALUES,
    default: 'scheduled',
    index: true,
  })
  status: TaskStatus;

  /** Luồng hội thoại AI_Core; có thể cập nhật sau (callback tùy tương lai). */
  @Prop({ index: true, sparse: true })
  thread_id?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type TaskDocument = HydratedDocument<Task>;
export const TaskSchema = SchemaFactory.createForClass(Task);