import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import {
  KnowledgeChunk,
  type KnowledgeChunkDocument,
} from '../../workspace-documents-module/schema/workspace-document.schema';
import {
  WorkspaceKnowledgeFile,
  type WorkspaceKnowledgeFileDocument,
} from '../schema/workspace-knowledge-file.schema';
import { GeminiEmbeddingService } from './gemini-embedding.service';
import { KnowledgeFileParserService } from './knowledge-file-parser.service';
import { WorkspaceKnowledgeStorageService } from './workspace-knowledge-storage.service';
import { chunkText, splitTextByMaxWords } from '../lib/text-chunking';

/** Số chunk (sau tách 5000 từ) mỗi lần gọi `embedTexts` (Gemini hợp lệ tới 100/req bên trong). */
const EMBED_BATCH = 20;
/** Giới hạn tổng ký tự được index (100K chars ~ 80 chunk). Nhanh hơn và không bị Google chửi quá tải. */
const MAX_TEXT_CHARS = 100_000;
/** Delay giữa các batch embed (ms) để nhả từ từ cho Google. */
const BATCH_DELAY_MS = 3000;
const DEFAULT_MAX_WORDS_PER_CHUNK = 5000;

@Injectable()
export class WorkspaceKnowledgeIngestService {
  private readonly logger = new Logger(WorkspaceKnowledgeIngestService.name);
  private readonly maxChars: number;
  private readonly overlap: number;
  private readonly maxWordsPerEmbed: number;

  constructor(
    @InjectModel(KnowledgeChunk.name)
    private readonly chunkModel: Model<KnowledgeChunkDocument>,
    @InjectModel(WorkspaceKnowledgeFile.name)
    private readonly fileModel: Model<WorkspaceKnowledgeFileDocument>,
    private readonly storage: WorkspaceKnowledgeStorageService,
    private readonly gemini: GeminiEmbeddingService,
    private readonly parser: KnowledgeFileParserService,
    config: ConfigService,
  ) {
    this.maxChars = Number(config.get('CHUNK_MAX_CHARS')) || 1200;
    this.overlap = Number(config.get('CHUNK_OVERLAP')) || 150;
    const mw = Number(config.get('GEMINI_EMBEDDING_MAX_WORDS'));
    this.maxWordsPerEmbed =
      Number.isFinite(mw) && mw > 0 ? mw : DEFAULT_MAX_WORDS_PER_CHUNK;
  }

  /**
   * Parse → chunk → embed → ghi `knowledge_chunks` (gọi sau khi upload R2 thành công).
   */
  ingestAfterUpload(params: {
    knowledgeFileId: Types.ObjectId;
    workspaceId: Types.ObjectId;
    r2Key: string;
    originalName: string;
  }): Promise<void> {
    return this.runIngest(params);
  }

  async deleteChunksByKnowledgeFileId(fileId: Types.ObjectId): Promise<void> {
    await this.chunkModel.deleteMany({ knowledge_file_id: fileId });
  }

  private async runIngest(params: {
    knowledgeFileId: Types.ObjectId;
    workspaceId: Types.ObjectId;
    r2Key: string;
    originalName: string;
  }): Promise<void> {
    const { knowledgeFileId, workspaceId, r2Key, originalName } = params;
    const fail = async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Ingest failed ${String(knowledgeFileId)}: ${msg}`);
      await this.fileModel.updateOne(
        { _id: knowledgeFileId },
        { ingest_status: 'failed', ingest_error: msg },
      );
      await this.chunkModel.deleteMany({ knowledge_file_id: knowledgeFileId });
    };

    try {
      this.gemini.assertReady();
    } catch (e) {
      await fail(e);
      return;
    }

    try {
      const buf = await this.storage.getObjectBuffer(r2Key);
      let text = await this.parser.parseBuffer(buf, originalName);
      this.logger.log(
        `Parsed "${originalName}": ${text.length} chars`,
      );

      // Giới hạn tổng ký tự
      if (text.length > MAX_TEXT_CHARS) {
        this.logger.warn(
          `File "${originalName}" có ${text.length} chars > giới hạn ${MAX_TEXT_CHARS}. ` +
          `Chỉ index ${MAX_TEXT_CHARS} chars đầu tiên.`,
        );
        text = text.slice(0, MAX_TEXT_CHARS);
      }

      const charChunks = chunkText(text, this.maxChars, this.overlap);
      const chunks = charChunks.flatMap((c) =>
        splitTextByMaxWords(c, this.maxWordsPerEmbed),
      );
      if (chunks.length === 0) {
        const emptyMsg =
          'Không tách được nội dung văn bản từ tệp (đã thử trích text, PDF.js và OCR nếu bật). Tệp thực sự trống, OCR tắt, hoặc vẫn không đọc được nội dung (ảnh/scan mờ).';
        this.logger.warn(
          `Ingest: 0 chunk(s) for file ${String(knowledgeFileId)} — ${emptyMsg}`,
        );
        await this.fileModel.updateOne(
          { _id: knowledgeFileId },
          { $set: { ingest_status: 'failed', ingest_error: emptyMsg } },
        );
        return;
      }

      await this.chunkModel.deleteMany({ knowledge_file_id: knowledgeFileId });

      const embeddings: number[][] = [];
      let batchCount = 0;
      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH);
        const part = await this.gemini.embedTexts(batch);
        embeddings.push(...part);
        batchCount++;
        // Delay nhỏ giữa các batch
        if (i + EMBED_BATCH < chunks.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }
      this.logger.log(
        `Embed hoàn tất: ${chunks.length} chunk(s) trong ${batchCount} batch`,
      );

      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Số vector (${embeddings.length}) != số chunk (${chunks.length})`,
        );
      }

      const toInsert = chunks.map((chunk_text, idx) => {
        const emb = embeddings[idx];
        if (!emb) {
          throw new Error(`Thiếu embedding tại index ${idx}`);
        }
        return {
          workspace_id: workspaceId,
          knowledge_file_id: knowledgeFileId,
          chunk_index: idx,
          chunk_text,
          embedding: emb,
        };
      });
      await this.chunkModel.insertMany(toInsert);
      this.logger.log(
        `Ingest done: file ${String(knowledgeFileId)} → ${toInsert.length} chunk(s)`,
      );

      await this.fileModel.updateOne(
        { _id: knowledgeFileId },
        { $set: { ingest_status: 'indexed' }, $unset: { ingest_error: 1 } },
      );
    } catch (e) {
      await fail(e);
    }
  }
}
