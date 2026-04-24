import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './service/users.service';
import { UsersController } from './controller/users.controller';
import { User, UserSchema } from './schema/user.schema';
import { Workspace, WorkspaceSchema } from './schema/workspace.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { JwtStrategy } from './passport/jwt.strategy';
import { GoogleStrategy } from './passport/google.strategy';
import { getJwtAccessSecret } from 'src/common/config/jwt-access-secret';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { WorkspacesController } from './controller/workspaces.controller';
import { WorkspacesService } from './service/workspaces.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: getJwtAccessSecret(config),
        signOptions: { expiresIn: '7d' as const },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController, AuthController, WorkspacesController],
  providers: [
    UsersService,
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    WorkspacesService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [
    UsersService,
    AuthService,
    WorkspacesService,
    PassportModule,
    JwtModule,
  ],
})
export class UsersModule {}
