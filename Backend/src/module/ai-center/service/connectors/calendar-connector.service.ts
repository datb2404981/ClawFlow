import { Injectable } from '@nestjs/common';

@Injectable()
export class CalendarConnectorService {
  async createCalendarEvent(action: any, accessToken: string): Promise<{ resultText: string }> {
    const title = String(action?.payload?.summary ?? action?.payload?.title ?? action?.title ?? 'Sự kiện mới');
    const start = String(action?.payload?.startTime ?? action?.startTime ?? '');
    const end = String(action?.payload?.endTime ?? action?.endTime ?? '');
    const description = String(action?.payload?.description ?? action?.description ?? '');

    if (!start || !end) {
      throw new Error('Thiếu thời gian bắt đầu hoặc kết thúc.');
    }

    const event = {
      summary: title,
      description: description,
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() },
    };

    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Lỗi tạo sự kiện lịch.');
      }
      return {
        resultText: `Đã tạo sự kiện lịch "${title}" thành công (Link: ${data.htmlLink})`,
      };
    } catch (error) {
      throw new Error(`Lỗi gọi Google Calendar API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

