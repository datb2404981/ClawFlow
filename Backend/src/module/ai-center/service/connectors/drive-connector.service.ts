import { Injectable } from '@nestjs/common';

@Injectable()
export class DriveConnectorService {
  async uploadFile(action: any): Promise<{ resultText: string }> {
    // MVP placeholder: gắn Google Drive API thật ở to-do tiếp theo.
    const name = String(action?.payload?.name ?? action?.payload?.fileName ?? '');
    return {
      resultText: `MVP_SIMULATED: Drive upload${name ? ` → ${name}` : ''}`,
    };
  }
}

