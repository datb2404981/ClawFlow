import { ConfigService } from '@nestjs/config';

/**
 * Access token: ưu tiên `JWT_ACCESS_SECRET`, fallback `JWT_SECRET` (tên cũ / ngắn gọn).
 */
export function getJwtAccessSecret(config: ConfigService): string {
  const secret =
    config.get<string>('JWT_ACCESS_SECRET')?.trim() ||
    config.get<string>('JWT_SECRET')?.trim();
  if (!secret) {
    throw new Error(
      'Thiếu JWT: khai báo JWT_ACCESS_SECRET hoặc JWT_SECRET trong .env',
    );
  }
  return secret;
}
