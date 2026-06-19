import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Characterization tests for apps/api/src/lib/jira-client.ts
//
// This module imports `db` from '../db/index.js' at the top level, which opens a
// pg Pool. We stub that module to prevent any real DB connections. The tested
// functions are:
//
//  - exchangeCode: POSTs to Atlassian token URL, returns TokenResponse
//  - exchangeCode: throws a plain Error on non-ok responses
//  - getAtlassianMe: GETs /me with Bearer auth, returns profile
//  - getAtlassianMe: throws on non-ok
//  - getAccessibleResources: GETs accessible-resources, returns array
//  - jiraFetch: skips token refresh when token expires far in the future
//  - jiraFetch: refreshes token when within the 5-min expiry margin
//  - jiraFetch: persists refreshed tokens via db.update (mocked)
//  - jiraFetch: throws TokenExpiredError when refresh_token is invalid/revoked
//  - jiraFetch: throws plain Error for other refresh failures

// Stub db to avoid pg Pool on import
vi.mock('../db/index.js', () => ({
  db: {
    update: vi.fn(),
  },
}));

// Also stub the schema — jira-client imports it transitively via db/index.js
// (the mock above covers that, but the direct eq() import from drizzle-orm is fine)

const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const CLIENT_ID = 'jira-client-id';
const CLIENT_SECRET = 'jira-client-secret';
const CALLBACK_URL = 'https://app.ternity.xyz/api/jira/callback';

/** A minimal JiraConnection shape matching the schema's $inferSelect */
function makeConnection(overrides: Partial<{
  id: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}> = {}) {
  return {
    id: 'conn-uuid-1',
    userId: 'user-uuid-1',
    atlassianAccountId: 'atl-acc-1',
    atlassianDisplayName: 'James Oakley',
    atlassianEmail: 'james@acme.io',
    atlassianAvatarUrl: null,
    cloudId: 'cloud-1',
    siteName: 'acme',
    siteUrl: 'https://acme.atlassian.net',
    siteAvatarUrl: null,
    config: {},
    tokenStatus: 'active',
    lastSyncedAt: null,
    accessToken: overrides.accessToken ?? 'access-token-abc',
    refreshToken: overrides.refreshToken ?? 'refresh-token-xyz',
    // Default: expires 1 hour from now (well outside the 5-min refresh margin)
    tokenExpiresAt: overrides.tokenExpiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function errResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  };
}

describe('exchangeCode', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.JIRA_CLIENT_ID = CLIENT_ID;
    process.env.JIRA_CLIENT_SECRET = CLIENT_SECRET;
    process.env.JIRA_CALLBACK_URL = CALLBACK_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.JIRA_CLIENT_ID;
    delete process.env.JIRA_CLIENT_SECRET;
    delete process.env.JIRA_CALLBACK_URL;
  });

  it('POSTs authorization_code grant to Atlassian token URL', async () => {
    const { exchangeCode } = await import('./jira-client.js');
    const tokenResp = { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, scope: 'read:jira-work' };
    fetchMock.mockResolvedValueOnce(okJson(tokenResp));

    const result = await exchangeCode('auth-code-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ATLASSIAN_TOKEN_URL);
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body.grant_type).toBe('authorization_code');
    expect(body.client_id).toBe(CLIENT_ID);
    expect(body.client_secret).toBe(CLIENT_SECRET);
    expect(body.code).toBe('auth-code-123');
    expect(body.redirect_uri).toBe(CALLBACK_URL);

    expect(result).toEqual(tokenResp);
  });

  it('throws a plain Error (not TokenExpiredError) on non-ok token exchange', async () => {
    const { exchangeCode, TokenExpiredError } = await import('./jira-client.js');
    fetchMock.mockResolvedValueOnce(errResponse(400, 'invalid_grant'));

    await expect(exchangeCode('bad-code')).rejects.toThrow('Token exchange failed (400)');
    // exchangeCode always throws plain Error — TokenExpiredError is only for refresh failures
    await expect(exchangeCode('bad-code').catch((e) => e)).resolves.not.toBeInstanceOf(TokenExpiredError);
  });
});

