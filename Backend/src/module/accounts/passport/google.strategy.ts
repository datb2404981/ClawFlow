import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService, type GoogleProfileInput } from '../service/auth.service';
import type { IUser } from '../users.interface';

/** Cấu trúc tối thiểu profile Google OAuth (tránh `any` + lỗi runtime khi thiếu mảng). */
type GoogleOauthProfile = {
  name?: { givenName?: string; familyName?: string };
  emails?: { value: string }[];
  photos?: { value: string }[];
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
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
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL')?.trim() ||
      'http://127.0.0.1:8080/api/v1/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
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