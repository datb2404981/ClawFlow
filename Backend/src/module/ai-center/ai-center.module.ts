import { Module } from '@nestjs/common';
import { UsersModule } from 'src/module/accounts/account.module';
import { AgentsService } from './service/agents.service';
import { AgentsController } from './controller/agent.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Agents, AgentsSchema, Task, TaskSchema } from './schema/ai-center.schema';
import {
  SkillTemplate,
  SkillTemplateSchema,
} from './schema/skill-template.schema';
import {
  KnowledgeChunk,
  KnowledgeChunkSchema,
} from '../workspace-documents-module/schema/workspace-document.schema';
import { TasksController } from './controller/tasks.controller';
import { TasksService } from './service/tasks.service';
import { SkillTemplatesService } from './service/skill-templates.service';
import { SkillTemplatesController } from './controller/skill-templates.controller';
import { AdminSeedGuard } from 'src/common/guard/admin-seed.guard';
import { AdminSeedSkillTemplatesController } from './controller/admin-seed-skill-templates.controller';
import { AiCoreService } from './service/ai-core.service';
import { BullModule } from '@nestjs/bullmq';
import { TasksGateway } from './gateway/tasks.gateway';
import { TasksProcessor } from './processor/tasks.processor';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Agents.name, schema: AgentsSchema },
      { name: Task.name, schema: TaskSchema },
      { name: SkillTemplate.name, schema: SkillTemplateSchema },
      { name: KnowledgeChunk.name, schema: KnowledgeChunkSchema },
    ]),
    BullModule.registerQueue({
      name: 'tasks_queue',
    }),
  ],
  controllers: [
    AgentsController,
    SkillTemplatesController,
    AdminSeedSkillTemplatesController,
    TasksController,
  ],
  providers: [
    AgentsService,
    SkillTemplatesService,
    TasksService,
    AdminSeedGuard,
    AiCoreService,
    TasksGateway,
    TasksProcessor,
  ],
})
export class AiCenterModule {}
