import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ResponseMessage, User } from 'src/common/decorator/decorators';
import type { IUser } from '../users.interface';
import { CreateWorkspacesDto } from '../dto/create-workspaces.dto';
import { UpdateWorkspacesDto } from '../dto/update-workspaces.dto';
import { WorkspacesService } from '../service/workspaces.service';
import { Workspace } from '../schema/workspace.schema';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ResponseMessage('Tạo workspace thành công')
  create(
    @User() user: IUser,
    @Body() createWorkspacesDto: CreateWorkspacesDto,
  ): Promise<Workspace> {
    return this.workspacesService.create(user._id, createWorkspacesDto);
  }

  @Get()
  @ResponseMessage('Danh sách workspace')
  findAll(@User() user: IUser): Promise<Workspace[]> {
    return this.workspacesService.findAllByUser(user._id);
  }

  @Get(':id')
  @ResponseMessage('Chi tiết workspace')
  findOne(
    @User() user: IUser,
    @Param('id') id: string,
  ): Promise<Workspace> {
    return this.workspacesService.findOne(user._id, id);
  }

  @Patch(':id')
  @ResponseMessage('Cập nhật workspace thành công')
  update(
    @User() user: IUser,
    @Param('id') id: string,
    @Body() updateWorkspacesDto: UpdateWorkspacesDto,
  ): Promise<Workspace> {
    return this.workspacesService.update(user._id, id, updateWorkspacesDto);
  }

  @Delete(':id')
  @ResponseMessage('Xóa workspace thành công')
  async remove(@User() user: IUser, @Param('id') id: string): Promise<void> {
    await this.workspacesService.remove(user._id, id);
  }
}
