import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { JwtSignOptions } from '@nestjs/jwt';
import { Model } from 'mongoose';
import type { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { User } from '../schema/user.schema';
import type { IUser } from '../users.interface';
import type { CreateUserDto, LoginDto } from '../dto/create-user.dto';
import { UsersService } from './users.service';

export type GoogleProfileInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  accessToken: string;
};

type JwtPayload = {
  sub: string;
  email: string;
  username: string;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Dùng cho LocalStrategy: so khớp email + mật khẩu. Trả `null` nếu sai.
   * Tham số tên `username` trong Passport-local thường là email khi form đăng nhập theo email.
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<IUser | null> {
    const doc = await this.userModel.findOne({
      email: email.trim().toLowerCase(),
    });
    if (!doc) {
      return null;
    }
    const match = await bcrypt.compare(password, doc.password);
    if (!match) {
      return null;
    }
    // `select()` là của Query, không gọi trên document. Schema `toJSON` đã bỏ `password`.
    return doc.toJSON() as unknown as IUser;
  }

  async login(
    loginDto: LoginDto,
    res: Response,
  ): Promise<{
    access_token: string;
    user: {
      _id: string;
      email: string;
      username: string;
      avatar_url?: string;
    };
  }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.handleTokenAndCookie(user, res);
  }

  /**
   * Sau khi GoogleStrategy gán `req.user`, cấp access + refresh (cookie).
   */
  async loginGoogle(
    user: IUser,
    res: Response,
  ): Promise<{
    access_token: string;
    user: {
      _id: string;
      email: string;
      username: string;
      avatar_url?: string;
    };
  }> {
    if (!user?._id || !user.email) {
      throw new UnauthorizedException('Đăng nhập Google thất bại');
    }
    return this.handleTokenAndCookie(user, res);
  }

  private toPublicUser(u: IUser & { password?: string }): IUser {
    const o = { ...u };
    delete (o as { password?: string }).password;
    return o;
  }

  private async handleTokenAndCookie(
    user: IUser,
    response: Response,
  ): Promise<{
    access_token: string;
    user: {
      _id: string;
      email: string;
      username: string;
      avatar_url?: string;
    };
  }> {
    const safe = this.toPublicUser(
      user as IUser & { password?: string; refreshToken?: string },
    );
    const payload: JwtPayload = {
      sub: user._id,
      email: user.email,
      username: user.username,
    };

    const access_token = await this.jwtService.signAsync(payload);
    const refresh_token = await this.createRefreshToken(payload);

    await this.usersService.updateProfile(user.email, {
      refreshToken: refresh_token,
    });

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const refreshMs =
      this.parseDurationToMs(
        this.configService.get<string>('JWT_REFRESH_EXPIRE') ?? '7d',
      ) ?? 7 * 24 * 60 * 60 * 1000;

    response.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: refreshMs,
    });

    return {
      access_token,
      user: {
        _id: safe._id,
        email: safe.email,
        username: safe.username,
        avatar_url: safe.avatar_url,
      },
    };
  }

  /**
   * Parse thời gian dạng "7d", "24h" (mặc định) → ms cho maxAge cookie.
   */
  private parseDurationToMs(s: string): number | null {
    const m = /^(\d+)(ms|s|m|h|d)$/i.exec(s.trim());
    if (!m) return null;
    const n = Number(m[1]);
    const u = m[2].toLowerCase();
    const table: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return n * (table[u] ?? 86_400_000);
  }

  private createRefreshToken(payload: JwtPayload): Promise<string> {
    const options: JwtSignOptions = {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRE') ??
        '7d') as JwtSignOptions['expiresIn'],
    };
    return this.jwtService.signAsync(payload, options);
  }

  /**
   * Tìm user theo email Google hoặc tạo mới (OAuth), gán req.user sau GoogleStrategy.
   */
  async validateGoogleUser(googleUser: GoogleProfileInput): Promise<IUser> {
    const email = googleUser.email.trim().toLowerCase();
    let doc = await this.userModel.findOne({ email });
    if (!doc) {
      const salt = await bcrypt.genSalt(10);
      const placeholderPassword = await bcrypt.hash(
        `google-oauth|${googleUser.accessToken}|${Date.now()}`,
        salt,
      );
      const fullName = [googleUser.firstName, googleUser.lastName]
        .filter(Boolean)
        .join(' ');
      doc = await this.userModel.create({
        username: `${email.split('@')[0]}_${Date.now().toString(36)}`,
        email,
        password: placeholderPassword,
        sso_provider: 'google',
        fullName,
        avatar_url: googleUser.picture,
      });
    }
    return doc.toJSON() as unknown as IUser;
  }

  async register(
    registerDto: CreateUserDto,
    res: Response,
  ): Promise<{
    access_token: string;
    user: {
      _id: string;
      email: string;
      username: string;
      avatar_url?: string;
    };
  }> {
    const created = await this.usersService.create(registerDto);
    const asUser = created as unknown as IUser;
    return this.handleTokenAndCookie(asUser, res);
  }

  async processNewToken(
    refreshToken: string,
    res: Response,
  ): Promise<{
    access_token: string;
    user: {
      _id: string;
      email: string;
      username: string;
      avatar_url?: string;
    };
  }> {
    if (!refreshToken?.trim()) {
      throw new BadRequestException('Thiếu refresh token');
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (!payload?.email) {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }
      const state = await this.usersService.findAuthStateByEmail(payload.email);
      if (!state) {
        throw new BadRequestException('Tài khoản không tồn tại');
      }
      if (state.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Token không hợp lệ. Vui lòng đăng nhập lại.');
      }
      const forJwt: IUser = {
        _id: state._id,
        email: state.email,
        username: state.username,
        avatar_url: state.avatar_url,
      };
      return this.handleTokenAndCookie(forJwt, res);
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new UnauthorizedException('Token không hợp lệ. Vui lòng đăng nhập lại.');
    }
  }

  async logout(user: IUser, res: Response): Promise<{ ok: true }> {
    await this.usersService.updateProfile(user.email, { refreshToken: null });
    res.clearCookie('refresh_token', { path: '/', sameSite: 'lax' });
    return { ok: true };
  }
}
