import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './service/users.service';
import { UsersController } from './controller/users.controller';
import { User, UserSchema } from './schema/user.schema';
import { Workspace, WorkspaceSchema } from './schema/workspace.schema';
import {
  WorkspaceKnowledgeFile,
  WorkspaceKnowledgeFileSchema,
} from './schema/workspace-knowledge-file.schema';
import {
  KnowledgeChunk,
  KnowledgeChunkSchema,
} from '../workspace-documents-module/schema/workspace-document.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { JwtStrategy } from './passport/jwt.strategy';
import { GoogleStrategy } from './passport/google.strategy';
import { getJwtAccessSecret } from 'src/common/config/jwt-access-secret';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { WorkspacesController } from './controller/workspaces.controller';
import { WorkspacesService } from './service/workspaces.service';
import { WorkspaceKnowledgeController } from './controller/workspace-knowledge.controller';
import { WorkspaceKnowledgeService } from './service/workspace-knowledge.service';
import { WorkspaceKnowledgeStorageService } from './service/workspace-knowledge-storage.service';
import { GeminiEmbeddingService } from './service/gemini-embedding.service';
import { KnowledgeFileParserService } from './service/knowledge-file-parser.service';
import { WorkspaceKnowledgeIngestService } from './service/workspace-knowledge-ingest.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      {
        name: WorkspaceKnowledgeFile.name,
        schema: WorkspaceKnowledgeFileSchema,
      },
      { name: KnowledgeChunk.name, schema: KnowledgeChunkSchema },
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
  controllers: [
    UsersController,
    AuthController,
    WorkspacesController,
    WorkspaceKnowledgeController,
  ],
  providers: [
    UsersService,
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    WorkspacesService,
    WorkspaceKnowledgeStorageService,
    GeminiEmbeddingService,
    KnowledgeFileParserService,
    WorkspaceKnowledgeIngestService,
    WorkspaceKnowledgeService,
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
