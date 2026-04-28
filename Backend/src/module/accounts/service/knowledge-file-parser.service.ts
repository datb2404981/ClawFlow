import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { extname } from 'node:path';
import { extractAllPdfText } from '../lib/pdf-knowledge-extract';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
};

@Injectable()
export class KnowledgeFileParserService {
  private readonly logger = new Logger(KnowledgeFileParserService.name);

  async parseBuffer(buffer: Buffer, originalName: string): Promise<string> {
    const ext = (extname(originalName) || '').toLowerCase();

    if (!buffer || buffer.length === 0) {
      throw new BadRequestException(`File "${originalName}" rỗng (0 bytes).`);
    }

    this.logger.log(
      `Parsing "${originalName}" (${ext}, ${buffer.length} bytes)`,
    );

    if (ext === '.txt') {
      return this.parseTxt(buffer);
    }
    if (ext === '.pdf') {
      return this.parsePdf(buffer, originalName);
    }
    if (ext === '.docx') {
      return this.parseDocx(buffer, originalName);
    }
    if (ext === '.doc') {
      throw new BadRequestException(
        `Định dạng ".doc" (Word 97-2003) chưa hỗ trợ. Hãy lưu lại dưới dạng ".docx" trước khi upload.`,
      );
    }

    throw new BadRequestException(
      `Định dạng chưa hỗ trợ: "${ext || 'không rõ'}". Hỗ trợ: .txt, .pdf, .docx`,
    );
  }

  /** Parse plain text, tự detect encoding UTF-8 / Latin-1. */
  private parseTxt(buffer: Buffer): string {
    // Thử UTF-8 trước
    try {
      const text = buffer.toString('utf8');
      // Nếu có replacement char (\uFFFD) nhiều → thử latin1
      const badChars = (text.match(/\uFFFD/g) ?? []).length;
      if (badChars > 5) {
        return buffer.toString('latin1').trim();
      }
      return text.trim();
    } catch {
      return buffer.toString('latin1').trim();
    }
  }

  /** Parse PDF với 3 tầng: pdf-parse → PDF.js text layer → OCR. */
  private async parsePdf(
    buffer: Buffer,
    originalName: string,
  ): Promise<string> {
    try {
      const text = await extractAllPdfText(buffer);
      this.logger.log(
        `PDF "${originalName}": extracted ${text.length} chars`,
      );
      return text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`PDF parse failed "${originalName}": ${msg}`);
      throw new BadRequestException(
        `Không thể đọc nội dung file PDF "${originalName}": ${msg}`,
      );
    }
  }

  /**
   * Parse DOCX:
   * - Dùng convertToMarkdown để giữ cấu trúc: heading, list, bảng, in đậm/nghiêng.
   * - Fallback về extractRawText nếu markdown trống.
   */
  private async parseDocx(
    buffer: Buffer,
    originalName: string,
  ): Promise<string> {
    try {
      // Tầng 1: Markdown — giữ cấu trúc đoạn, list, heading
      const mdResult = await mammoth.convertToMarkdown({ buffer });

      // Log cảnh báo từ mammoth (font lạ, style không hỗ trợ, v.v.)
      for (const msg of mdResult.messages ?? []) {
        if (msg.type === 'warning') {
          this.logger.warn(`mammoth [${originalName}]: ${msg.message}`);
        }
      }

      let text = (mdResult.value ?? '').trim();

      if (text.length < 20) {
        // Tầng 2 fallback: extractRawText
        this.logger.warn(
          `DOCX "${originalName}": markdown quá ngắn (${text.length} chars), fallback về extractRawText`,
        );
        const rawResult = await mammoth.extractRawText({ buffer });
        const raw = (rawResult.value ?? '').trim();
        if (raw.length > text.length) {
          text = raw;
        }
      }

      // Làm sạch output markdown:
      // Xóa các dòng chỉ có dấu gạch ngang / ký hiệu markdown thừa
      text = text
        .replace(/^[-*_]{3,}$/gm, '')           // Horizontal rules
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')             // Thu gọn dòng trắng
        .replace(/[ \t]+/g, ' ')               // Thu gọn spaces thừa
        .trim();

      this.logger.log(
        `DOCX "${originalName}": extracted ${text.length} chars`,
      );
      return text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`DOCX parse failed "${originalName}": ${msg}`);
      throw new BadRequestException(
        `Không thể đọc nội dung file DOCX "${originalName}": ${msg}`,
      );
    }
  }
}
