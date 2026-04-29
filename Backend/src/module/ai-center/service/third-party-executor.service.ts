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
    integrationsEnabled: {
      gmail_send: boolean
      calendar_create: boolean
      drive_upload: boolean
      notion_update: boolean
      reasons?: Record<string, string>
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
          if (!integrationsEnabled.gmail_send) {
            const reason = integrationsEnabled.reasons?.gmail_send ?? 'disabled_or_not_connected';
            executed.push({ index: i, type, status: 'skipped_disabled', reason });
            results.push(`SKIPPED: Gmail integration (${reason})`);
            continue;
          }
          r = await this.gmail.sendEmailDraft(a);
        } else if (type === 'calendar_create') {
          if (!integrationsEnabled.calendar_create) {
            const reason =
              integrationsEnabled.reasons?.calendar_create ?? 'disabled_or_not_connected';
            executed.push({ index: i, type, status: 'skipped_disabled', reason });
            results.push(`SKIPPED: Google Calendar integration (${reason})`);
            continue;
          }
          r = await this.calendar.createCalendarEvent(a);
        } else if (type === 'drive_upload') {
          if (!integrationsEnabled.drive_upload) {
            const reason = integrationsEnabled.reasons?.drive_upload ?? 'disabled_or_not_connected';
            executed.push({ index: i, type, status: 'skipped_disabled', reason });
            results.push(`SKIPPED: Google Drive integration (${reason})`);
            continue;
          }
          r = await this.drive.uploadFile(a);
        } else if (type === 'notion_update') {
          if (!integrationsEnabled.notion_update) {
            const reason = integrationsEnabled.reasons?.notion_update ?? 'disabled_or_not_connected';
            executed.push({ index: i, type, status: 'skipped_disabled', reason });
            results.push(`SKIPPED: Notion integration (${reason})`);
            continue;
          }
          r = await this.notion.upsertPage(a);
        } else {
          r = { resultText: `MVP_SIMULATED: Action ${type} (unknown handler)` };
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
}

