import { IsIn, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import { TASK_STATUS_VALUES } from '../schema/ai-center.schema';

export class ListTasksQueryDto {
  @IsNotEmpty()
  @IsMongoId()
  workspace_id: string;

  @IsOptional()
  @IsMongoId()
  agent_id?: string;

  @IsOptional()
  @IsIn([...TASK_STATUS_VALUES])
  status?: (typeof TASK_STATUS_VALUES)[number];
}
