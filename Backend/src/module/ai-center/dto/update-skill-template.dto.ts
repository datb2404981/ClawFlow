import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateSkillTemplateDto } from './create-skill-template.dto';

export class UpdateSkillTemplateDto extends PartialType(
  OmitType(CreateSkillTemplateDto, ['workspace_id'] as const),
) {}
