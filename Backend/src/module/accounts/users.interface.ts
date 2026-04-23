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
}
