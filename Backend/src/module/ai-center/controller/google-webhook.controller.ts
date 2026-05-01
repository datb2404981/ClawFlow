import {
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { TasksService } from '../service/tasks.service';

type WebhookBody = {
  event_id?: string;
  workspace_id?: string;
  agent_id?: string;
  title?: string;
  prompt?: string;
  thread_id?: string;
  // MVP: webhook có thể đính kèm user id qua header để map created_by.
  user_id?: string;
};

import { UsersService } from '../../accounts/service/users.service';

@Controller('integrations/google')
export class GoogleWebhookController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
  ) {}

  @Post('gmail/webhook')
  async gmailWebhook(
    @Headers('x-user-id') xUserId: string,
    @Body() body: WebhookBody,
  ) {
    return this.handleWebhook(body, xUserId);
  }

  @Post('calendar/webhook')
  async calendarWebhook(
    @Headers('x-user-id') xUserId: string,
    @Body() body: WebhookBody,
  ) {
    return this.handleWebhook(body, xUserId);
  }

  private async handleWebhook(body: WebhookBody, xUserId?: string) {
    const workspaceId = body.workspace_id;
    const userId = body.user_id ?? xUserId;
    const agentId = body.agent_id;
    const prompt = body.prompt;

    if (!workspaceId || !userId || !agentId || !prompt) {
      return {
        status: 'skipped',
        reason:
          'Thiếu workspace_id/user_id/agent_id/prompt trong webhook payload.',
      };
    }

    const gate = await this.usersService.getExecutorIntegrationsGate(userId);
    // Nếu event thuộc về gmail nhưng user chưa bật/không hợp lệ
    // Hiện tại controller dùng chung, nhưng ta có thể check chung
    if (!gate.connections['gmail']?.connected && !gate.connections['google_calendar']?.connected) {
      return {
        status: 'skipped',
        reason: 'User chưa bật hoặc cấu hình Google Integration bị lỗi.',
      };
    }

    // MVP: tạo task instance mới ở draft_ready.
    return this.tasksService.create(userId, {
      workspace_id: workspaceId,
      agent_id: agentId,
      title: body.title ?? `Webhook ${body.event_id ?? 'event'}`,
      description: prompt,
      status: 'draft_ready',
      schedule_enabled: false,
      thread_id: body.thread_id,
    } as any);
  }
}

