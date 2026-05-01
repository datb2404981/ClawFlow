import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ResponseMessage, User, SkipPermission } from 'src/common/decorator/decorators';
import type { IUser } from '../users.interface';
import { UsersService } from '../service/users.service';
import { UpdateAppSettingsDto } from '../dto/update-app-settings.dto';

@Controller('settings')
export class AppSettingsController {
  constructor(private readonly usersService: UsersService) {}

  @Get('app')
  @ResponseMessage('Lấy cài đặt ứng dụng thành công')
  getAppSettings(@User() user: IUser) {
    return this.usersService.getAppSettings(user);
  }

  @Patch('app')
  @ResponseMessage('Cập nhật cài đặt ứng dụng thành công')
  updateAppSettings(
    @User() user: IUser,
    @Body() dto: UpdateAppSettingsDto,
  ) {
    return this.usersService.updateAppSettings(user, dto);
  }

  @Get('integrations/catalog')
  @ResponseMessage('Lấy catalog integrations thành công')
  getIntegrationsCatalog() {
    return this.usersService.getIntegrationCatalog();
  }

  @Get('integrations/status')
  @ResponseMessage('Lấy trạng thái integrations thành công')
  getIntegrationsStatus(@User() user: IUser) {
    return this.usersService.getIntegrationsStatus(user);
  }

  @Get('integrations/:provider/connect-url')
  @ResponseMessage('Tạo URL kết nối integration thành công')
  getIntegrationConnectUrl(
    @User() user: IUser,
    @Param('provider') provider: string,
    @Query('workspace_id') workspaceId?: string,
  ) {
    return this.usersService.getIntegrationConnectUrl(
      user,
      provider,
      workspaceId,
    );
  }

  @Get('integrations/:provider/callback')
  @SkipPermission()
  async connectIntegrationCallback(
    @User() user: IUser,
    @Param('provider') provider: string,
    @Res() res: Response,
    @Query() q: Record<string, any>,
  ) {
    let { scopes, email, error, code, scope } = q;

    if (code) {
      scopes = scopes || scope || 'https://www.googleapis.com/auth/gmail.send'; 
    }

    let targetUser = user;
    let redirectWorkspaceId: string | undefined;
    const { state } = q;
    if (typeof state === 'string' && state.includes('.')) {
      const parts = state.split('.');
      if (parts.length >= 3) {
        const userId = parts[parts.length - 2];
        redirectWorkspaceId = parts[parts.length - 1]!;
        if (!targetUser) {
          targetUser = { _id: userId } as IUser;
        }
      } else if (!targetUser) {
        const userId = parts[parts.length - 1];
        targetUser = { _id: userId } as IUser;
      }
    }

    if (targetUser) {
      await this.usersService.connectIntegrationCallback(targetUser, provider, {
        scopes,
        scope: typeof q.scope === 'string' ? q.scope : undefined,
        email,
        error,
        code,
      });
    }

    const frontendBase = (
      process.env.FRONTEND_URL || 'http://localhost:5173'
    ).replace(/\/$/, '');
    const path = redirectWorkspaceId
      ? `/app/w/${encodeURIComponent(redirectWorkspaceId)}/settings/app`
      : '/app';
    return res.redirect(`${frontendBase}${path}`);
  }

  @Post('integrations/:provider/disconnect')
  @ResponseMessage('Ngắt kết nối integration thành công')
  disconnectIntegration(
    @User() user: IUser,
    @Param('provider') provider: string,
  ) {
    return this.usersService.disconnectIntegration(user, provider);
  }
}

