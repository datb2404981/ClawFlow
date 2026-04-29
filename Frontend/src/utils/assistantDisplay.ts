/**
 * Chuẩn hoá hiển thị tin assistant: tách <thought> (mọi biến thể, đồng bộ AI_Core/Utils/text_sanitize.py),
 * bỏ PASS/FAIL dính cuối (echo reviewer).
 */

const THOUGHT_FULL = /<thought[^>]*>([\s\S]*?)<\/thought>/gi

/** Vị trí ký tự ngay sau thẻ mở `<thought...>` hoặc `<thoughtXxx` không có `>`. */
function indexAfterThoughtOpen(s: string, startIdx: number): number {
  const sub = s.slice(startIdx)
  const withGt = sub.match(/^<thought[^>]*>/i)
  if (withGt) return startIdx + withGt[0].length
  const noGt = sub.match(/^<thought\w*/i)
  if (noGt) return startIdx + noGt[0].length
  return startIdx + '<thought'.length
}

/**
 * Tách và gỡ khối thought (logic tương đương strip_thought Python).
 * Trả về phần còn lại là body + mảng nội dung suy nghĩ đã trích.
 */
function stripThoughtCollecting(raw: string): { body: string; thoughts: string[] } {
  const thoughts: string[] = []
  let cleaned = raw.replace(THOUGHT_FULL, (_m, inner: string) => {
    const t = String(inner).trim()
    if (t) thoughts.push(t)
    return ''
  })

  if (/<thought/i.test(cleaned) && !/<\/thought>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<thought[^>]*>[\s\S]*/i, (block) => {
      const inner = block.replace(/^<thought[^>]*>/i, '').trimEnd()
      if (inner) thoughts.push(inner)
      return ''
    })
  }

  for (;;) {
    const lower = cleaned.toLowerCase()
    const idx = lower.indexOf('<thought')
    if (idx === -1) break
    const endTag = lower.indexOf('</thought>', idx)
    if (endTag !== -1) {
      const innerStart = indexAfterThoughtOpen(cleaned, idx)
      const inner = cleaned.slice(innerStart, endTag).trim()
      if (inner) thoughts.push(inner)
      cleaned = (cleaned.slice(0, idx) + cleaned.slice(endTag + '</thought>'.length)).trim()
      continue
    }
    const chunk = cleaned.slice(idx)
    const dbl = chunk.indexOf('\n\n')
    if (dbl !== -1) {
      const inner = chunk.slice(0, dbl).trim()
      if (inner) thoughts.push(inner)
      cleaned = (cleaned.slice(0, idx) + chunk.slice(dbl + 2)).trimStart()
      continue
    }
    cleaned = cleaned.slice(0, idx).trimEnd()
    break
  }

  const lower = cleaned.toLowerCase()
  const closeIdx = lower.lastIndexOf('</thought>')
  if (closeIdx !== -1) {
    cleaned = cleaned.slice(closeIdx + '</thought>'.length)
  }

  return { body: cleaned.trim(), thoughts }
}

/** Giống logic strip_thought phía Python — tách thought / body cho UI. */
export function extractThoughtAndBody(raw: string): { body: string; thought: string | null } {
  const trimmed = raw ?? ''
  if (!trimmed) return { body: '', thought: null }

  const { body: stripped, thoughts } = stripThoughtCollecting(trimmed)
  const body = stripTrailingReviewMarkers(stripped)
  const thought = thoughts.length ? thoughts.join('\n\n·\n\n') : null
  return { body, thought }
}

export function stripTrailingReviewMarkers(text: string): string {
  let t = (text || '').replace(/\r\n/g, '\n').trimEnd()
  if (!t) return t
  for (let i = 0; i < 6; i++) {
    const before = t
    t = t.replace(/\.PASS\s*$/i, '')
    t = t.replace(/\.FAIL\s*$/i, '')
    t = t.replace(/\n+\s*PASS\s*$/i, '')
    t = t.replace(/\n+\s*FAIL\s*$/i, '')
    t = t.replace(/[ \t]+PASS\s*$/i, '')
    t = t.replace(/[ \t]+FAIL\s*$/i, '')
    t = t.trimEnd()
    if (t === before) break
  }
  return t
}
