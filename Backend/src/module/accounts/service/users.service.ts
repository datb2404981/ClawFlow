import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { CreateUserDto } from '../dto/create-user.dto';
import { Model } from 'mongoose';
import { User } from '../schema/user.schema';
import * as bcrypt from 'bcrypt';
import type { IUser } from '../users.interface';
import { UpdateAppSettingsDto } from '../dto/update-app-settings.dto';

type IntegrationProvider = 'gmail' | 'google_calendar' | 'google_drive' | 'notion';

type IntegrationConnectionState = {
  connected: boolean;
  needs_reauth: boolean;
  granted_scopes: string[];
  connected_at?: Date;
  expires_at?: Date;
  last_error?: string;
  external_account_email?: string;
};

type IntegrationCatalogItem = {
  provider: IntegrationProvider;
  provider_group: 'google' | 'notion';
  display_name: string;
  required_scopes: string[];
  features: string[];
  limitations: string[];
  security_notes: string[];
};

const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    provider: 'gmail',
    provider_group: 'google',
    display_name: 'Gmail',
    required_scopes: ['https://www.googleapis.com/auth/gmail.send'],
    features: [
      'Soạn và gửi email tự động sau khi bạn Approve.',
      'Hỗ trợ trigger task từ email mới (khi bật event flow).',
    ],
    limitations: ['Chỉ thực thi khi đã kết nối OAuth và scope hợp lệ.'],
    security_notes: [
      'Luôn yêu cầu bước Approve trước khi gửi email.',
      'Có thể ngắt kết nối bất kỳ lúc nào trong Settings.',
    ],
  },
  {
    provider: 'google_calendar',
    provider_group: 'google',
    display_name: 'Google Calendar',
    required_scopes: ['https://www.googleapis.com/auth/calendar.events'],
    features: [
      'Tạo/cập nhật lịch hẹn từ action plan.',
      'Kích hoạt task theo sự kiện lịch.',
    ],
    limitations: ['Sự kiện chỉ được tạo khi action plan có dữ liệu hợp lệ.'],
    security_notes: [
      'Mọi thao tác tạo/sửa lịch đều được ghi execution log.',
      'Có thể yêu cầu re-authorize khi scope hết hạn.',
    ],
  },
  {
    provider: 'google_drive',
    provider_group: 'google',
    display_name: 'Google Drive',
    required_scopes: ['https://www.googleapis.com/auth/drive.file'],
    features: [
      'Tạo và lưu file đầu ra của task lên Drive.',
      'Lưu artifact báo cáo/tài liệu cho workflow tự động.',
    ],
    limitations: ['MVP hiện tại tập trung upload theo action plan đã duyệt.'],
    security_notes: [
      'Chỉ thao tác trên file do app tạo hoặc được cấp quyền.',
      'Ngắt kết nối sẽ dừng toàn bộ hành động upload mới.',
    ],
  },
  {
    provider: 'notion',
    provider_group: 'notion',
    display_name: 'Notion',
    required_scopes: ['notion.pages.write', 'notion.databases.read'],
    features: [
      'Tạo/cập nhật trang hoặc database item từ nội dung draft.',
      'Đồng bộ kết quả tác vụ sang workspace Notion.',
    ],
    limitations: ['Notion có luồng OAuth riêng, không dùng Google SSO.'],
    security_notes: [
      'Chỉ thực thi sau khi người dùng Approve.',
      'Có thể revoke token trực tiếp từ Notion và kết nối lại.',
    ],
  },
];

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
        publicId: randomUUID(),
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
   * Cài đặt ứng dụng — dùng cho bật/tắt connector bên thứ 3.
   * Áp dụng global theo user.
   */
  async getAppSettings(user: IUser | undefined): Promise<{
    integration_gmail_enabled?: boolean;
    integration_google_calendar_enabled?: boolean;
    integration_drive_enabled?: boolean;
    integration_notion_enabled?: boolean;
  }> {
    const u = await this.findOne(user);
    return {
      integration_gmail_enabled:
        (u as any).integration_gmail_enabled ?? true,
      integration_google_calendar_enabled:
        (u as any).integration_google_calendar_enabled ?? true,
      integration_drive_enabled: (u as any).integration_drive_enabled ?? true,
      integration_notion_enabled: (u as any).integration_notion_enabled ?? true,
    };
  }

  private assertProvider(input: string): IntegrationProvider {
    const v = String(input ?? '').trim();
    if (
      v === 'gmail' ||
      v === 'google_calendar' ||
      v === 'google_drive' ||
      v === 'notion'
    ) {
      return v;
    }
    throw new UnauthorizedException(`Provider không hợp lệ: ${v}`);
  }

  private mergeConnection(
    raw: unknown,
    fallbackEmail?: string,
  ): IntegrationConnectionState {
    const r =
      raw && typeof raw === 'object'
        ? (raw as Partial<IntegrationConnectionState>)
        : {};
    return {
      connected: Boolean(r.connected),
      needs_reauth: Boolean(r.needs_reauth),
      granted_scopes: Array.isArray(r.granted_scopes)
        ? r.granted_scopes.filter((x) => typeof x === 'string')
        : [],
      connected_at: r.connected_at,
      expires_at: r.expires_at,
      last_error: r.last_error,
      external_account_email:
        typeof r.external_account_email === 'string'
          ? r.external_account_email
          : fallbackEmail,
    };
  }

  private googleAutoConnectionState(
    u: IUser,
    provider: IntegrationProvider,
  ): IntegrationConnectionState {
    const current = this.mergeConnection(
      (u as any).integration_connections?.[provider],
      u.email,
    );
    if (u.sso_provider !== 'google') {
      return current;
    }
    // Rule theo yêu cầu: tài khoản login Google được coi là connected cho nhóm Google APIs.
    if (
      provider === 'gmail' ||
      provider === 'google_calendar' ||
      provider === 'google_drive'
    ) {
      return {
        ...current,
        connected: true,
        needs_reauth: false,
        external_account_email: current.external_account_email ?? u.email,
      };
    }
    return current;
  }

  getIntegrationCatalog(): IntegrationCatalogItem[] {
    return INTEGRATION_CATALOG.map((x) => ({ ...x }));
  }

  async getIntegrationsStatus(user: IUser | undefined): Promise<{
    providers: Array<
      IntegrationCatalogItem & {
        enabled: boolean;
        connection_state: IntegrationConnectionState;
      }
    >;
  }> {
    const u = (await this.findOne(user)) as unknown as IUser;
    const enabled = {
      gmail: (u as any).integration_gmail_enabled ?? true,
      google_calendar: (u as any).integration_google_calendar_enabled ?? true,
      google_drive: (u as any).integration_drive_enabled ?? true,
      notion: (u as any).integration_notion_enabled ?? true,
    };

    return {
      providers: INTEGRATION_CATALOG.map((item) => ({
        ...item,
        enabled:
          enabled[item.provider as keyof typeof enabled] ??
          true,
        connection_state: this.googleAutoConnectionState(u as IUser, item.provider),
      })),
    };
  }

  async getIntegrationConnectUrl(
    user: IUser | undefined,
    providerInput: string,
  ): Promise<{
    provider: IntegrationProvider;
    connect_url: string;
    note: string;
  }> {
    const u = await this.findOne(user);
    const provider = this.assertProvider(providerInput);
    const nonce = randomUUID();
    const base =
      process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, '') ||
      `http://127.0.0.1:${process.env.PORT ?? '8080'}/api/v1`;

    // MVP callback URL: phục vụ flow local/dev trước khi gắn OAuth provider thực.
    const connectUrl = `${base}/settings/integrations/${provider}/callback?state=${encodeURIComponent(
      nonce,
    )}&mock=1&email=${encodeURIComponent(String(u.email ?? ''))}`;
    return {
      provider,
      connect_url: connectUrl,
      note:
        provider === 'notion'
          ? 'Notion cần OAuth riêng. URL hiện tại là MVP callback mô phỏng.'
          : 'Google OAuth URL hiện tại là MVP callback mô phỏng; có thể thay bằng consent URL thực.',
    };
  }

  async connectIntegrationCallback(
    user: IUser | undefined,
    providerInput: string,
    q: { scopes?: string; email?: string; error?: string },
  ): Promise<{
    provider: IntegrationProvider;
    connected: boolean;
    needs_reauth: boolean;
    granted_scopes: string[];
  }> {
    if (!user?._id) {
      throw new UnauthorizedException('Chưa đăng nhập.');
    }
    const provider = this.assertProvider(providerInput);
    const now = new Date();
    const scopes = String(q?.scopes ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const $set: Record<string, unknown> = {};
    const basePath = `integration_connections.${provider}`;
    if (q?.error) {
      $set[`${basePath}.connected`] = false;
      $set[`${basePath}.needs_reauth`] = true;
      $set[`${basePath}.last_error`] = String(q.error);
    } else {
      $set[`${basePath}.connected`] = true;
      $set[`${basePath}.needs_reauth`] = false;
      $set[`${basePath}.granted_scopes`] = scopes;
      $set[`${basePath}.connected_at`] = now;
      $set[`${basePath}.last_error`] = '';
      if (q?.email) {
        $set[`${basePath}.external_account_email`] = q.email;
      }
    }

    await this.userModel.updateOne({ _id: user._id }, { $set });
    const status = await this.getIntegrationsStatus(user);
    const p = status.providers.find((x) => x.provider === provider);
    if (!p) {
      throw new UnauthorizedException('Không đọc được trạng thái provider.');
    }
    return {
      provider,
      connected: p.connection_state.connected,
      needs_reauth: p.connection_state.needs_reauth,
      granted_scopes: p.connection_state.granted_scopes,
    };
  }

  async disconnectIntegration(
    user: IUser | undefined,
    providerInput: string,
  ): Promise<{ provider: IntegrationProvider; disconnected: true }> {
    if (!user?._id) {
      throw new UnauthorizedException('Chưa đăng nhập.');
    }
    const provider = this.assertProvider(providerInput);
    const basePath = `integration_connections.${provider}`;
    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          [`${basePath}.connected`]: false,
          [`${basePath}.needs_reauth`]: false,
          [`${basePath}.granted_scopes`]: [],
          [`${basePath}.last_error`]: '',
          [`${basePath}.expires_at`]: null,
        },
      },
    );
    return { provider, disconnected: true };
  }

  async getExecutorIntegrationsGate(userId: string): Promise<{
    gmail_send: boolean;
    calendar_create: boolean;
    drive_upload: boolean;
    notion_update: boolean;
    reasons: Record<string, string>;
  }> {
    const u = await this.findOne({ _id: userId } as IUser);
    const enabled = {
      gmail: (u as any).integration_gmail_enabled ?? true,
      google_calendar: (u as any).integration_google_calendar_enabled ?? true,
      google_drive: (u as any).integration_drive_enabled ?? true,
      notion: (u as any).integration_notion_enabled ?? true,
    };
    const status = await this.getIntegrationsStatus({ _id: userId } as IUser);
    const byProvider = new Map(
      status.providers.map((p) => [p.provider, p]),
    );
    const check = (provider: IntegrationProvider): {
      ok: boolean;
      reason: string;
    } => {
      const p = byProvider.get(provider);
      if (!p) return { ok: false, reason: 'missing_provider_status' };
      if (!p.enabled) return { ok: false, reason: 'disabled_by_user' };
      if (!p.connection_state.connected) {
        return { ok: false, reason: 'not_connected' };
      }
      if (p.connection_state.needs_reauth) {
        return { ok: false, reason: 'needs_reauthorize' };
      }
      return { ok: true, reason: 'ok' };
    };

    const gmail = check('gmail');
    const cal = check('google_calendar');
    const drive = check('google_drive');
    const notion = check('notion');
    return {
      gmail_send: gmail.ok && enabled.gmail,
      calendar_create: cal.ok && enabled.google_calendar,
      drive_upload: drive.ok && enabled.google_drive,
      notion_update: notion.ok && enabled.notion,
      reasons: {
        gmail_send: gmail.reason,
        calendar_create: cal.reason,
        drive_upload: drive.reason,
        notion_update: notion.reason,
      },
    };
  }

  async updateAppSettings(
    user: IUser | undefined,
    dto: UpdateAppSettingsDto,
  ): Promise<{
    integration_gmail_enabled?: boolean;
    integration_google_calendar_enabled?: boolean;
    integration_drive_enabled?: boolean;
    integration_notion_enabled?: boolean;
  }> {
    if (!user?._id) {
      throw new UnauthorizedException('Chưa đăng nhập.');
    }

    const $set: Record<string, unknown> = {};
    if (dto.integration_gmail_enabled !== undefined) {
      $set.integration_gmail_enabled = dto.integration_gmail_enabled;
    }
    if (dto.integration_google_calendar_enabled !== undefined) {
      $set.integration_google_calendar_enabled =
        dto.integration_google_calendar_enabled;
    }
    if (dto.integration_drive_enabled !== undefined) {
      $set.integration_drive_enabled = dto.integration_drive_enabled;
    }
    if (dto.integration_notion_enabled !== undefined) {
      $set.integration_notion_enabled = dto.integration_notion_enabled;
    }

    await this.userModel.updateOne({ _id: user._id }, { $set });

    return this.getAppSettings(user);
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