describe('getAtlassianMe', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs /me with Bearer Authorization header and returns the profile', async () => {
    const { getAtlassianMe } = await import('./jira-client.js');
    const profile = { account_id: 'atl-1', name: 'James Oakley', email: 'james@acme.io', picture: 'https://pic.url/1' };
    fetchMock.mockResolvedValueOnce(okJson(profile));

    const result = await getAtlassianMe('access-token-abc');

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.atlassian.com/me');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer access-token-abc');
    expect((opts.headers as Record<string, string>).Accept).toBe('application/json');
    expect(result).toEqual(profile);
  });

  it('throws a plain Error on non-ok response', async () => {
    const { getAtlassianMe } = await import('./jira-client.js');
    fetchMock.mockResolvedValueOnce(errResponse(401, 'unauthorized'));

    await expect(getAtlassianMe('bad-token')).rejects.toThrow('Failed to get Atlassian user (401)');
  });
});

describe('getAccessibleResources', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs accessible-resources with Bearer auth and returns the array', async () => {
    const { getAccessibleResources } = await import('./jira-client.js');
    const sites = [{ id: 'site-1', name: 'Acme', url: 'https://acme.atlassian.net', scopes: ['read:jira-work'], avatarUrl: '' }];
    fetchMock.mockResolvedValueOnce(okJson(sites));

    const result = await getAccessibleResources('access-token-abc');

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.atlassian.com/oauth/token/accessible-resources');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer access-token-abc');
    expect(result).toEqual(sites);
  });

  it('throws on non-ok response', async () => {
    const { getAccessibleResources } = await import('./jira-client.js');
    fetchMock.mockResolvedValueOnce(errResponse(403, 'forbidden'));

    await expect(getAccessibleResources('bad-token')).rejects.toThrow('Failed to get accessible resources (403)');
  });
});

