/**
 * Cắt văn bản thành các chunk ngữ nghĩa:
 * - Ưu tiên cắt tại ranh giới đoạn văn (blank line)
 * - Fallback: cắt tại ranh giới câu (dấu chấm, !, ?)
 * - Fallback cuối: cắt tại khoảng trắng
 * - Có overlap để đảm bảo ngữ cảnh liên tục giữa các chunk
 */

/** Làm sạch văn bản đầu vào trước khi chunk. */
function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Loại bỏ control chars (giữ lại \n và \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Thu gọn nhiều dòng trắng thành tối đa 2 dòng
    .replace(/\n{3,}/g, '\n\n')
    // Thu gọn spaces/tab thừa trên cùng một dòng (không touch newline)
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Cắt chuỗi tại vị trí "tốt nhất" trong khoảng [start, end]:
 * đoạn văn → câu → từ → ký tự.
 */
function findSplitPoint(text: string, start: number, end: number): number {
  if (end >= text.length) return text.length;

  const window = text.slice(start, end);

  // Ưu tiên 1: cắt tại ranh giới đoạn văn (double newline)
  const parasplit = window.lastIndexOf('\n\n');
  if (parasplit > 0) return start + parasplit + 2;

  // Ưu tiên 2: cắt tại newline đơn
  const newline = window.lastIndexOf('\n');
  if (newline > Math.floor(window.length * 0.4)) return start + newline + 1;

  // Ưu tiên 3: cắt sau dấu câu kết thúc (. ! ? …) + khoảng trắng
  const sentenceEnd = window.search(
    /[.!?。！？…]\s+(?=[A-ZÁÉÍÓÚÀÂÃÊÔÕÇ\u00C0-\u017E\u1EA0-\u1EF9\d"])/,
  );
  // Tìm lần cuối cùng thay vì lần đầu
  const matches = [...window.matchAll(/[.!?。！？…]\s+/g)];
  if (matches.length > 0) {
    // Lấy match sau điểm 40% trở về sau
    const threshold = Math.floor(window.length * 0.4);
    const valid = matches.filter((m) => (m.index ?? 0) >= threshold);
    if (valid.length > 0) {
      const last = valid[valid.length - 1];
      return start + (last.index ?? 0) + last[0].length;
    }
  }
  void sentenceEnd;

  // Ưu tiên 4: cắt tại khoảng trắng
  const spaceIdx = window.lastIndexOf(' ');
  if (spaceIdx > Math.floor(window.length * 0.4)) return start + spaceIdx + 1;

  // Fallback: cắt cứng
  return end;
}

/**
 * Cắt văn bản thành chunk với kích thước tối đa (ký tự) và overlap.
 * Tôn trọng ranh giới đoạn văn và câu.
 */
export function chunkText(
  text: string,
  maxChars: number,
  overlap: number,
): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  // Nếu toàn bộ text nhỏ hơn maxChars → trả về 1 chunk
  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const safeOverlap = Math.min(overlap, Math.max(0, Math.floor(maxChars / 3)));
  const out: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const targetEnd = Math.min(start + maxChars, normalized.length);
    const splitAt = findSplitPoint(normalized, start, targetEnd);

    const chunk = normalized.slice(start, splitAt).trim();
    if (chunk) {
      out.push(chunk);
    }

    if (splitAt >= normalized.length) break;

    // Overlap: lùi lại safeOverlap ký tự, nhưng không quay về trước start
    start = Math.max(start + 1, splitAt - safeOverlap);
  }

  return out;
}

/**
 * Chia một chuỗi thành nhiều đoạn, mỗi đoạn tối đa `maxWords` từ (theo khoảng trắng),
 * dùng trước khi gọi Gemini embed khi cần giới hạn theo từ.
 */
export function splitTextByMaxWords(
  text: string,
  maxWords: number,
): string[] {
  const t = text.trim();
  if (!t) return [];
  const words = t.split(/\s+/).filter(Boolean);
  if (maxWords < 1) return [t];
  if (words.length <= maxWords) {
    return [t];
  }
  const out: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    out.push(words.slice(i, i + maxWords).join(' '));
  }
  return out;
}
