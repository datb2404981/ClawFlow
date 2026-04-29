import { UsersService } from './users.service';

describe('UsersService integrations', () => {
  const mockModel = {
    updateOne: jest.fn(),
  } as any;

  const buildService = () => new UsersService(mockModel);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-connects google providers when user logged in via google', async () => {
    const svc = buildService();
    jest.spyOn(svc, 'findOne').mockResolvedValue({
      _id: 'u1',
      email: 'google.user@example.com',
      username: 'google_user',
      sso_provider: 'google',
      integration_gmail_enabled: true,
      integration_google_calendar_enabled: true,
      integration_drive_enabled: true,
      integration_notion_enabled: true,
      integration_connections: {},
    } as any);

    const out = await svc.getIntegrationsStatus({ _id: 'u1' } as any);
    const gmail = out.providers.find((p) => p.provider === 'gmail');
    const calendar = out.providers.find(
      (p) => p.provider === 'google_calendar',
    );
    const drive = out.providers.find((p) => p.provider === 'google_drive');
    const notion = out.providers.find((p) => p.provider === 'notion');

    expect(gmail?.connection_state.connected).toBe(true);
    expect(calendar?.connection_state.connected).toBe(true);
    expect(drive?.connection_state.connected).toBe(true);
    // Notion không auto-connected theo Google SSO.
    expect(notion?.connection_state.connected).toBe(false);
  });

  it('marks google providers disconnected for non-google login without OAuth link', async () => {
    const svc = buildService();
    jest.spyOn(svc, 'findOne').mockResolvedValue({
      _id: 'u2',
      email: 'local.user@example.com',
      username: 'local_user',
      sso_provider: undefined,
      integration_gmail_enabled: true,
      integration_google_calendar_enabled: true,
      integration_drive_enabled: true,
      integration_notion_enabled: true,
      integration_connections: {},
    } as any);

    const out = await svc.getIntegrationsStatus({ _id: 'u2' } as any);
    const gmail = out.providers.find((p) => p.provider === 'gmail');
    expect(gmail?.connection_state.connected).toBe(false);
  });

  it('connect callback updates integration connection fields', async () => {
    const svc = buildService();
    jest.spyOn(svc, 'findOne').mockResolvedValue({
      _id: 'u3',
      email: 'oauth.user@example.com',
      username: 'oauth_user',
      integration_gmail_enabled: true,
      integration_google_calendar_enabled: true,
      integration_drive_enabled: true,
      integration_notion_enabled: true,
      integration_connections: {},
    } as any);
    await svc.connectIntegrationCallback(
      { _id: 'u3' } as any,
      'gmail',
      {
        scopes: 'https://www.googleapis.com/auth/gmail.send',
        email: 'oauth.user@example.com',
      },
    );

    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { _id: 'u3' },
      expect.objectContaining({
        $set: expect.objectContaining({
          'integration_connections.gmail.connected': true,
          'integration_connections.gmail.needs_reauth': false,
          'integration_connections.gmail.granted_scopes': [
            'https://www.googleapis.com/auth/gmail.send',
          ],
          'integration_connections.gmail.external_account_email':
            'oauth.user@example.com',
        }),
      }),
    );
  });
});
