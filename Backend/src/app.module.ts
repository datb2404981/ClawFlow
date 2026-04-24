import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './module/accounts/account.module';
import { AiCenterModule } from './module/ai-center/ai-center.module';

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
    UsersModule,
    AiCenterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
