/** Regex đơn giản — đủ để bắt thiếu @ / sai dạng thường gặp */
export const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailErrorMessageVi(value: string): string | null {
  const t = value.trim()
  if (!t) return 'Vui lòng nhập email.'
  if (!SIMPLE_EMAIL_REGEX.test(t)) {
    return 'Nhập email đúng dạng, ví dụ: ten@congty.com'
  }
  return null
}
