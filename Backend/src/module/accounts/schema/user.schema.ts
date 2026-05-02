import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IntegrationProvider =
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'notion';

export class IntegrationConnection {
  @Prop({ type: Boolean, default: false })
  connected?: boolean;

  @Prop({ type: [String], default: [] })
  granted_scopes?: string[];

  @Prop({ type: Boolean, default: false })
  needs_reauth?: boolean;

  @Prop()
  connected_at?: Date;

  @Prop()
  expires_at?: Date;

  @Prop()
  access_token?: string;

  @Prop()
  refresh_token?: string;

  @Prop()
  last_error?: string;

  @Prop()
  external_account_email?: string;

  @Prop()
  last_sync_at?: Date;
}

/** `publicId` (UUID): định danh công khai / mở rộng multi-agent; `_id` Mongo giữ nội bộ. */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  publicId!: string;

  @Prop({ required: true })
  username!: string;

  @Prop({ unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({
    type: String,
    enum: ['google', 'facebook', 'github', 'linkedin', 'microsoft', 'apple'],
  })
  sso_provider!: string;

  @Prop()
  fullName!: string;

  @Prop()
  avatar_url!: string;

  @Prop()
  refreshToken!: string;

  /** Integration toggles (global theo user). Mặc định bật. */
  @Prop({ type: Boolean, default: true })
  integration_gmail_enabled?: boolean;

  @Prop({ type: Boolean, default: true })
  integration_google_calendar_enabled?: boolean;

  @Prop({ type: Boolean, default: true })
  integration_drive_enabled?: boolean;

  @Prop({ type: Boolean, default: true })
  integration_notion_enabled?: boolean;

  /**
   * Trạng thái OAuth/API connection theo provider.
   * Lưu metadata kết nối; token thực tế sẽ tách sang storage bảo mật ở bước production.
   */
  @Prop({
    type: {
      gmail: { type: Object, default: () => ({}) },
      google_calendar: { type: Object, default: () => ({}) },
      google_drive: { type: Object, default: () => ({}) },
      notion: { type: Object, default: () => ({}) },
    },
    default: () => ({}),
  })
  integration_connections?: Record<IntegrationProvider, IntegrationConnection>;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Không gửi password (kể cả hash) ra JSON/HTTP
    if ('password' in ret) {
      delete (ret as { password?: string }).password;
    }
    if ('refreshToken' in ret) {
      delete (ret as { refreshToken?: string }).refreshToken;
    }
    return ret;
  },
});
