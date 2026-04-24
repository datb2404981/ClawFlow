import { IsMongoId, IsNotEmpty } from 'class-validator';

export class TaskScopeQueryDto {
  @IsNotEmpty()
  @IsMongoId()
  workspace_id: string;
}
