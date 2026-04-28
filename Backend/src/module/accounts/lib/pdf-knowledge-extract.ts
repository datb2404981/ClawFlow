import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { createCanvas } from '@napi-rs/canvas';

/**
 * PDF.js trên Node mặc định dùng `NodeCanvasFactory` gọi gói `canvas` (node-canvas).
 * Nếu không cài gói đó, node_modules/pdfjs sẽ lỗi: Cannot read ... 'createCanvas'.
 * Cung cấp factory từ @napi-rs/canvas để không phụ thuộc `canvas` (prebuild Skia / ít cài lib hệ thống hơn).
 */
class NapiRsPdfCanvasFactory {
  #enableHWA = false;
  constructor(opts?: { enableHWA?: boolean }) {
    this.#enableHWA = opts?.enableHWA === true;
  }
  create(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
     
    const canvas: any = createCanvas(w, h);
     
    const context: any = canvas.getContext('2d', {
      willReadFrequently: !this.#enableHWA,
    });
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }
    return { canvas, context };
  }
  reset(
     
    canvasAndContext: { canvas: any; context: any },
    width: number,
    height: number,
  ) {
    if (!canvasAndContext.canvas) {
      throw new Error('Canvas is not specified');
    }
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
   
  destroy(canvasAndContext: { canvas: any; context: any }) {
    if (!canvasAndContext?.canvas) {
      return;
    }
    // PDF.js BaseCanvasFactory dùng width/height = 0 để “giải phóng”. @napi-rs/canvas
    // (Skia) tạo surface mới với 0x0 → lỗi: Create skia surface failed. Chỉ gỡ tham chiếu.
    canvasAndContext.context = null;
    canvasAndContext.canvas = null;
  }
}

function warn(msg: string) {
   
  console.warn(`[PdfKnowledgeExtract] ${msg}`);
}

function info(msg: string) {
   
  console.log(`[PdfKnowledgeExtract] ${msg}`);
}

/** Tối thiểu số ký tự văn bản tính là "có dữ liệu"; dưới mức này sẽ thử pdfjs rồi OCR. */
const MIN_MEANINGFUL_LEN = 80;

let workerSrcCache: string | null = null;

function resolveWorkerSrc(): string {
  if (workerSrcCache) return workerSrcCache;
  const r = createRequire(join(process.cwd(), 'package.json'));
  const workerPath = r.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  if (!existsSync(workerPath)) {
    throw new Error(`pdfjs worker not found: ${workerPath}`);
  }
  workerSrcCache = pathToFileURL(workerPath).href;
  return workerSrcCache;
}

const napiPdfCanvasFactory = new NapiRsPdfCanvasFactory();

export function isPdfTextWeak(text: string): boolean {
  // Loại bỏ whitespace và ký tự đặc biệt vô nghĩa trước khi đo độ dài
  const cleaned = (text ?? '')
    .replace(/[\s\x00-\x1F\x7F-\x9F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length < MIN_MEANINGFUL_LEN;
}

/** Tầng 1: pdf-parse — nhanh, tốt cho PDF có text layer rõ ràng. */
export async function extractPdfTextPdfParse(buffer: Buffer): Promise<string> {
  try {
    const res = await pdfParse(buffer);
    const text = (res.text ?? '')
      // Chuẩn hóa CRLF → LF
      .replace(/\r\n/g, '\n')
      // Loại bỏ null bytes và control chars (trừ newline/tab)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Thu gọn nhiều dòng trắng liên tiếp thành tối đa 2
      .replace(/\n{3,}/g, '\n\n')
      // Thu gọn spaces thừa trên cùng một dòng
      .replace(/[ \t]+/g, ' ')
      .trim();
    info(`pdf-parse: ${text.length} chars, ${res.numpages} pages`);
    return text;
  } catch (e) {
    warn(`pdf-parse failed: ${e instanceof Error ? e.message : String(e)}`);
    return '';
  }
}

/** Tầng 2: text layer bằng PDF.js — lấy được text mà pdf-parse bỏ sót, giữ cấu trúc dòng. */
export async function extractPdfTextPdfJs(buffer: Buffer): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  );
  GlobalWorkerOptions.workerSrc = resolveWorkerSrc();
  // Dùng new Uint8Array(buffer) để tạo bản COPY độc lập — tránh ArrayBuffer bị detach
  // khi PDF.js worker transfer ownership của ArrayBuffer gốc.
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
    // Tránh NodeCanvasFactory cần gói `canvas` (node-canvas) chưa cài
     
    canvasFactory: napiPdfCanvasFactory as any,
  }).promise;

  const pageTexts: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();

    // Nhóm các text items theo tọa độ Y (dòng) để giữ cấu trúc văn bản
    // Sắp xếp theo Y giảm dần (top → bottom trong PDF coordinate)
    const items = textContent.items.filter(
      (item): item is typeof item & { str: string; transform: number[] } =>
        item != null &&
        typeof item === 'object' &&
        'str' in item &&
        'transform' in item,
    );

    // Nhóm theo Y position với tolerance 2px
    const lines: Array<{ y: number; texts: string[] }> = [];
    for (const item of items) {
      const y = Math.round((item as { transform: number[] }).transform[5]);
      const str = String((item as { str: string }).str);
      if (!str.trim()) continue;

      const existing = lines.find((l) => Math.abs(l.y - y) < 3);
      if (existing) {
        existing.texts.push(str);
      } else {
        lines.push({ y, texts: [str] });
      }
    }

    // Sắp xếp top → bottom (Y lớn hơn = trên trong PDF)
    lines.sort((a, b) => b.y - a.y);
    const pageText = lines.map((l) => l.texts.join('')).join('\n');
    if (pageText.trim()) {
      pageTexts.push(pageText.trim());
    }
  }

  const result = pageTexts
    .join('\n\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  info(`PDF.js text layer: ${result.length} chars, ${doc.numPages} pages`);
  return result;
}