describe('jiraFetch — token refresh logic', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    // Vitest 4: `restoreAllMocks` no longer clears call counts on module-mock
    // `vi.fn()` instances (only restores spies). Explicitly clear so per-test
    // `toHaveBeenCalledTimes` assertions see only this test's calls.
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.JIRA_CLIENT_ID = CLIENT_ID;
    process.env.JIRA_CLIENT_SECRET = CLIENT_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.JIRA_CLIENT_ID;
    delete process.env.JIRA_CLIENT_SECRET;
  });

  it('does NOT refresh the token when it expires far in the future (> 5 min)', async () => {
    const { jiraFetch } = await import('./jira-client.js');
    const conn = makeConnection({
      accessToken: 'fresh-access-token',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    });

    const apiResponse = { ok: true, status: 200, json: async () => ({ issues: [] }), text: async () => '' };
    fetchMock.mockResolvedValueOnce(apiResponse);

    await jiraFetch(conn, 'https://acme.atlassian.net/rest/api/3/search');

    // Only 1 fetch — the actual API call, no token refresh
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://acme.atlassian.net/rest/api/3/search');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer fresh-access-token');
  });

  it('uses the refreshed access token for the API call when within 5-min margin', async () => {
    const { db } = await import('../db/index.js');
    const { jiraFetch } = await import('./jira-client.js');

    const conn = makeConnection({
      accessToken: 'old-access-token',
      refreshToken: 'valid-refresh-token',
      // Expires in 3 minutes — within the 5-min TOKEN_REFRESH_MARGIN_MS
      tokenExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
    });

    const refreshedConn = { ...conn, accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
    const refreshTokenResp = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      scope: 'read:jira-work',
    };

    // Mock chain: db.update().set().where().returning() → the drizzle fluent API
    const returningMock = vi.fn().mockResolvedValueOnce([refreshedConn]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as unknown as ReturnType<typeof db.update>);

    // Fetch 1: token refresh POST
    fetchMock.mockResolvedValueOnce(okJson(refreshTokenResp));
    // Fetch 2: actual API call
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: async () => '' });

    await jiraFetch(conn, 'https://acme.atlassian.net/rest/api/3/search');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First fetch: token refresh
    const [refreshUrl, refreshOpts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(refreshUrl).toBe(ATLASSIAN_TOKEN_URL);
    const refreshBody = JSON.parse(refreshOpts.body as string) as Record<string, unknown>;
    expect(refreshBody.grant_type).toBe('refresh_token');
    expect(refreshBody.refresh_token).toBe('valid-refresh-token');

    // Second fetch: API call uses the NEW access token
    const [, apiOpts] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((apiOpts.headers as Record<string, string>).Authorization).toBe('Bearer new-access-token');
  });

  it('persists the refreshed tokens via db.update after a successful refresh', async () => {
    const { db } = await import('../db/index.js');
    const { jiraFetch } = await import('./jira-client.js');

    const conn = makeConnection({
      id: 'conn-persist-test',
      refreshToken: 'valid-rt',
      tokenExpiresAt: new Date(Date.now() + 1 * 60 * 1000), // 1 min — within margin
    });
    const refreshedConn = { ...conn, accessToken: 'persisted-at', refreshToken: 'persisted-rt' };

    const returningMock = vi.fn().mockResolvedValueOnce([refreshedConn]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as unknown as ReturnType<typeof db.update>);

    fetchMock.mockResolvedValueOnce(okJson({ access_token: 'persisted-at', refresh_token: 'persisted-rt', expires_in: 3600, scope: '' }));
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: async () => '' });

    await jiraFetch(conn, 'https://acme.atlassian.net/rest/api/3/search');

    // db.update should have been called once (to persist the new tokens)
    expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    // The set() call should include the new access_token and refresh_token
    const setCall = setMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall.accessToken).toBe('persisted-at');
    expect(setCall.refreshToken).toBe('persisted-rt');
  });

  it('throws TokenExpiredError when the refresh response contains "refresh_token is invalid"', async () => {
    const { jiraFetch, TokenExpiredError } = await import('./jira-client.js');

    const conn = makeConnection({
      tokenExpiresAt: new Date(Date.now() + 1 * 60 * 1000), // within margin
    });

    fetchMock.mockResolvedValueOnce(errResponse(401, 'refresh_token is invalid'));

    await expect(jiraFetch(conn, 'https://acme.atlassian.net/rest/api/3/search')).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it('throws TokenExpiredError when the refresh response contains "unauthorized_client"', async () => {
    const { jiraFetch, TokenExpiredError } = await import('./jira-client.js');

    const conn = makeConnection({
      tokenExpiresAt: new Date(Date.now() + 1 * 60 * 1000),
    });

    fetchMock.mockResolvedValueOnce(errResponse(401, 'unauthorized_client: revoked'));

    await expect(jiraFetch(conn, 'https://acme.atlassian.net/rest/api/3/search')).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it('throws a plain Error (not TokenExpiredError) for other refresh failures', async () => {
    const { jiraFetch, TokenExpiredError } = await import('./jira-client.js');

    const conn = makeConnection({
      tokenExpiresAt: new Date(Date.now() + 1 * 60 * 1000),
    });

    fetchMock.mockResolvedValueOnce(errResponse(500, 'internal server error'));

    const err = await jiraFetch(conn, 'https://acme.atlassian.net/rest/api/3/search').catch((e) => e);
    expect(err).not.toBeInstanceOf(TokenExpiredError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Token refresh failed \(500\)/);
  });

  it('passes custom init options (method, body, headers) through to the API fetch', async () => {
    const { jiraFetch } = await import('./jira-client.js');
    const conn = makeConnection({
      accessToken: 'at-pass-through',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}), text: async () => '' });

    await jiraFetch(conn, 'https://acme.atlassian.net/rest/api/3/issue', {
      method: 'POST',
      headers: { 'X-Custom': 'value' },
      body: JSON.stringify({ summary: 'Test' }),
    });

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ summary: 'Test' }));
    // Custom headers are merged — Authorization still added automatically
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer at-pass-through');
    expect((opts.headers as Record<string, string>)['X-Custom']).toBe('value');
  });

  it('returns the raw Response object from jiraFetch (not parsed JSON)', async () => {
    const { jiraFetch } = await import('./jira-client.js');
    const conn = makeConnection({ tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    const fakeResponse = { ok: true, status: 200, json: async () => ({ issues: [1, 2, 3] }), text: async () => '' };
    fetchMock.mockResolvedValueOnce(fakeResponse);

    const res = await jiraFetch(conn, 'https://acme.atlassian.net/rest/api/3/search');
    // jiraFetch returns the Response directly — caller must call .json()
    expect(res).toBe(fakeResponse);
  });
});
