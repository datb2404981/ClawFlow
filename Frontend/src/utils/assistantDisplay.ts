/**
 * Chuẩn hoá hiển thị tin assistant: tách <thought> (mọi biến thể, đồng bộ AI_Core/Utils/text_sanitize.py),
 * bỏ PASS/FAIL dính cuối (echo reviewer).
 */

/** Bỏ khối suy nghĩ nội bộ model (thường tiếng Trung) — không phải nội dung trả user. */
export function stripModelInternalBlocks(text: string): string {
  let t = text ?? ''
  const lt = String.fromCharCode(60)
  const gt = String.fromCharCode(62)
  const bs = String.fromCharCode(92)
  // Qwen: khối think (backslash + thẻ think)
  const openThink = `${bs}${lt}think${gt}`
  const closeThink = `${bs}${lt}/think${gt}`
  t = t.replace(new RegExp(`${openThink}[\\s\\S]*?${closeThink}`, 'gis'), '')
  t = t.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '')
  t = t.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  return t
}

const THOUGHT_FULL = /<thought[^>]*>([\s\S]*?)<\/thought>/gi

/**
 * Model đôi khi gõ thiếu `>` sau `</thought` → dính chữ (vd `</thoughtChào`),
 * khiến regex không tách được và body bị lặp + lộ `PASS` dính cuối từ.
 */
export function normalizeThoughtTags(text: string): string {
  let s = text ?? ''
  s = s.replace(/<\/thought(?=[A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9\[])/gi, '</thought>\n\n')
  s = s.replace(/<\/thought>\s*<\/thought>/gi, '</thought>')
  return s
}

/** Gỡ đoạn body lặp lại hai lần liền nhau (model/ghép stream). */
function dedupeRepeatedBody(body: string): string {
  const t = (body || '').trim()
  if (t.length < 160) return t
  const half = Math.floor(t.length / 2)
  const a = t.slice(0, half).trim()
  const b = t.slice(half).trim()
  if (a.length < 80 || b.length < 80) return t
  if (a === b) return a
  const prefix = a.slice(0, Math.min(120, a.length))
  if (prefix.length >= 60 && b.startsWith(prefix)) return a
  return t
}

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

  // Chỉ gỡ thẻ đóng mồ côi ở ĐẦU chuỗi — tránh rfind("</thought>") xóa nhầm cả đoạn trả lời
  // khi model/user nhắc tới chữ "</thought>" trong nội dung.
  const lower2 = cleaned.toLowerCase()
  if (!lower2.includes('<thought')) {
    let s = cleaned
    while (/^\s*<\/thought>\s*/i.test(s)) {
      s = s.replace(/^\s*<\/thought>\s*/i, '')
    }
    cleaned = s
    // Còn `</thought>` mồ côi giữa chuỗi (thiếu thẻ mở) — gỡ để không lộ marker
    cleaned = cleaned.replace(/<\/thought>\s*/gi, '\n')
  }

  return { body: cleaned.trim(), thoughts }
}

/** Giống logic strip_thought phía Python — tách thought / body cho UI. */
export function extractThoughtAndBody(raw: string): { body: string; thought: string | null } {
  const trimmed = stripModelInternalBlocks(normalizeThoughtTags(raw ?? ''))
  if (!trimmed) return { body: '', thought: null }

  const { body: stripped, thoughts } = stripThoughtCollecting(trimmed)
  let body = dedupeRepeatedBody(stripTrailingReviewMarkers(stripped))
  let thought =
    thoughts.length > 0
      ? stripTrailingReviewMarkers(thoughts.join('\n\n')) || null
      : null

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  if (thought && body) {
    const nt = norm(thought)
    const nb = norm(body)
    if (
      nt === nb ||
      (nt.length > 50 && nb.includes(nt)) ||
      (nb.length > 50 && nt.includes(nb))
    ) {
      thought = null
      body = dedupeRepeatedBody(body)
    }
  }

  return { body, thought }
}

/** Khối echo reviewer: FAIL + Lý do (VI), 理由 + 建议 (ZH), !FAIL + Lý do — đồng bộ AI_Core text_sanitize. */
function stripFailLydoAndZhRubricEcho(text: string): string {
  let t = text || ''
  if (!t) return t
  const retry = String.raw`\n\n(?:Em xin|Em sẽ|Dựa trên thông tin)\b`
  const b = String.raw`(^|[^A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9_])`
  // JS không có \Z — dùng $ (cuối chuỗi) trong lookahead.
  // Non-greedy *?: nếu dùng * với (?=…|$) thì $ khớp cuối chuỗi và nuốt cả đoạn retry (Em xin…).
  const patViFail = new RegExp(
    String.raw`${b}!?\s*FAIL\s*\n+\s*Lý do:[\s\S]*?(?=${retry}|$)`,
    'gisu',
  )
  const patBangFail = new RegExp(String.raw`${b}!FAIL\s*\n+\s*Lý do:[\s\S]*?(?=${retry}|$)`, 'gisu')
  const patFailZh = new RegExp(
    String.raw`${b}!?\s*FAIL\s*\n*\s*理由\s*[：:\uFF1A][\s\S]*?(?=${retry}|$)`,
    'gisu',
  )
  const patZhPair = new RegExp(
    String.raw`\n+\s*理由\s*[：:\uFF1A][\s\S]*?建议\s*[：:\uFF1A][\s\S]*?(?=${retry}|$)`,
    'gsu',
  )
  for (let r = 0; r < 12; r++) {
    const before = t
    t = t
      .replace(patViFail, '$1')
      .replace(patBangFail, '$1')
      .replace(patFailZh, '$1')
      .replace(patZhPair, '')
    if (t === before) break
  }
  t = t.replace(/!FAIL\s*$/gi, '')
  t = t.replace(/([.!?…])!FAIL\b/giu, '$1')
  return t.trimEnd()
}