type PdfJsModule = {
  getDocument: (o: { data: Uint8Array; [k: string]: unknown }) => {
    promise: Promise<{
      numPages: number;
      getPage: (i: number) => Promise<{
        getViewport: (o: { scale: number }) => {
          width: number;
          height: number;
        };
        render: (o: {
          canvasContext: unknown;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
    }>;
  };
  GlobalWorkerOptions: { workerSrc: string };
};

/**
 * Tầng 3: render trang thành ảnh (Skia) + Tesseract OCR — xử lý PDF scan/ảnh.
 * Giới hạn số trang + scale để tránh tốn RAM/CPU.
 */
export async function extractPdfTextOcr(
  buffer: Buffer,
  options?: { maxPages?: number; scale?: number },
): Promise<string> {
  if (process.env.KNOWLEDGE_PDF_OCR === '0') {
    info('OCR bị tắt (KNOWLEDGE_PDF_OCR=0), bỏ qua.');
    return '';
  }

  const maxPages = Math.min(
    20,
    Math.max(
      1,
      options?.maxPages ??
        (Number(process.env.KNOWLEDGE_PDF_OCR_MAX_PAGES) || 10),
    ),
  );
  const scale = options?.scale ?? 2.0; // Tăng từ 1.75 → 2.0 để OCR rõ hơn

  const { getDocument, GlobalWorkerOptions } = (await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  )) as unknown as PdfJsModule;
  GlobalWorkerOptions.workerSrc = resolveWorkerSrc();
  // Tạo bản COPY độc lập — tránh ArrayBuffer bị detach bởi PDF.js worker
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
    // Bắt buộc khi gọi page.render() mà không cài gói `canvas` (node-canvas)
     
    canvasFactory: napiPdfCanvasFactory as any,
  }).promise;

  const n = Math.min(maxPages, doc.numPages);
  const langs =
    (process.env.KNOWLEDGE_PDF_OCR_LANGS ?? 'vie+eng').trim() || 'vie+eng';

  info(`OCR: xử lý ${n}/${doc.numPages} trang với ngôn ngữ "${langs}"`);

  const pieces: string[] = [];

  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale });
    const w = Math.ceil(vp.width);
    const h = Math.ceil(vp.height);

    // Giới hạn kích thước tối đa để tránh OOM
    const maxDim = 2400;
    const factor = w > 0 && h > 0 ? Math.min(1, maxDim / Math.max(w, h)) : 1;
    const vps =
      factor < 1
        ? page.getViewport({ scale: scale * factor })
        : page.getViewport({ scale });

    const canvas = createCanvas(Math.ceil(vps.width), Math.ceil(vps.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page
      .render({
         
        canvasContext: ctx as any,
        viewport: vps,
      })
      .promise;

    const png = canvas.toBuffer('image/png');
    try {
      const { data: ocrData } = await Tesseract.recognize(png, langs, {
        logger: () => undefined,
      });
      const pageText = (ocrData?.text ?? '').trim();
      if (pageText) {
        info(`OCR trang ${p}/${n}: ${pageText.length} chars`);
        pieces.push(pageText);
      }
    } catch (e) {
      warn(
        `OCR trang ${p}/${n} lỗi: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  const result = pieces
    .join('\n\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  info(`OCR hoàn tất: ${result.length} chars tổng`);
  return result;
}

/**
 * Hợp nhất 3 tầng: pdf-parse → PDF.js text layer → OCR.
 * Chuyển sang tầng tiếp theo chỉ khi kết quả quá yếu.
 */
export async function extractAllPdfText(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.length === 0) {
    warn('Buffer rỗng, bỏ qua parse.');
    return '';
  }

  // Tầng 1: pdf-parse
  let text = await extractPdfTextPdfParse(buffer);
  if (!isPdfTextWeak(text)) {
    return text;
  }
  info(`Tầng 1 yếu (${text.length} chars), thử PDF.js text layer...`);

  // Tầng 2: PDF.js
  try {
    const t2 = await extractPdfTextPdfJs(buffer);
    if (t2.length > text.length) {
      text = t2;
    }
  } catch (e) {
    warn(`PDF.js text layer: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!isPdfTextWeak(text)) {
    return text;
  }
  info(`Tầng 2 vẫn yếu (${text.length} chars), thử OCR...`);

  // Tầng 3: OCR
  try {
    const t3 = await extractPdfTextOcr(buffer);
    if (t3.length > (text?.length ?? 0)) {
      text = t3;
    }
  } catch (e) {
    warn(`OCR PDF: ${e instanceof Error ? e.message : String(e)}`);
  }

  return (text ?? '').trim();
}
