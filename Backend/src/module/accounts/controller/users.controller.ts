import { Body, Controller, Get, Post } from '@nestjs/common';
import { ResponseMessage, SkipPermission, User } from '../../../common/decorator/decorators';
import { UsersService } from '../service/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import type { IUser } from '../users.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @SkipPermission()
  @ResponseMessage('Tạo tài khoản thành công')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('me')
  @ResponseMessage('Lấy thông tin tài khoản')
  findMe(@User() user: IUser) {
    return this.usersService.findOne(user);
  }
}
