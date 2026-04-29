import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAppSettingsDto {
  @IsOptional()
  @IsBoolean()
  integration_gmail_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  integration_google_calendar_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  integration_drive_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  integration_notion_enabled?: boolean;
}

