import { Injectable } from '@nestjs/common';

@Injectable()
export class DriveConnectorService {
  async uploadFile(action: any, accessToken: string): Promise<{ resultText: string }> {
    const name = String(action?.payload?.name ?? action?.payload?.fileName ?? 'Tài liệu mới');
    const content = String(action?.payload?.content ?? action?.payload?.text ?? '');
    
    // Tạo metadata cho Google Doc
    const metadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.document',
    };

    try {
      if (content) {
        // Upload Multipart (nếu có nội dung)
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
          content +
          closeDelimiter;

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Lỗi upload Drive');
        return {
          resultText: `Đã tạo tài liệu "${name}" trên Google Drive thành công (ID: ${data.id})`,
        };
      } else {
        // Chỉ tạo file trống
        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Lỗi tạo file Drive');
        return {
          resultText: `Đã tạo tài liệu "${name}" (trống) trên Google Drive (ID: ${data.id})`,
        };
      }
    } catch (error) {
      throw new Error(`Lỗi gọi Google Drive API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

