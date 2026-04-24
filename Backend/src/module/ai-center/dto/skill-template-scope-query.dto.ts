import { IsMongoId, IsNotEmpty } from 'class-validator';

/** `GET/PATCH/DELETE` skill template cần xác định workspace (query `workspace_id`) để check quyền. */
export class SkillTemplateScopeQueryDto {
  @IsNotEmpty()
  @IsMongoId()
  workspace_id: string;
}
