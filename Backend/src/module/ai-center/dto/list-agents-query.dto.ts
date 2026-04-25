import { IsMongoId, IsNotEmpty } from 'class-validator';

export class ListAgentsQueryDto {
  @IsNotEmpty()
  @IsMongoId()
  workspace_id: string;
}
