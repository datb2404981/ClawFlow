import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { CreateUserDto } from '../dto/create-user.dto';
import { Model } from 'mongoose';
import { User } from '../schema/user.schema';
import * as bcrypt from 'bcrypt';
import type { IUser } from '../users.interface';
import { UpdateAppSettingsDto } from '../dto/update-app-settings.dto';
import { WorkspacesService } from './workspaces.service';

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
    required_scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ],
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
    private readonly workspacesService: WorkspacesService,
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

  /** Gộp chuỗi scope Google (dấu cách / phẩy) thành danh sách duy nhất. */
  private mergeScopeStrings(...raw: (string | undefined)[]): string[] {
    const acc: string[] = [];
    for (const part of raw) {
      if (!part) continue;
      for (const piece of String(part).split(/[,\s]+/)) {
        const t = piece.trim();
        if (t) acc.push(t);
      }
    }
    return [...new Set(acc)];
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
    const rawConn = (u as any).integration_connections?.[provider] || {};

    if (u.sso_provider !== 'google') {
      return current;
    }
    // Rule theo yêu cầu: tài khoản login Google được coi là connected cho nhóm Google APIs.
    // Tuy nhiên, phải có access_token thì mới tính là connected hợp lệ để UI không bị kẹt (không hiện nút Connect).
    if (
      (provider === 'gmail' ||
      provider === 'google_calendar' ||
      provider === 'google_drive') && rawConn.access_token
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
        connection_state: this.googleAutoConnectionState(u, item.provider),
      })),
    };
  }

  /**
   * Tự động làm mới Google Access Token nếu có refresh_token và token cũ đã hết hạn.
   */
  private async refreshGoogleTokenIfNeeded(
    userId: string,
    provider: IntegrationProvider,
    conn: any,
  ): Promise<{ access_token?: string; expires_at?: Date }> {
    if (!conn?.refresh_token || !conn?.expires_at) return {};
    
    const now = new Date();
    const expiry = new Date(conn.expires_at);
    // Refresh nếu còn dưới 5 phút hoặc đã hết hạn
    if (now.getTime() < expiry.getTime() - 5 * 60 * 1000) {
      return { access_token: conn.access_token, expires_at: expiry };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: conn.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const data = (await res.json()) as any;
      if (data.access_token) {
        const newExpiresAt = new Date(now.getTime() + (data.expires_in || 3600) * 1000);
        const basePath = `integration_connections.${provider}`;
        
        await this.userModel.updateOne(
          { _id: userId },
          {
            $set: {
              [`${basePath}.access_token`]: data.access_token,
              [`${basePath}.expires_at`]: newExpiresAt,
            },
          },
        );
        return { access_token: data.access_token, expires_at: newExpiresAt };
      }
      console.error(`Refresh token failed for ${provider}:`, data);
    } catch (err) {
      console.error(`Error refreshing token for ${provider}:`, err);
    }
    return {};
  }

  /**
   * Server Guard & Data Fetcher: Gộp logic trạng thái và lấy token thực tế cho Executor/AI_Core.
   */
  async getExecutorIntegrationsGate(userId: string): Promise<{
    providerStatusString: string;
    connections: Record<string, IntegrationConnectionState & { access_token?: string; refresh_token?: string }>;
    gmail_send: boolean;
    calendar_create: boolean;
    drive_upload: boolean;
    notion_update: boolean;
    reasons: Record<string, string>;
  }> {
    const u = (await this.findOne({ _id: userId } as any)) as unknown as IUser;
    const enabled = {
      gmail: (u as any).integration_gmail_enabled ?? true,
      google_calendar: (u as any).integration_google_calendar_enabled ?? true,
      google_drive: (u as any).integration_drive_enabled ?? true,
      notion: (u as any).integration_notion_enabled ?? true,
    };

    const lines: string[] = [];
    const connections: Record<string, any> = {};
    const reasons: Record<string, string> = {};

    for (const item of INTEGRATION_CATALOG) {
      const connState = this.googleAutoConnectionState(u, item.provider);
      const rawConn = (u as any).integration_connections?.[item.provider] || {};
      
      let finalToken = rawConn.access_token;
      let finalExpiresAt = rawConn.expires_at;

      // Auto-refresh cho nhóm Google
      if (item.provider_group === 'google' && rawConn.refresh_token) {
        const refreshed = await this.refreshGoogleTokenIfNeeded(userId, item.provider, rawConn);
        if (refreshed.access_token) {
          finalToken = refreshed.access_token;
          finalExpiresAt = refreshed.expires_at;
        }
      }

      const fullConn = { 
        ...connState, 
        access_token: finalToken, 
        refresh_token: rawConn.refresh_token,
        expires_at: finalExpiresAt,
      };
      
      connections[item.provider] = fullConn;

      // Xác định lý do/trạng thái
      if (!enabled[item.provider as keyof typeof enabled]) {
        reasons[item.provider] = 'disabled_by_user';
      } else if (!fullConn.connected) {
        reasons[item.provider] = 'not_connected';
      } else if (fullConn.needs_reauth) {
        reasons[item.provider] = 'needs_reauthorize';
      } else if (item.provider_group === 'google' && !finalToken) {
        // Có thể login SSO nhưng chưa Connect chính thức để lấy token
        reasons[item.provider] = 'missing_access_token';
      } else {
        reasons[item.provider] = 'ok';
      }

      if (reasons[item.provider] === 'ok') {
        lines.push(`- ĐÃ liên kết ${item.display_name}`);
      } else {
        lines.push(`- CHƯA liên kết (hoặc cần kết nối lại) ${item.display_name}`);
      }
    }

    return {
      providerStatusString: lines.join('\n'),
      connections,
      gmail_send: reasons['gmail'] === 'ok',
      calendar_create: reasons['google_calendar'] === 'ok',
      drive_upload: reasons['google_drive'] === 'ok',
      notion_update: reasons['notion'] === 'ok',
      reasons,
    };
  }

  async getIntegrationConnectUrl(
    user: IUser | undefined,
    providerInput: string,
    workspaceIdInput?: string,
  ): Promise<{
    provider: IntegrationProvider;
    connect_url: string;
    note: string;
  }> {
    const u = await this.findOne(user);
    const provider = this.assertProvider(providerInput);
    const userId = String(u._id);
    const wid = String(workspaceIdInput ?? '').trim();
    if (!wid) {
      throw new BadRequestException('Thiếu workspace_id khi tạo link liên kết.');
    }
    await this.workspacesService.findOne(userId, wid);
    const nonce = `${randomUUID()}.${userId}.${wid}`;
    const base =
      process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, '') ||
      `http://localhost:${process.env.PORT ?? '8080'}/api/v1`;

    const catalogItem = INTEGRATION_CATALOG.find((c) => c.provider === provider);

    if (catalogItem?.provider_group === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
      const googleCatalog = INTEGRATION_CATALOG.filter(
        (c) => c.provider_group === 'google',
      );
      const scopeSet = new Set<string>();
      for (const g of googleCatalog) {
        for (const s of g.required_scopes) scopeSet.add(s);
      }
      const scopes = [...scopeSet].join(' ');
      const fullScopes = `openid email profile ${scopes}`;
      // Note: This redirect URI must be registered in Google Cloud Console
      const redirectUri = `${base}/settings/integrations/${provider}/callback`;
      
      const connectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&response_type=code&scope=${encodeURIComponent(
        fullScopes,
      )}&access_type=offline&prompt=consent&state=${encodeURIComponent(nonce)}`;

      return {
        provider,
        connect_url: connectUrl,
        note: 'Chuyển hướng đến trang đăng nhập Google thực tế. Vui lòng đảm bảo Redirect URI đã được cấu hình trong Google Console.',
      };
    }

    // Fallback/Mock for Notion or if not google
    const connectUrl = `${base}/settings/integrations/${provider}/callback?state=${encodeURIComponent(
      nonce,
    )}&mock=1&email=${encodeURIComponent(String(u.email ?? ''))}`;
    return {
      provider,
      connect_url: connectUrl,
      note: 'Đây là URL mô phỏng do chưa cấu hình OAuth provider này.',
    };
  }

  async connectIntegrationCallback(
    user: IUser | undefined,
    providerInput: string,
    q: { scopes?: string; scope?: string; email?: string; error?: string; code?: string },
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
    const catalogItem = INTEGRATION_CATALOG.find((c) => c.provider === provider)!;
    const now = new Date();
    const granted = this.mergeScopeStrings(q?.scopes, q?.scope);

    const $set: Record<string, unknown> = {};
    if (catalogItem.provider_group === 'google') {
      if (q?.error) {
        const basePath = `integration_connections.${provider}`;
        $set[`${basePath}.connected`] = false;
        $set[`${basePath}.needs_reauth`] = true;
        $set[`${basePath}.last_error`] = String(q.error);
      } else {
        let accessToken = '';
        let refreshToken = '';
        let expiresAt: Date | undefined;

        if (q.code) {
          const clientId = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';
          const base =
            process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, '') ||
            `http://localhost:${process.env.PORT ?? '8080'}/api/v1`;
          const redirectUri = `${base}/settings/integrations/${provider}/callback`;

          try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code: q.code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
              }),
            });
            const tokenData = (await tokenRes.json()) as Record<string, any>;
            if (tokenData.access_token) {
              accessToken = tokenData.access_token;
              if (tokenData.refresh_token) {
                refreshToken = tokenData.refresh_token;
              }
              if (tokenData.expires_in) {
                expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);
              }
            } else {
              console.error('Google token exchange error:', tokenData);
            }
          } catch (err) {
            console.error('Failed to exchange Google code:', err);
          }
        }

        const googleItems = INTEGRATION_CATALOG.filter(
          (c) => c.provider_group === 'google',
        );
        const extEmail = q.email;
        for (const item of googleItems) {
          const basePath = `integration_connections.${item.provider}`;
          const ok = item.required_scopes.every((s) => granted.includes(s));
          // Nếu có token thật, thì connected = true
          const isConnected = accessToken ? true : ok;
          
          $set[`${basePath}.connected`] = isConnected;
          $set[`${basePath}.needs_reauth`] = false;
          $set[`${basePath}.granted_scopes`] = item.required_scopes.filter((s) =>
            granted.includes(s),
          );
          $set[`${basePath}.connected_at`] = now;
          $set[`${basePath}.last_error`] = '';
          if (extEmail) {
            $set[`${basePath}.external_account_email`] = extEmail;
          }
          if (accessToken) {
            $set[`${basePath}.access_token`] = accessToken;
          }
          if (refreshToken) {
            $set[`${basePath}.refresh_token`] = refreshToken;
          }
          if (expiresAt) {
            $set[`${basePath}.expires_at`] = expiresAt;
          }
        }
      }
    } else {
      const basePath = `integration_connections.${provider}`;
      if (q?.error) {
        $set[`${basePath}.connected`] = false;
        $set[`${basePath}.needs_reauth`] = true;
        $set[`${basePath}.last_error`] = String(q.error);
      } else {
        $set[`${basePath}.connected`] = true;
        $set[`${basePath}.needs_reauth`] = false;
        $set[`${basePath}.granted_scopes`] = granted;
        $set[`${basePath}.connected_at`] = now;
        $set[`${basePath}.last_error`] = '';
        $set[`${basePath}.access_token`] = `mock_${provider}_token_${Date.now()}`;
        if (q?.email) {
          $set[`${basePath}.external_account_email`] = q.email;
        }
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
