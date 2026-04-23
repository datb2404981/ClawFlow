import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJwtAccessSecret } from 'src/common/config/jwt-access-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      // Lấy token từ header Authorization: Bearer ...
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Token hết hạn là chặn luôn
      secretOrKey: getJwtAccessSecret(configService),
    });
  }

  // Khi Token hợp lệ, hàm này chạy và trả về thông tin user
  validate(payload: { sub: string; email?: string; username?: string }) {
    return {
      _id: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }
}