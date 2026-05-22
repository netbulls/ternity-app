import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// db/index.ts opens a pg Pool on import; getManagementToken never touches the db,
// so stub the module to keep this unit fully isolated (no Pool, no DATABASE_URL).
vi.mock('../db/index.js', () => ({ db: {} }));

// Characterization tests for getManagementToken — pin the CURRENT behavior of the
// Logto M2M token fetch + module-level cache. The cache lives at module scope, so
// each test re-imports the module fresh (vi.resetModules) to start from an empty cache.

const ENDPOINT = 'https://auth.example.test';

async function loadGetManagementToken() {
  const mod = await import('./auth.js');
  return mod.getManagementToken;
}

function okTokenResponse(token: string, expiresIn: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: token, expires_in: expiresIn }),
    text: async () => '',
  };
}

describe('getManagementToken', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T00:00:00Z'));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.LOGTO_M2M_APP_ID;
    delete process.env.LOGTO_M2M_APP_SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null and warns without calling fetch when M2M creds are missing', async () => {
    const getManagementToken = await loadGetManagementToken();
    const result = await getManagementToken(ENDPOINT);
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('posts client_credentials to /oidc/token and returns the access token', async () => {
    process.env.LOGTO_M2M_APP_ID = 'm2m-id';
    process.env.LOGTO_M2M_APP_SECRET = 'm2m-secret';
    fetchMock.mockResolvedValueOnce(okTokenResponse('tok-1', 3600));

    const getManagementToken = await loadGetManagementToken();
    const result = await getManagementToken(ENDPOINT);

    expect(result).toBe('tok-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENDPOINT}/oidc/token`);
    expect(options.method).toBe('POST');
    const body = options.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('m2m-id');
    expect(body.get('client_secret')).toBe('m2m-secret');
    expect(body.get('resource')).toBe('https://default.logto.app/api');
    expect(body.get('scope')).toBe('all');
  });

  it('serves the cached token on a second call within the validity window', async () => {
    process.env.LOGTO_M2M_APP_ID = 'm2m-id';
    process.env.LOGTO_M2M_APP_SECRET = 'm2m-secret';
    fetchMock.mockResolvedValueOnce(okTokenResponse('tok-1', 3600));

    const getManagementToken = await loadGetManagementToken();
    expect(await getManagementToken(ENDPOINT)).toBe('tok-1');

    // 10 minutes later — still well within the 1h validity (minus 60s margin)
    vi.advanceTimersByTime(10 * 60_000);
    expect(await getManagementToken(ENDPOINT)).toBe('tok-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches once the cached token passes the expiry margin', async () => {
    process.env.LOGTO_M2M_APP_ID = 'm2m-id';
    process.env.LOGTO_M2M_APP_SECRET = 'm2m-secret';
    fetchMock
      .mockResolvedValueOnce(okTokenResponse('tok-1', 3600))
      .mockResolvedValueOnce(okTokenResponse('tok-2', 3600));

    const getManagementToken = await loadGetManagementToken();
    expect(await getManagementToken(ENDPOINT)).toBe('tok-1');

    // Past expiresAt - 60s: 3600s validity, advance 3540s + 1ms tips it over.
    vi.advanceTimersByTime(3600_000 - 60_000 + 1);
    expect(await getManagementToken(ENDPOINT)).toBe('tok-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null and warns when the token endpoint responds non-ok', async () => {
    process.env.LOGTO_M2M_APP_ID = 'm2m-id';
    process.env.LOGTO_M2M_APP_SECRET = 'm2m-secret';
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'unauthorized',
    });

    const getManagementToken = await loadGetManagementToken();
    expect(await getManagementToken(ENDPOINT)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
