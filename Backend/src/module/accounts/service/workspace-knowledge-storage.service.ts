import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class WorkspaceKnowledgeStorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | null;

  constructor(config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID')?.trim() ?? '';
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID')?.trim() ?? '';
    const secretAccessKey =
      config.get<string>('R2_SECRET_ACCESS_KEY')?.trim() ?? '';
    const bucket = config.get<string>('R2_BUCKET')?.trim() ?? '';
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      this.client = null;
      this.bucket = null;
      return;
    }
    this.bucket = bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  assertReady(): void {
    if (this.client && this.bucket) return;
    throw new ServiceUnavailableException(
      'Lưu trữ knowledge (R2) chưa cấu hình. Đặt đủ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET trong .env (xem .env.example).',
    );
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string | undefined,
  ): Promise<void> {
    this.assertReady();
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    this.assertReady();
    await this.client!.send(
      new DeleteObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      }),
    );
  }

  /**
   * Đọc object theo key (R2, S3-compatible).
   * Guard: nếu R2 trả về HTML error page (403/404/503) thay vì file thực,
   * throw lỗi rõ ràng thay vì để parser báo "Unexpected token '<'".
   */
  async getObjectBuffer(key: string): Promise<Buffer> {
    this.assertReady();
    const res = await this.client!.send(
      new GetObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      }),
    );
    const body = res.Body;
    if (!body) {
      return Buffer.alloc(0);
    }
    const buf = Buffer.from(await body.transformToByteArray());

    // Phát hiện HTML error page từ R2/S3 (403, 404, 503…)
    const prefix = buf.subarray(0, 100).toString('utf8').trimStart();
    if (prefix.startsWith('<!DOCTYPE') || prefix.startsWith('<html') || prefix.startsWith('<?xml')) {
      const snippet = buf.toString('utf8').slice(0, 300);
      throw new Error(
        `R2 trả về HTML thay vì file (key="${key}"). ` +
        `Kiểm tra lại R2_BUCKET, credentials, và key có tồn tại không. ` +
        `Response snippet: ${snippet}`,
      );
    }

    return buf;
  }
}
