import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreateWorkspacesDto } from './create-workspaces.dto';

export class UpdateWorkspacesDto extends PartialType(CreateWorkspacesDto) {
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}
