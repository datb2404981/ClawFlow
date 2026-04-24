import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResponseMessage, User } from 'src/common/decorator/decorators';
import type { IUser } from 'src/module/accounts/users.interface';
import { CreateSkillTemplateDto } from '../dto/create-skill-template.dto';
import { SkillTemplateScopeQueryDto } from '../dto/skill-template-scope-query.dto';
import { UpdateSkillTemplateDto } from '../dto/update-skill-template.dto';
import { SkillTemplatesService } from '../service/skill-templates.service';

@Controller('skill-templates')
export class SkillTemplatesController {
  constructor(private readonly skillTemplatesService: SkillTemplatesService) {}

  @Post()
  @ResponseMessage('Tạo skill template thành công')
  create(
    @User() user: IUser,
    @Body() dto: CreateSkillTemplateDto,
  ) {
    return this.skillTemplatesService.create(user._id, dto);
  }

  @Get()
  @ResponseMessage('Danh sách skill template')
  findAll(
    @User() user: IUser,
    @Query() q: SkillTemplateScopeQueryDto,
  ) {
    return this.skillTemplatesService.findAllByWorkspace(
      user._id,
      q.workspace_id,
    );
  }

  @Get(':templateId')
  @ResponseMessage('Chi tiết skill template')
  findOne(
    @User() user: IUser,
    @Param('templateId') templateId: string,
    @Query() q: SkillTemplateScopeQueryDto,
  ) {
    return this.skillTemplatesService.findOne(
      user._id,
      q.workspace_id,
      templateId,
    );
  }

  @Patch(':templateId')
  @ResponseMessage('Cập nhật skill template thành công')
  update(
    @User() user: IUser,
    @Param('templateId') templateId: string,
    @Query() q: SkillTemplateScopeQueryDto,
    @Body() dto: UpdateSkillTemplateDto,
  ) {
    return this.skillTemplatesService.update(
      user._id,
      q.workspace_id,
      templateId,
      dto,
    );
  }

  @Delete(':templateId')
  @ResponseMessage('Xóa skill template thành công')
  remove(
    @User() user: IUser,
    @Param('templateId') templateId: string,
    @Query() q: SkillTemplateScopeQueryDto,
  ) {
    return this.skillTemplatesService.remove(
      user._id,
      q.workspace_id,
      templateId,
    );
  }
}
