import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './module/accounts/account.module';
import { AiCenterModule } from './module/ai-center/ai-center.module';
import { WorkspaceDocumentsModuleModule } from './module/workspace-documents-module/workspace-documents-module.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      /** Chạy từ `Backend/` hoặc từ thư mục gốc monorepo đều tìm thấy `.env`. */
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), 'Backend', '.env'),
      ],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    import('@nestjs/bullmq').then(m => m.BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    })),
    UsersModule,
    AiCenterModule,
    WorkspaceDocumentsModuleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
