import { IsNotEmpty, IsString } from 'class-validator';

export class UploadSkillBodyDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
