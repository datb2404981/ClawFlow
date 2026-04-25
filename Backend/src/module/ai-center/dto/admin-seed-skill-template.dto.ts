import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { SkillTemplateIconKey } from './create-skill-template.dto';

/**
 * Body POST /admin/seed/skill-templates — tạo mẫu hệ thống (workspace/created null)
 * hoặc mẫu gán workspace (bypass thành viên workspace, dành quản trị/CI).
 */
/** Chuỗi/số → boolean; giữ `unknown` cho giá trị lạ để @IsBoolean() báo lỗi. */
function transformBooleanish(value: unknown): unknown {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value;
}

export class AdminSeedSkillTemplateDto {
  /** Postman / form-data đôi khi gửi "true"/"false" (string) — ép về boolean. */
  @Transform(({ value }: { value: unknown }) => transformBooleanish(value))
  @IsBoolean()
  is_system: boolean;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsIn(['private', 'workspace'])
  visibility?: 'private' | 'workspace';

  @IsOptional()
  @IsString()
  source_url?: string;

  @IsOptional()
  @IsIn(['doc', 'canvas', 'browser', 'scan'])
  icon?: SkillTemplateIconKey;

  @ValidateIf((o: AdminSeedSkillTemplateDto) => o.is_system === false)
  @IsMongoId()
  @IsNotEmpty()
  workspace_id?: string;

  @ValidateIf((o: AdminSeedSkillTemplateDto) => o.is_system === false)
  @IsMongoId()
  @IsNotEmpty()
  created_by?: string;
}
