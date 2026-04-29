import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

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

  @Prop({
    required: true,
    enum: ['processing', 'vectorized', 'failed'],
    default: 'processing',
  })
  status: 'processing' | 'vectorized' | 'failed';

  @Prop({ required: true })
  vector_collection_id: string;

  createdAt: Date;
  updatedAt: Date;
}

export const WorkspaceDocumentSchema =
  SchemaFactory.createForClass(WorkspaceDocument);
export type WorkspaceDocumentDocument = HydratedDocument<WorkspaceDocument>;

/**
 * Chunk knowledge cho vector search. Collection mặc định: `knowledge_chunks`.
 * Atlas: index $vectorSearch trên `embedding`, numDimensions **768** (mặc định Gemini `text-embedding-004`).
 * Dữ liệu cũ 384 (MiniLM) cần xoá chunk / tạo index mới / ingest lại.
 */
@Schema({ timestamps: true, collection: 'knowledge_chunks' })
export class KnowledgeChunk {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspace_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'WorkspaceKnowledgeFile',
    required: true,
    index: true,
  })
  knowledge_file_id: Types.ObjectId;

  @Prop({ required: true })
  chunk_index: number;

  @Prop({ required: true })
  chunk_text: string;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  createdAt: Date;
  updatedAt: Date;
}
export const KnowledgeChunkSchema = SchemaFactory.createForClass(KnowledgeChunk);

/** Full-text (MongoDB `$text`) bổ sung cho vector RAG — `default_language: none` hợp tiếng Việt hơn stem English. */
KnowledgeChunkSchema.index(
  { chunk_text: 'text' },
  {
    name: 'knowledge_chunks_chunk_text_text',
    default_language: 'none',
  },
);
export type KnowledgeChunkDocument = HydratedDocument<KnowledgeChunk>;
