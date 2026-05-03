import { IsNotEmpty, IsString } from 'class-validator';

export class RefineEmailDto {
  @IsString()
  @IsNotEmpty()
  emailBody!: string;
}
