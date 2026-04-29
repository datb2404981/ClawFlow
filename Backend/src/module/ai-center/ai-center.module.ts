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
import { GoogleWebhookController } from './controller/google-webhook.controller';
import { TasksService } from './service/tasks.service';
import { SkillTemplatesService } from './service/skill-templates.service';
import { SkillTemplatesController } from './controller/skill-templates.controller';
import { AdminSeedGuard } from 'src/common/guard/admin-seed.guard';
import { AdminSeedSkillTemplatesController } from './controller/admin-seed-skill-templates.controller';
import { AiCoreService } from './service/ai-core.service';
import { BullModule } from '@nestjs/bullmq';
import { TasksGateway } from './gateway/tasks.gateway';
import { TasksProcessor } from './processor/tasks.processor';
import {
  MemoryEvent,
  MemoryEventSchema,
  MemoryFact,
  MemoryFactSchema,
  MemorySummary,
  MemorySummarySchema,
} from './schema/memory.schema';
import { MemoryFlowService } from './service/memory-flow.service';
import { ThirdPartyExecutorService } from './service/third-party-executor.service';
import { GmailConnectorService } from './service/connectors/gmail-connector.service';
import { CalendarConnectorService } from './service/connectors/calendar-connector.service';
import { DriveConnectorService } from './service/connectors/drive-connector.service';
import { NotionConnectorService } from './service/connectors/notion-connector.service';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Agents.name, schema: AgentsSchema },
      { name: Task.name, schema: TaskSchema },
      { name: SkillTemplate.name, schema: SkillTemplateSchema },
      { name: KnowledgeChunk.name, schema: KnowledgeChunkSchema },
      { name: MemoryEvent.name, schema: MemoryEventSchema },
      { name: MemorySummary.name, schema: MemorySummarySchema },
      { name: MemoryFact.name, schema: MemoryFactSchema },
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
    GoogleWebhookController,
  ],
  providers: [
    AgentsService,
    SkillTemplatesService,
    TasksService,
    AdminSeedGuard,
    AiCoreService,
    TasksGateway,
    TasksProcessor,
    MemoryFlowService,
    ThirdPartyExecutorService,
    GmailConnectorService,
    CalendarConnectorService,
    DriveConnectorService,
    NotionConnectorService,
  ],
})
export class AiCenterModule {}
