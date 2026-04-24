import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAgentDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  workspace_id: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  system_prompt: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  built_in_tools?: string[];

  @IsOptional()
  @IsString()
  custom_skills: string;

  /** Gắn skill template từ thư viện (cùng workspace, tuân theo quyền private/workspace). */
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  enabled_skill_template_ids?: string[];
}
