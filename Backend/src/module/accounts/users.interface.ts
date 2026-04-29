/**
 * Dữ liệu user “sạch” trả về API (sau toJSON — không có password).
 * Khớp với {@link User} schema; field tương lai để optional.
 */
export interface IUser {
  _id: string;
  /** UUID (v4) — khóa nghiệp vụ công khai, thuận mở rộng hệ thống */
  publicId?: string;
  username: string;
  email: string;
  sso_provider?: string;
  fullName?: string;
  /** Trùng tên field trong MongoDB schema (không dùng `avatar` nếu DB là avatar_url) */
  avatar_url?: string;
  createdAt?: Date;
  updatedAt?: Date;

  /** Bật/tắt connector bên thứ 3 — áp dụng global theo user (không theo workspace). */
  integration_gmail_enabled?: boolean;
  integration_google_calendar_enabled?: boolean;
  integration_drive_enabled?: boolean;
  integration_notion_enabled?: boolean;

  integration_connections?: {
    gmail?: {
      connected?: boolean;
      granted_scopes?: string[];
      needs_reauth?: boolean;
      connected_at?: Date;
      expires_at?: Date;
      last_error?: string;
      external_account_email?: string;
    };
    google_calendar?: {
      connected?: boolean;
      granted_scopes?: string[];
      needs_reauth?: boolean;
      connected_at?: Date;
      expires_at?: Date;
      last_error?: string;
      external_account_email?: string;
    };
    google_drive?: {
      connected?: boolean;
      granted_scopes?: string[];
      needs_reauth?: boolean;
      connected_at?: Date;
      expires_at?: Date;
      last_error?: string;
      external_account_email?: string;
    };
    notion?: {
      connected?: boolean;
      granted_scopes?: string[];
      needs_reauth?: boolean;
      connected_at?: Date;
      expires_at?: Date;
      last_error?: string;
      external_account_email?: string;
    };
  };
}
