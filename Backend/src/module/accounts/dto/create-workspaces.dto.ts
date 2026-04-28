import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
   
  @Type(() => TaskLaneDto)
  task_lanes?: TaskLaneDto[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
    message: 'brand_color phải là mã hex (#RGB hoặc #RRGGBB)',
  })
  brand_color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400_000)
  logo_url?: string;
}
