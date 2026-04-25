import { IsNotEmpty, IsString } from 'class-validator';

export class RefineSystemPromptDto {
  @IsNotEmpty()
  @IsString()
  systemPromptOfUser: string;
}
