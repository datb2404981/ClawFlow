import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsMongoId, IsOptional } from 'class-validator';
import { CreateAgentDto } from './create-agent.dto';

export class UpdateAgentDto extends PartialType(CreateAgentDto) {
  /** Khai báo lại để tránh kiểu suy luận lỗi từ PartialType khiến ESLint báo `error`. */
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  enabled_skill_template_ids?: string[];
}
