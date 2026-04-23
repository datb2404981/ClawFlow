import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** `publicId` (UUID): định danh công khai / mở rộng multi-agent; `_id` Mongo giữ nội bộ. */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  publicId: string;

  @Prop({ required: true })
  username: string;

  @Prop({ unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: String,
    enum: ['google', 'facebook', 'github', 'linkedin', 'microsoft', 'apple'],
  })
  sso_provider: string;

  @Prop()
  fullName: string;

  @Prop()
  avatar_url: string;

  @Prop()
  refreshToken: string;

  createdAt: Date;
  updatedAt: Date;
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
