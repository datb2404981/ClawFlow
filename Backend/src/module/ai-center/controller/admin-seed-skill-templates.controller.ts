import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminSeedGuard } from 'src/common/guard/admin-seed.guard';
import { ResponseMessage, SkipPermission } from 'src/common/decorator/decorators';
import { AdminSeedSkillTemplateDto } from '../dto/admin-seed-skill-template.dto';
import { SkillTemplatesService } from '../service/skill-templates.service';

@SkipPermission()
@Controller('admin/seed')
export class AdminSeedSkillTemplatesController {
  constructor(private readonly skillTemplatesService: SkillTemplatesService) {}

  /**
   * Dùng để phân biệt Nest (8080) với AI_Core (8000): GET này trả 200, không cần khóa.
   * @see POST skill-templates cần `X-Admin-Seed-Key`
   */
  @Get('ping')
  @ResponseMessage('Admin seed: route hoạt động (NestJS)')
  ping(): { ok: true; service: string } {
    return { ok: true, service: 'clawflow-backend' };
  }

  /** Liệt kê tất cả skill templates hệ thống (is_system: true) để kiểm tra đã seed chưa. */
  @Get('skill-templates')
  @UseGuards(AdminSeedGuard)
  @ResponseMessage('Danh sách skill template hệ thống')
  async findSystemTemplates(): Promise<object[]> {
    return await this.skillTemplatesService.adminSeedFindSystem();
  }

  @Post('skill-templates')
  @UseGuards(AdminSeedGuard)
  @ResponseMessage('Tạo skill template (admin / seed)')
  async create(
    @Body() dto: AdminSeedSkillTemplateDto,
  ): Promise<object> {
    return this.skillTemplatesService.adminSeedCreate(dto);
  }
}
