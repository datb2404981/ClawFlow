import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import 'cookie-parser';
import type { Request, Response } from 'express';
import {
  ResponseMessage,
  SkipPermission,
  User,
} from 'src/common/decorator/decorators';
import { GoogleAuthGuard } from '../guard/google-auth.guard';
import { AuthService } from '../service/auth.service';
import { CreateUserDto, LoginDto } from '../dto/create-user.dto';
import type { IUser } from '../users.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @SkipPermission()
  @ResponseMessage('Đăng nhập thành công')
  login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(loginDto, res);
  }

  @Post('register')
  @SkipPermission()
  @ResponseMessage('Đăng ký thành công')
  register(
    @Body() registerDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(registerDto, res);
  }

  @Post('refresh')
  @SkipPermission()
  @ResponseMessage('Làm mới access token')
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refresh_token: refreshToken } = req.cookies ?? {};
    if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
      throw new UnauthorizedException('Thiếu refresh token (cookie refresh_token)');
    }
    return this.authService.processNewToken(refreshToken, res);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ResponseMessage('Đăng xuất thành công')
  logout(
    @User() user: IUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(user, res);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @SkipPermission()
  googleAuth() {
    // Passport tự redirect sang Google OAuth
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @SkipPermission()
  async googleAuthCallback(
    @Req() req: Request & { user?: IUser },
    @Res() res: Response,
  ) {
    const base = this.configService
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/$/, '');

    if (!req.user?._id) {
      return res.redirect(302, `${base}/login?error=google`);
    }
    await this.authService.loginGoogle(req.user, res);
    return res.redirect(302, `${base}/login?status=success`);
  }
}
