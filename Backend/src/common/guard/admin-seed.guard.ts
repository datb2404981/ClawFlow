import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Bảo vệ API seed/admin: gửi `X-Admin-Seed-Key: <key>` hoặc `Authorization: Bearer <key>`.
 * Cần biến môi trường `ADMIN_SEED_KEY` (chuỗi mạnh, không commit).
 */
@Injectable()
export class AdminSeedGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const key = this.config.get<string>('ADMIN_SEED_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình ADMIN_SEED_KEY trên server',
      );
    }
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const h = req.headers['x-admin-seed-key'];
    const headerKey = Array.isArray(h) ? h[0] : h;
    const auth = req.headers['authorization'];
    const authStr = Array.isArray(auth) ? auth[0] : auth;
    const bearer =
      authStr && /^Bearer\s+/i.test(authStr)
        ? authStr.replace(/^Bearer\s+/i, '').trim()
        : undefined;
    if (headerKey === key || bearer === key) {
      return true;
    }
    throw new UnauthorizedException('Khóa admin seed không hợp lệ');
  }
}
