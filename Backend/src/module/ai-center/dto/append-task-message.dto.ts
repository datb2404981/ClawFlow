import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export const APPEND_TASK_MESSAGE_MAX_LENGTH = 16_000;

export class AppendTaskMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(APPEND_TASK_MESSAGE_MAX_LENGTH)
  content!: string;

  @IsString()
  messageId?: string;
}
