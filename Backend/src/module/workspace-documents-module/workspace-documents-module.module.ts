import { Module } from '@nestjs/common';
import { WorkspaceDocumentsModuleService } from './workspace-documents-module.service';
import { WorkspaceDocumentsModuleController } from './workspace-documents-module.controller';
import { KnowledgeChunkSchema, KnowledgeChunk, WorkspaceDocument, WorkspaceDocumentSchema } from './schema/workspace-document.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [MongooseModule.forFeature(
    [{ name: WorkspaceDocument.name, schema: WorkspaceDocumentSchema },
      { name: KnowledgeChunk.name, schema: KnowledgeChunkSchema }
    ])],
  controllers: [WorkspaceDocumentsModuleController],
  providers: [WorkspaceDocumentsModuleService],
})
export class WorkspaceDocumentsModuleModule {}
