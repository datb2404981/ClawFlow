import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';
import type { Express } from 'express';
import { WorkspacesService } from './workspaces.service';
import {
  WorkspaceKnowledgeFile,
  WorkspaceKnowledgeFileDocument,
} from '../schema/workspace-knowledge-file.schema';

const MAX_KB_BYTES = 20 * 1024 * 1024;
const allowedExt = /\.(pdf|docx|txt)$/i;

@Injectable()
export class WorkspaceKnowledgeService {
  constructor(
    @InjectModel(WorkspaceKnowledgeFile.name)
    private readonly kbFileModel: Model<WorkspaceKnowledgeFileDocument>,
    private readonly workspaces: WorkspacesService,
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
   * Ghi bản ghi DB sau khi Multer lưu file lên đĩa.
   */
  async registerMulterFile(
    userId: string,
    workspaceId: string,
    file: Express.Multer.File,
  ) {
    await this.workspaces.findOne(userId, workspaceId);
    if (!file) {
      throw new BadRequestException('Thiếu tệp');
    }
    if (!allowedExt.test(file.originalname)) {
      const path = file.path;
      await fsp.unlink(path).catch(() => undefined);
      throw new BadRequestException('Chỉ chấp nhận .pdf, .docx, .txt');
    }
    if (file.size > MAX_KB_BYTES) {
      await fsp.unlink(file.path).catch(() => undefined);
      throw new PayloadTooLargeException('Tệp tối đa 20MB.');
    }
    const wid = this.toOid(workspaceId);
    const stored = file.filename;
    const mt = this.guessMime(file.originalname, file.mimetype);
    const doc = await this.kbFileModel.create({
      workspace_id: wid,
      original_name: file.originalname,
      stored_filename: stored,
      size_bytes: file.size,
      mime_type: mt,
    });
    return doc.toJSON() as unknown as Record<string, unknown>;
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
