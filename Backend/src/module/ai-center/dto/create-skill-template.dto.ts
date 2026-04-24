import { IsIn, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class CreateSkillTemplateDto {
  @IsMongoId()
  @IsNotEmpty()
  workspace_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsIn(['private', 'workspace'])
  visibility: 'private' | 'workspace';
}
