import { Injectable } from '@nestjs/common';

@Injectable()
export class CalendarConnectorService {
  async createCalendarEvent(action: any): Promise<{ resultText: string }> {
    // MVP placeholder: gắn Google Calendar API thật ở to-do tiếp theo.
    const summary = String(action?.payload?.summary ?? action?.payload?.title ?? '');
    return {
      resultText: `MVP_SIMULATED: Calendar create event${summary ? ` → ${summary}` : ''}`,
    };
  }
}

