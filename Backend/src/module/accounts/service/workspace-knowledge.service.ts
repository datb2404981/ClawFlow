import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import type { Express } from 'express';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceKnowledgeStorageService } from './workspace-knowledge-storage.service';
import { WorkspaceKnowledgeIngestService } from './workspace-knowledge-ingest.service';
import {
  WorkspaceKnowledgeFile,
  WorkspaceKnowledgeFileDocument,
} from '../schema/workspace-knowledge-file.schema';

const MAX_KB_BYTES = 100 * 1024 * 1024;
const allowedExt = /\.(pdf|docx|txt)$/i;

@Injectable()
export class WorkspaceKnowledgeService {
  constructor(
    @InjectModel(WorkspaceKnowledgeFile.name)
    private readonly kbFileModel: Model<WorkspaceKnowledgeFileDocument>,
    private readonly workspaces: WorkspacesService,
    private readonly storage: WorkspaceKnowledgeStorageService,
    private readonly ingest: WorkspaceKnowledgeIngestService,
  ) {}

  private toOid(id: string): Types.ObjectId {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('id workspace không hợp lệ');
    }
    return new Types.ObjectId(id);
  }

  private guessMime(original: string, fallback?: string): string | undefined {
    if (fallback && !/^application\/octet-stream$/i.test(fallback)) return fallback;
    if (/\.pdf$/i.test(original)) return 'application/pdf';
    if (/\.docx$/i.test(original)) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (/\.txt$/i.test(original)) return 'text/plain';
    return fallback;
  }

  async list(userId: string, workspaceId: string) {
    await this.workspaces.findOne(userId, workspaceId);
    const wid = this.toOid(workspaceId);
    return this.kbFileModel
      .find({ workspace_id: wid })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  /**
   * Tải buffer lên R2 và ghi bản ghi DB (stored_filename = object key).
   */
  async registerMulterFile(
    userId: string,
    workspaceId: string,
    file: Express.Multer.File,
  ) {
    await this.workspaces.findOne(userId, workspaceId);
    this.storage.assertReady();
    if (!file) {
      throw new BadRequestException('Thiếu tệp');
    }
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Tệp không có buffer (cần memory storage).');
    }
    const normalizedName = file.originalname.normalize('NFC');
    if (!allowedExt.test(normalizedName)) {
      throw new BadRequestException('Chỉ chấp nhận .pdf, .docx, .txt');
    }
    if (file.size > MAX_KB_BYTES) {
      throw new PayloadTooLargeException('Tệp tối đa 100MB.');
    }
    const wid = this.toOid(workspaceId);
    const rawExt = (extname(normalizedName) || '').toLowerCase() || '.bin';
    const key = `workspace-knowledge/${workspaceId}/${randomUUID()}${rawExt}`;
    const mt = this.guessMime(normalizedName, file.mimetype);
    await this.storage.putObject(key, file.buffer, mt);
    const doc = await this.kbFileModel.create({
      workspace_id: wid,
      original_name: normalizedName,
      stored_filename: key,
      size_bytes: file.size,
      mime_type: mt,
      ingest_status: 'pending',
    });
    setImmediate(() => {
      const knowledgeFileId = new Types.ObjectId(String(doc._id));
      void this.ingest.ingestAfterUpload({
        knowledgeFileId,
        workspaceId: wid,
        r2Key: key,
        originalName: normalizedName,
      });
    });
    const d = doc as { toObject: () => object };
    return d.toObject() as unknown as Record<string, unknown>;
  }

  async remove(userId: string, workspaceId: string, fileId: string) {
    await this.workspaces.findOne(userId, workspaceId);
    if (!isValidObjectId(fileId)) {
      throw new BadRequestException('id tệp không hợp lệ');
    }
    const wid = this.toOid(workspaceId);
    const fid = this.toOid(fileId);
    const doc = await this.kbFileModel.findOneAndDelete({
      _id: fid,
      workspace_id: wid,
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy tệp');
    }
    await this.ingest.deleteChunksByKnowledgeFileId(doc._id);
    if (doc.stored_filename.includes('workspace-knowledge/')) {
      await this.storage.deleteObject(doc.stored_filename);
      return;
    }
    const fullPath = join(
      process.cwd(),
      'uploads',
      'workspace-knowledge',
      workspaceId,
      doc.stored_filename,
    );
    await fsp.unlink(fullPath).catch(() => undefined);
  }
}
