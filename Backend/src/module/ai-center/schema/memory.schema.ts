import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

const MEMORY_SCOPE_VALUES = ['thread', 'workspace', 'user'] as const;
const MEMORY_EVENT_TYPE_VALUES = [
  'task_completed',
  'task_failed',
  'user_message',
  'assistant_message',
  'decision',
] as const;

export type MemoryScope = (typeof MEMORY_SCOPE_VALUES)[number];
export type MemoryEventType = (typeof MEMORY_EVENT_TYPE_VALUES)[number];

@Schema({ timestamps: true, collection: 'memory_events' })
export class MemoryEvent {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspace_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ required: true, index: true })
  thread_id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  task_id!: Types.ObjectId;

  @Prop({ type: String, enum: MEMORY_EVENT_TYPE_VALUES, required: true, index: true })
  event_type!: MemoryEventType;

  @Prop({ required: true })
  content!: string;

  @Prop({ default: 'system' })
  source!: string;

  @Prop({ min: 0, max: 1, default: 0.5, index: true })
  importance!: number;

  @Prop({ type: Date, required: true, index: true })
  created_at!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MemoryEventDocument = HydratedDocument<MemoryEvent>;
export const MemoryEventSchema = SchemaFactory.createForClass(MemoryEvent);
MemoryEventSchema.index({ workspace_id: 1, thread_id: 1, created_at: -1 });
MemoryEventSchema.index({ user_id: 1, created_at: -1 });

@Schema({ timestamps: true, collection: 'memory_summaries' })
export class MemorySummary {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspace_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ required: true, index: true })
  thread_id!: string;

  @Prop({ type: String, enum: MEMORY_SCOPE_VALUES, required: true, index: true })
  scope!: MemoryScope;

  @Prop({ required: true })
  summary_text!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Date, required: true, index: true })
  last_event_at!: Date;

  @Prop({ min: 0, max: 1, default: 0.5, index: true })
  confidence!: number;

  @Prop({ default: 'summarizer_v1' })
  source!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MemorySummaryDocument = HydratedDocument<MemorySummary>;
export const MemorySummarySchema = SchemaFactory.createForClass(MemorySummary);
MemorySummarySchema.index(
  { workspace_id: 1, user_id: 1, thread_id: 1, scope: 1 },
  { unique: true },
);
MemorySummarySchema.index({ workspace_id: 1, scope: 1, last_event_at: -1 });

@Schema({ timestamps: true, collection: 'memory_facts' })
export class MemoryFact {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspace_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ required: true, index: true })
  thread_id!: string;

  @Prop({ required: true, index: true })
  key!: string;

  @Prop({ required: true })
  value!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ min: 0, max: 1, default: 0.5, index: true })
  confidence!: number;

  @Prop({ type: Date, required: true, index: true })
  updated_at!: Date;

  @Prop({ required: true, index: true })
  source_event_id!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MemoryFactDocument = HydratedDocument<MemoryFact>;
export const MemoryFactSchema = SchemaFactory.createForClass(MemoryFact);
MemoryFactSchema.index(
  { workspace_id: 1, user_id: 1, thread_id: 1, key: 1 },
  { unique: true },
);
MemoryFactSchema.index({ workspace_id: 1, tags: 1, updated_at: -1 });
