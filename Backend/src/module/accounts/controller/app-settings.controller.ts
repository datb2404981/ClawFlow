import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ResponseMessage, User } from 'src/common/decorator/decorators';
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
  ) {
    return this.usersService.getIntegrationConnectUrl(user, provider);
  }

  @Get('integrations/:provider/callback')
  @ResponseMessage('Xử lý callback integration thành công')
  connectIntegrationCallback(
    @User() user: IUser,
    @Param('provider') provider: string,
    @Query('scopes') scopes?: string,
    @Query('email') email?: string,
    @Query('error') error?: string,
  ) {
    return this.usersService.connectIntegrationCallback(user, provider, {
      scopes,
      email,
      error,
    });
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

