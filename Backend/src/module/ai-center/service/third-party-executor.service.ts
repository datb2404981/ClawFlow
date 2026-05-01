import { Injectable } from '@nestjs/common';
import { GmailConnectorService } from './connectors/gmail-connector.service';
import { CalendarConnectorService } from './connectors/calendar-connector.service';
import { DriveConnectorService } from './connectors/drive-connector.service';
import { NotionConnectorService } from './connectors/notion-connector.service';

@Injectable()
export class ThirdPartyExecutorService {
  constructor(
    private readonly gmail: GmailConnectorService,
    private readonly calendar: CalendarConnectorService,
    private readonly drive: DriveConnectorService,
    private readonly notion: NotionConnectorService,
  ) {}

  async executeActionPlanMvp(
    actionPlan: any,
    idempotencyKey: string,
    integrationsGate: {
      providerStatusString: string;
      connections: Record<string, any>;
    },
  ): Promise<{ executeResultText: string; executionLog: string }> {
    const actions: any[] = Array.isArray(actionPlan?.actions)
      ? actionPlan.actions
      : [];

    const executed: any[] = [];
    const results: string[] = [];

    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      const type = String(a?.type ?? a?.action_type ?? 'unknown');

      try {
        let r: { resultText: string } | null = null;
        if (type === 'gmail_send') {
          const conn = integrationsGate.connections['gmail'];
          if (!conn?.connected || !conn?.access_token) {
            const reason = 'Chưa kết nối Gmail hoặc thiếu token';
            executed.push({ index: i, type, status: 'skipped_disabled', reason });
            results.push(`SKIPPED: Gmail integration (${reason})`);
            continue;
          }
          r = await this.gmail.sendEmailDraft(a, conn.access_token);
        } else if (type === 'calendar_create') {
          const conn = integrationsGate.connections['google_calendar'];
          if (!conn?.connected || !conn?.access_token) {
            const reason = 'Chưa kết nối Google Calendar hoặc thiếu token';
            executed.push({ index: i, type, status: 'skipped_disabled', reason });
            results.push(`SKIPPED: Google Calendar integration (${reason})`);
            continue;
          }
          r = await this.calendar.createCalendarEvent(a, conn.access_token);
        } else if (type === 'drive_upload') {
          const conn = integrationsGate.connections['google_drive'];
          if (!conn?.connected || !conn?.access_token) {
            const reason = 'Chưa kết nối Google Drive hoặc thiếu token';
            executed.push({ index: i, type, status: 'skipped_disabled', reason });
            results.push(`SKIPPED: Google Drive integration (${reason})`);
            continue;
          }
          r = await this.drive.uploadFile(a, conn.access_token);
        } else if (type === 'notion_update') {
          const conn = integrationsGate.connections['notion'];
          if (!conn?.connected || !conn?.access_token) {
            const reason = 'Chưa kết nối Notion hoặc thiếu token';
            executed.push({ index: i, type, status: 'skipped_disabled', reason });
            results.push(`SKIPPED: Notion integration (${reason})`);
            continue;
          }
          r = await this.notion.upsertPage(a, conn.access_token);
        } else {
          r = { resultText: `Action ${type} (không rõ handler)` };
        }

        results.push(r.resultText);
        executed.push({ index: i, type, status: 'ok' });
      } catch (e) {
        executed.push({
          index: i,
          type,
          status: 'failed',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const executionLog = JSON.stringify({
      mode: 'MVP_SIMULATED',
      idempotencyKey,
      executedAt: new Date().toISOString(),
      actions: actions.map((a) => ({ type: a?.type ?? a?.action_type ?? 'unknown' })),
      executed,
    });

    const executeResultText = results.length
      ? `Đã approve và mô phỏng thực thi ${actions.length} action(s).\n${results.join('\n')}`
      : 'Đã approve. (Không có action trong draft payload.)';

    return { executeResultText, executionLog };
  }

  async executeSingleAction(
    action: any,
    integrationsGate: {
      providerStatusString: string;
      connections: Record<string, any>;
    },
  ): Promise<{ resultText: string }> {
    const type = String(action?.type ?? action?.action_type ?? 'unknown');

    if (type === 'gmail_send' || type === 'reply_email') {
      const conn = integrationsGate.connections['gmail'];
      if (!conn?.connected || !conn?.access_token) {
        throw new Error('Chưa kết nối Gmail hoặc thiếu token');
      }
      return await this.gmail.sendEmailDraft(action, conn.access_token);
    } 
    
    if (type === 'calendar_create' || type === 'create_calendar_event') {
      const conn = integrationsGate.connections['google_calendar'];
      if (!conn?.connected || !conn?.access_token) {
        throw new Error('Chưa kết nối Google Calendar hoặc thiếu token');
      }
      return await this.calendar.createCalendarEvent(action, conn.access_token);
    }

    if (type === 'drive_upload') {
      const conn = integrationsGate.connections['google_drive'];
      if (!conn?.connected || !conn?.access_token) {
        throw new Error('Chưa kết nối Google Drive hoặc thiếu token');
      }
      return await this.drive.uploadFile(action, conn.access_token);
    }

    if (type === 'notion_update') {
      const conn = integrationsGate.connections['notion'];
      if (!conn?.connected || !conn?.access_token) {
        throw new Error('Chưa kết nối Notion hoặc thiếu token');
      }
      return await this.notion.upsertPage(action, conn.access_token);
    }

    throw new Error(`Không hỗ trợ action type: ${type}`);
  }
}

