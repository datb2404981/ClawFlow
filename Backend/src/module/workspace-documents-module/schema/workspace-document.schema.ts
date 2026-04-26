import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class WorkspaceDocument {
    @Prop({ required: true })
    workspace_id: string;

    @Prop({ required: true })
    document_id: string;
  
    @Prop({ required: true })
    document_type: string;

    @Prop({ required: true })
    document_size: number;

    @Prop({ required: true })
    document_name: string;
    
    @Prop({ required: true, enum: ['processing', 'vectorized', 'failed'], default: 'processing' })
    status: 'processing' | 'vectorized' | 'failed';
  
    @Prop({ required: true })
    vector_collection_id: string;
  
    createdAt: Date;
    updatedAt: Date;
}

export const WorkspaceDocumentSchema = SchemaFactory.createForClass(WorkspaceDocument);
export type WorkspaceDocumentDocument = HydratedDocument<WorkspaceDocument>;

@Schema({ timestamps: true })
export class KnowledgeChunk{
  @Prop({ required: true })
  workspace_document_id: string;

  @Prop({ required: true })
  chunk_text: string;

  @Prop({ required: true })
  embedding: number[];

  createdAt: Date;
  updatedAt: Date;
}
export const KnowledgeChunkSchema = SchemaFactory.createForClass(KnowledgeChunk);
export type KnowledgeChunkDocument = HydratedDocument<KnowledgeChunk>;