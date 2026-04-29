import { IsNotEmpty, IsString } from 'class-validator';

export class SendTaskMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
