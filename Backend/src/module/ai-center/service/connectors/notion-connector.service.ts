import { Injectable } from '@nestjs/common';

@Injectable()
export class NotionConnectorService {
  async upsertPage(action: any): Promise<{ resultText: string }> {
    // MVP placeholder: gắn Notion API thật ở to-do tiếp theo.
    const title = String(action?.payload?.title ?? action?.payload?.name ?? '');
    return {
      resultText: `MVP_SIMULATED: Notion update page${title ? ` → ${title}` : ''}`,
    };
  }
}

