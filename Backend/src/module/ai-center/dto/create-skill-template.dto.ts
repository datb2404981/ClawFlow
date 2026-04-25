import {
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const SKILL_TEMPLATE_ICON_KEYS = [
  'doc',
  'canvas',
  'browser',
  'scan',
] as const;
export type SkillTemplateIconKey = (typeof SKILL_TEMPLATE_ICON_KEYS)[number];

export class CreateSkillTemplateDto {
  @IsMongoId()
  @IsNotEmpty()
  workspace_id: string;

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
  @IsString()
  source_url?: string;

  @IsIn(['private', 'workspace'])
  visibility: 'private' | 'workspace';

  @IsOptional()
  @IsIn(['doc', 'canvas', 'browser', 'scan'])
  icon?: SkillTemplateIconKey;
}
