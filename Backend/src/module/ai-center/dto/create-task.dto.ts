import {
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsString,
} from 'class-validator';
import { TASK_STATUS_VALUES } from '../schema/ai-center.schema';

export class CreateTaskDto {
  @IsMongoId()
  @IsNotEmpty()
  workspace_id: string;

  @IsMongoId()
  @IsNotEmpty()
  agent_id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn([...TASK_STATUS_VALUES])
  status?: (typeof TASK_STATUS_VALUES)[number];

  @IsOptional()
  @IsBoolean()
  schedule_enabled?: boolean;

  @IsOptional()
  @IsString()
  schedule_cron?: string;

  @IsOptional()
  @IsString()
  next_run_at?: string;

  @IsOptional()
  @IsString()
  thread_id?: string;
}
