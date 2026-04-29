/**
 * Theme (Giao diện): lưu lựa chọn Light/Dark.
 *
 * Persistence (Lưu trữ bền vững): dùng `localStorage` của trình duyệt — dữ liệu
 * vẫn còn sau F5 / đóng tab (trừ khi xoá site data). Đồng bộ DB (NestJS + Mongo)
 * có thể bổ sung sau bằng trường `preferences.theme` trên User nếu cần đa thiết bị.
 */
export const APP_THEME_STORAGE_KEY = 'clawflow.appTheme'

export type AppTheme = 'light' | 'dark'

export function readStoredTheme(): AppTheme | null {
  try {
    const v = localStorage.getItem(APP_THEME_STORAGE_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* private mode / blocked */
  }
  return null
}

export function writeStoredTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function applyDocumentTheme(theme: AppTheme): void {
  document.documentElement.dataset.appTheme = theme
}
