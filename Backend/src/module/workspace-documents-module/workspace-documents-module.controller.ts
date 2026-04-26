import { Controller } from '@nestjs/common';
import { WorkspaceDocumentsModuleService } from './workspace-documents-module.service';

@Controller('workspace-documents-module')
export class WorkspaceDocumentsModuleController {
  constructor(private readonly workspaceDocumentsModuleService: WorkspaceDocumentsModuleService) {}
}
