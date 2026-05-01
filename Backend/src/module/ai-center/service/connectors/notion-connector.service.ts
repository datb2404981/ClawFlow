import { Injectable } from '@nestjs/common';

@Injectable()
export class NotionConnectorService {
  async upsertPage(action: any, accessToken: string): Promise<{ resultText: string }> {
    const title = String(action?.payload?.title ?? action?.payload?.name ?? 'Trang mới');
    const content = String(action?.payload?.content ?? action?.payload?.text ?? '');
    const parentId = action?.payload?.parentId;

    if (!parentId) {
      return { resultText: `Thất bại: Lỗi cấu trúc Action. Cần cung cấp 'parentId' (ID của trang cha hoặc Database) để tạo trang Notion.` };
    }

    try {
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { page_id: parentId },
          properties: {
            title: [
              {
                text: { content: title },
              },
            ],
          },
          children: content ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: content } }],
              },
            },
          ] : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi gọi Notion API');
      
      return {
        resultText: `Đã tạo trang Notion "${title}" thành công (URL: ${data.url})`,
      };
    } catch (error) {
      throw new Error(`Lỗi gọi Notion API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