/** Gỡ nội dung lộ từ prompt / feedback vòng reviewer (không hiển thị cho user). */
export function stripReviewerArtifacts(text: string): string {
  let t = stripFailLydoAndZhRubricEcho(text || '')
  // Hint nội bộ retry (reviewer_node)
  t = t.replace(/\[SYSTEM FEEDBACK\][\s\S]*$/gi, '')
  t = t.replace(/\[ClawFlow-internal-review\][\s\S]*$/gi, '')
  // Model đôi khi dán nguyên câu chỉ dẫn reviewer
  const cutAt = (needle: string) => {
    const i = t.indexOf(needle)
    if (i !== -1) t = t.slice(0, i).trimEnd()
  }
  cutAt('Bạn là một KIỂM DUYỆT VIÊN (REVIEWER)')
  cutAt('Bạn là một KIỂM DUYỆT VIÊN')
  cutAt('CHỈ TRẢ VỀ "PASS" HOẶC "FAIL')
  cutAt('CHỈ TRẢ VỀ "PASS" HOẶC "FAIL".')
  // Khối rubric "Luật:" + đánh số kiểu reviewer
  t = t.replace(
    /\n{1,2}Luật:\s*\n?\s*1\.\s*Nếu câu trả lời[\s\S]*$/i,
    '',
  )
  return t.trimEnd()
}

export function stripTrailingReviewMarkers(text: string): string {
  let t = stripReviewerArtifacts((text || '').replace(/\r\n/g, '\n').trimEnd())
  if (!t) return t
  const beforeRaw = t
  for (let i = 0; i < 10; i++) {
    const before = t
    // Remove leaked reviewer rubric block at tail
    t = t.replace(
      /(?:^|\n)\s*(?:PASS|FAIL)\s*\n+\s*Câu trả lời đã đáp ứng yêu cầu của người dùng bằng cách:[\s\S]*$/i,
      '',
    )
    // Trailing patterns
    t = t.replace(/\.PASS\s*$/i, '')
    t = t.replace(/\.FAIL\s*$/i, '')
    t = t.replace(/\n+\s*PASS\s*$/i, '')
    t = t.replace(/\n+\s*FAIL\s*$/i, '')
    t = t.replace(/[ \t]+PASS\s*$/i, '')
    t = t.replace(/[ \t]+FAIL\s*$/i, '')
    // Standalone PASS/FAIL on its own line anywhere
    t = t.replace(/^\s*PASS\s*$/gim, '')
    t = t.replace(/^\s*FAIL\s*$/gim, '')
    // Catch ".PASS" or ".FAIL" mid-text (echo from reviewer)
    t = t.replace(/\.\s*PASS\b/gi, '.')
    t = t.replace(/\.\s*FAIL\b/gi, '.')
    // Catch "PASS" or "FAIL" that is the entire last line
    t = t.replace(/\n\s*\.?\s*PASS\s*$/i, '')
    t = t.replace(/\n\s*\.?\s*FAIL\s*$/i, '')
    // PASS/FAIL như token rời sau dấu câu (vd "CT3)PASS")
    t = t.replace(/(^|[^A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9_])(PASS|FAIL)\s*$/iu, '$1')
    // PASS/FAIL dính liền chữ (vd "ClawFlowPASS")
    t = t.replace(/([A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9])PASS\s*$/iu, '$1')
    t = t.replace(/([A-Za-zÀ-ỹĂÂĐÊÔƠƯăâđêôơư0-9])FAIL\s*$/iu, '$1')
    t = t.trimEnd()
    if (t === before) break
  }
  // Remove excess trailing newlines
  t = t.replace(/\n{3,}/g, '\n\n').trimEnd()
  // #region agent log
  if (beforeRaw !== t || /PASS|FAIL|Lý do:|Gợi ý:/i.test(t)) {
    fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:'ui-sanitize',hypothesisId:'H3',location:'Frontend/src/utils/assistantDisplay.ts:236',message:'strip_trailing_review_markers_result',data:{changed:beforeRaw!==t,beforeHasReview:/PASS|FAIL|Lý do:|Gợi ý:/i.test(beforeRaw),afterHasReview:/PASS|FAIL|Lý do:|Gợi ý:/i.test(t),beforeLen:beforeRaw.length,afterLen:t.length},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  return t
}
