import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Google AI (Generative Language API): dùng `gemini-embedding-001` cho `embedContent`.
 * `text-embedding-004` / `embedding-001` — tên cũ hoặc Vertex-only — hay 404 trên AI Studio.
 */
const DEFAULT_MODEL = 'gemini-embedding-001';
const DEFAULT_DIM = 768;

/** Map tên model trong .env cũ → id hợp lệ cho v1beta embedContent. */
function resolveEmbeddingModel(raw: string, log: Logger): string {
  let m = raw.replace(/^\s+|\s+$/g, '');
  if (m.startsWith('models/')) {
    m = m.slice('models/'.length);
  }
  const aliases: Record<string, string> = {
    'text-embedding-004': DEFAULT_MODEL,
    'text-embedding-005': DEFAULT_MODEL,
    'embedding-001': DEFAULT_MODEL,
  };
  const to = aliases[m];
  if (to && to !== m) {
    log.warn(`GEMINI_EMBEDDING_MODEL=${m} → ${to} (id hợp lệ cho Google AI embedContent).`);
    m = to;
  }
  return m;
}

const GEMINI_EMBED_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

export const EMBEDDING_DIMENSION = DEFAULT_DIM;

const RETRY_DELAY_BASE_MS = 2000;
const MAX_RETRIES = 10;
/** Tối đa số câu request trong một lần gọi batchEmbedContents (giới hạn API ~100). */
const BATCH_EMBED_MAX = 30;

@Injectable()
export class GeminiEmbeddingService {
  private readonly logger = new Logger(GeminiEmbeddingService.name);
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly embeddingDim: number;

  constructor(config: ConfigService) {
    const fromEnv =
      config.get<string>('GEMINI_EMBEDDING_MODEL')?.trim() || DEFAULT_MODEL;
    this.model = resolveEmbeddingModel(fromEnv, this.logger);

    this.apiKey = config.get<string>('GEMINI_API_KEY')?.trim() || undefined;

    const d = config.get<string>('GEMINI_EMBEDDING_DIMENSION')?.trim();
    const n = d ? Number(d) : DEFAULT_DIM;
    this.embeddingDim = Number.isFinite(n) && n > 0 ? n : DEFAULT_DIM;
  }

  assertReady(): void {
    if (this.apiKey) return;
    throw new ServiceUnavailableException(
      'Thiếu GEMINI_API_KEY (Google AI) cho embedding knowledge.',
    );
  }

  private buildUrl(path: 'embedContent' | 'batchEmbedContents'): string {
    return `${GEMINI_EMBED_BASE}/${this.model}:${path}?key=${encodeURIComponent(
      this.apiKey ?? '',
    )}`;
  }

  private parseEmbeddingValues(
    data: { embedding?: { values?: number[] }; values?: number[] },
  ): number[] {
    const v = data.embedding?.values ?? data.values;
    if (!Array.isArray(v) || v.length === 0) {
      throw new Error('Gemini embed: thiếu mảng values');
    }
    if (v.length !== this.embeddingDim) {
      throw new Error(
        `Gemini embed: kích thước ${v.length} (cần ${this.embeddingDim} — kiểm tra GEMINI_EMBEDDING_MODEL / GEMINI_EMBEDDING_DIMENSION)`,
      );
    }
    return v;
  }

  private async postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini ${res.status}: ${errText}`);
    }
    return (await res.json()) as T;
  }

  private async batchEmbed(
    parts: { text: string }[],
  ): Promise<number[][]> {
    if (parts.length === 0) return [];
    this.assertReady();
    if (parts.length === 1) {
      const text = parts[0]?.text ?? '';
      const data = await this.postJson<{
        embedding?: { values?: number[] };
      }>(this.buildUrl('embedContent'), {
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: this.embeddingDim,
      });
      return [this.parseEmbeddingValues({ embedding: data.embedding })];
    }
    const data = await this.postJson<{
      embeddings?: { values?: number[] }[];
    }>(this.buildUrl('batchEmbedContents'), {
      requests: parts.map((p) => ({
        model: `models/${this.model}`,
        content: { parts: [p] },
        taskType: 'RETRIEVAL_DOCUMENT' as const,
        outputDimensionality: this.embeddingDim,
      })),
    });
    const rows = data.embeddings;
    if (!rows || rows.length !== parts.length) {
      throw new Error('Gemini batchEmbedContents: số phản hồi không khớp');
    }
    return rows.map((row) => this.parseEmbeddingValues({ values: row.values }));
  }

  /**
   * Nhúng từng chuỗi (mỗi chuỗi nên ≤ `GEMINI_EMBEDDING_MAX_WORDS` từ — tách ở ingest nếu dài hơn).
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    this.assertReady();
    if (texts.length === 0) return [];

    const out: number[][] = [];
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAY_BASE_MS * attempt;
        this.logger.warn(
          `Gemini embed retry ${attempt}/${MAX_RETRIES - 1}, chờ ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        out.length = 0;
        for (let i = 0; i < texts.length; i += BATCH_EMBED_MAX) {
          const batch = texts.slice(i, i + BATCH_EMBED_MAX);
          const part = await this.batchEmbed(
            batch.map((t) => ({ text: t.replace(/\n/g, ' ') })),
          );
          out.push(...part);
        }
        if (out.length !== texts.length) {
          throw new Error(
            `Số vector (${out.length}) != số text (${texts.length})`,
          );
        }
        return out;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        const msg = lastErr.message.toLowerCase();
        const mayRetry =
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('500') ||
          msg.includes('resource') ||
          msg.includes('etimedout') ||
          msg.includes('fetch failed');
        if (mayRetry && attempt < MAX_RETRIES - 1) {
          if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted')) {
            const match = msg.match(/retry in ([\d\.]+)s/);
            const waitTime = match ? Math.ceil(parseFloat(match[1])) * 1000 : 15000;
            this.logger.warn(`Gemini 429 Rate Limit. Tự động chờ ${waitTime}ms trước khi thử lại...`);
            await new Promise((r) => setTimeout(r, waitTime + 1000));
          }
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr ?? new Error('Gemini embedding thất bại sau nhiều lần thử');
  }

  async embedOne(text: string): Promise<number[]> {
    const rows = await this.embedTexts([text]);
    const r = rows[0];
    if (r === undefined) {
      throw new Error('Gemini embedding: rỗng');
    }
    return r;
  }
}
