import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TaskLaneDto } from 'src/module/ai-center/dto/task-lane.dto';

export class CreateWorkspacesDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  memory_enabled?: boolean;

  @IsOptional()
  @IsIn(['user', 'workspace'])
  memory_scope?: 'user' | 'workspace';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- class-transformer cần factory trả về class
  @Type(() => TaskLaneDto)
  task_lanes?: TaskLaneDto[];
}
