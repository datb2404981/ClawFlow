import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const HUMAN_ANSWER_MAX_LENGTH = 16_000;

export class HumanAnswerDto {
  /**
   * UI có thể gửi JSON.stringify(answers) vào đây.
   * Backend sẽ append trực tiếp vào prompt draft mode cho AI_Core.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(HUMAN_ANSWER_MAX_LENGTH)
  answer!: string;
}

