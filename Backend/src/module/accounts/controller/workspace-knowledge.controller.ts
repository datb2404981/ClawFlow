import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { ResponseMessage, User } from 'src/common/decorator/decorators';
import type { IUser } from '../users.interface';
import { WorkspaceKnowledgeService } from '../service/workspace-knowledge.service';

@Controller('workspaces/:workspaceId/knowledge')
export class WorkspaceKnowledgeController {
  constructor(private readonly knowledge: WorkspaceKnowledgeService) {}

  @Get()
  @ResponseMessage('Danh sách tài liệu')
  list(@User() user: IUser, @Param('workspaceId') workspaceId: string) {
    return this.knowledge.list(user._id, workspaceId);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  @ResponseMessage('Tải lên thành công')
  async upload(
    @User() user: IUser,
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Thiếu tệp (field: file)');
    }
    return this.knowledge.registerMulterFile(user._id, workspaceId, file);
  }

  @Delete('files/:fileId')
  @ResponseMessage('Đã xoá tệp')
  remove(
    @User() user: IUser,
    @Param('workspaceId') workspaceId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.knowledge.remove(user._id, workspaceId, fileId);
  }
}
