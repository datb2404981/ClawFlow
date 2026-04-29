import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

/** Không đổi workspace; có thể đổi agent (cùng workspace) cùng các trường khác. */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['workspace_id'] as const),
) {}
