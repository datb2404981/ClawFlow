import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

/** Không đổi workspace/agent sau khi tạo. */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['workspace_id', 'agent_id'] as const),
) {}
