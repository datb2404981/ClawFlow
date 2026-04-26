import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Workspace } from './workspace.schema';

@Schema({ timestamps: true, collection: 'workspace_knowledge_files' })
export class WorkspaceKnowledgeFile {
  @Prop({ type: Types.ObjectId, ref: Workspace.name, required: true, index: true })
  workspace_id: Types.ObjectId;

  @Prop({ required: true })
  original_name: string;

  /** Tên file trên đĩa (unique trong thư mục workspace) */
  @Prop({ required: true })
  stored_filename: string;

  @Prop({ required: true })
  size_bytes: number;

  @Prop()
  mime_type?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceKnowledgeFileDocument =
  HydratedDocument<WorkspaceKnowledgeFile>;
export const WorkspaceKnowledgeFileSchema = SchemaFactory.createForClass(
  WorkspaceKnowledgeFile,
);
