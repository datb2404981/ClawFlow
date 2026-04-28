/**
 * Bổ sung khi tsc không resolve `node_modules` (Docker/volume) hoặc gói không kèm .d.ts.
 * Runtime: vẫn cần `mammoth` + `pdf-parse` trong dependencies và `npm install`.
 */
declare module 'pdf-parse' {
  const pdfParse: (
    data: Buffer,
  ) => Promise<{ text?: string; numpages?: number } & Record<string, unknown>>;
  export default pdfParse;
}

declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer }): Promise<{
    value: string;
  }>;
}
