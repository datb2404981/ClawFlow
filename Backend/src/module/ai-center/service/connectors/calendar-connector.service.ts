import { Injectable } from '@nestjs/common';

@Injectable()
export class CalendarConnectorService {
  async createCalendarEvent(action: any, accessToken: string): Promise<{ resultText: string }> {
    const title = String(action?.payload?.summary ?? action?.payload?.title ?? action?.title ?? 'Sự kiện mới');
    const start = String(action?.payload?.startTime ?? action?.startTime ?? '');
    const end = String(action?.payload?.endTime ?? action?.endTime ?? '');
    const description = String(action?.payload?.description ?? action?.description ?? '');

    if (!start || !end) {
      throw new Error('Thiếu thời gian bắt đầu hoặc kết thúc cho sự kiện lịch.');
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error(
        `Định dạng thời gian không hợp lệ. AI gửi: start="${start}", end="${end}". ` +
        `Vui lòng sử dụng định dạng ISO 8601 (VD: 2026-05-15T14:00:00+07:00).`
      );
    }

    const event = {
      summary: title,
      description: description,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
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
        const detail = data.error?.message || JSON.stringify(data);
        throw new Error(`Google Calendar API báo lỗi: ${detail}`);
      }
      return {
        resultText: `Đã tạo sự kiện lịch "${title}" thành công (Link: ${data.htmlLink})`,
      };
    } catch (error) {
      throw new Error(`Lỗi hệ thống khi tạo sự kiện: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

