import { Injectable } from '@nestjs/common';

@Injectable()
export class GmailConnectorService {
  async sendEmailDraft(action: any, accessToken: string): Promise<{ resultText: string }> {
    const to = String(action?.payload?.to ?? action?.to ?? '');
    const subject = String(action?.payload?.subject ?? action?.subject ?? '');
    const body = String(action?.payload?.body ?? action?.body ?? '');

    if (!to) {
      throw new Error('Thiếu địa chỉ người nhận (to).');
    }

    // Construct raw email according to RFC 2822
    const emailLines = [
      `To: ${to}`,
      `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'Content-Type: text/html; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      body,
    ];
    
    const rawEmail = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''); // base64url encoding

    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Lỗi gửi email.');
      }
      return {
        resultText: `Đã gửi email thành công tới ${to} (Message ID: ${data.id})`,
      };
    } catch (error) {
      throw new Error(`Lỗi gọi Gmail API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

