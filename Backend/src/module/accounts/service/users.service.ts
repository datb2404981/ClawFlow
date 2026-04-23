import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateUserDto } from '../dto/create-user.dto';
import { Model } from 'mongoose';
import { User } from '../schema/user.schema';
import * as bcrypt from 'bcrypt';
import type { IUser } from '../users.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async create(createUserDto: CreateUserDto) {
    const email = createUserDto.email.trim().toLowerCase();
    const emailExists = await this.userModel.findOne({ email });
    if (emailExists) {
      throw new ConflictException('Email đã tồn tại');
    }
    const hashedPassword = await this.hashPassword(createUserDto.password);
    try {
      const user = await this.userModel.create({
        ...createUserDto,
        email,
        password: hashedPassword,
      });
      return user.toJSON();
    } catch (e: unknown) {
      // Hai request tạo cùng email cùng lúc: unique index ném 11000
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: number }).code === 11000
      ) {
        throw new ConflictException('Email đã tồn tại');
      }
      throw e;
    }
  }

  async findOne(user: IUser | undefined) {
    if (!user?._id) {
      throw new UnauthorizedException('Chưa đăng nhập hoặc thiếu id (bật JWT + AuthGuard)');
    }
    const userData = await this.userModel.findById(user._id).select('-password');
    if (!userData) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }
    // toJSON() áp dụng transform schema; cast vì Mongoose typing còn ObjectId, JSON thực tế là plain object
    return userData.toJSON();
  }

  /**
   * Cập nhật một số field (VD: lưu refresh token sau đăng nhập). Không trả dữ liệu nhạy cảm qua toJSON ở chỗ khác.
   */
  async updateProfile(
    email: string,
    patch: { refreshToken?: string | null },
  ): Promise<void> {
    const filter = { email: email.trim().toLowerCase() };
    const r =
      patch.refreshToken === null
        ? await this.userModel.updateOne(filter, { $unset: { refreshToken: 1 } })
        : await this.userModel.updateOne(filter, { $set: { refreshToken: patch.refreshToken } });
    if (r.matchedCount === 0) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }
  }

  /**
   * Dùng nội bộ auth: đọc `refreshToken` từ DB ( `toJSON` vẫn xóa field này ở response ).
   */
  async findAuthStateByEmail(
    email: string,
  ): Promise<{
    _id: string;
    email: string;
    username: string;
    refreshToken: string | undefined;
    avatar_url?: string;
  } | null> {
    const raw = await this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .lean()
      .exec();
    if (!raw) {
      return null;
    }
    // `lean()` generic không khớp class `User` đủ để suy ra an toàn — gán hình dạng tường minh cho ESLint/TS.
    const doc = raw as {
      _id: { toString(): string };
      email: string;
      username: string;
      refreshToken?: string;
      avatar_url?: string;
    };
    return {
      _id: String(doc._id),
      email: doc.email,
      username: doc.username,
      refreshToken: doc.refreshToken,
      avatar_url: doc.avatar_url,
    };
  }
}
