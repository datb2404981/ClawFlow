import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Chữ hoa + số + ký tự đặc biệt (không dùng khoảng trắng làm ký tự đặc biệt). */
export const PASSWORD_STRENGTH_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;

const SSO_PROVIDERS = [
  'google',
  'facebook',
  'github',
  'linkedin',
  'microsoft',
  'apple',
] as const;

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_STRENGTH_REGEX, {
    message:
      'Mật khẩu 8–128 ký tự, phải có chữ hoa, số và ký tự đặc biệt (không chỉ chữ thường).',
  })
  password: string;

  @IsOptional()
  @IsIn(SSO_PROVIDERS)
  sso_provider?: (typeof SSO_PROVIDERS)[number];
}

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}