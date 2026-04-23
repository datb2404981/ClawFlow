import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService, type GoogleProfileInput } from '../service/auth.service';
import type { IUser } from '../users.interface';

/** Cấu trúc tối thiểu profile Google OAuth (tránh `any` + lỗi runtime khi thiếu mảng). */
type GoogleOauthProfile = {
  name?: { givenName?: string; familyName?: string };
  emails?: { value: string }[];
  photos?: { value: string }[];
};

/** Cổng 8000 trong compose là AI_Core — OAuth callback phải trùng cổng Nest (PORT). */
function resolveGoogleCallbackUrl(configService: ConfigService): string {
  const apiPort = String(
    configService.get('PORT') ?? configService.get('POST') ?? 8080,
  );
  const raw = configService.get<string>('GOOGLE_CALLBACK_URL')?.trim();
  let callbackURL =
    raw || `http://127.0.0.1:${apiPort}/api/v1/auth/google/callback`;

  if (apiPort !== '8000' && callbackURL.includes(':8000')) {
    callbackURL = callbackURL
      .replace(/localhost:8000/g, `localhost:${apiPort}`)
      .replace(/127\.0\.0\.1:8000/g, `127.0.0.1:${apiPort}`);
  }

  return callbackURL;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService, // Inject AuthService
  ) {
    // OAuth2Strategy ném nếu `clientID` falsy. Khi chưa cấu hình .env, dùng chuỗi giữ chỗ để app vẫn boot (JWT/đăng ký bình thường).
    const clientID =
      configService.get<string>('GOOGLE_CLIENT_ID')?.trim() ||
      '__google_oauth_not_configured__';
    const clientSecret =
      configService.get<string>('GOOGLE_CLIENT_SECRET')?.trim() ||
      '__google_oauth_not_configured__';
    const rawCallback = configService.get<string>('GOOGLE_CALLBACK_URL')?.trim();
    const callbackURL = resolveGoogleCallbackUrl(configService);

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });

    if (rawCallback?.includes(':8000') && callbackURL !== rawCallback) {
      this.logger.warn(
        'GOOGLE_CALLBACK_URL đã sửa cổng 8000 → cổng API Nest. Thêm URI mới vào Google Cloud (Authorized redirect URIs) cho khớp 100%%.',
      );
    }
    if (!rawCallback) {
      this.logger.warn(
        'GOOGLE_CALLBACK_URL không có trong env — dùng mặc định theo PORT. Khai báo rõ trong .env và Google Console cho khớp (localhost vs 127.0.0.1).',
      );
    }
    this.logger.log(`Google OAuth redirect_uri gửi tới Google: ${callbackURL}`);
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: GoogleOauthProfile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(
        new Error('Tài khoản Google không có email công khai'),
        false,
      );
    }

    const googleUser: GoogleProfileInput = {
      email,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      picture: profile.photos?.[0]?.value,
      accessToken,
    };

    const user: IUser = await this.authService.validateGoogleUser(googleUser);
    // `VerifyCallback` mong kiểu `Express.User` (Passport/Express); dữ liệu thật khớp `IUser` sau toJSON.
    done(null, user as Express.User);
  }
}