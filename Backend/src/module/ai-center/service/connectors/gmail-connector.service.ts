import { Injectable } from '@nestjs/common';

@Injectable()
export class GmailConnectorService {
  async sendEmailDraft(action: any): Promise<{ resultText: string }> {
    // MVP placeholder: gắn Gmail API thật ở to-do tiếp theo.
    const to = String(action?.payload?.to ?? action?.to ?? '');
    return {
      resultText: `MVP_SIMULATED: Gmail send draft${to ? ` → ${to}` : ''}`,
    };
  }
}

