import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipPermission } from './common/decorator/decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SkipPermission()
  getHello(): string {
    return this.appService.getHello();
  }
}
