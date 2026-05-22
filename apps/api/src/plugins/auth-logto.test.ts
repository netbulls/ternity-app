import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { users } from '../db/schema.js';

// Integration tests for the auth plugin in logto mode (AUTH_MODE=logto): JWT
// validation + JIT user provisioning. jose is mocked (we don't sign real tokens
// or serve a JWKS) and global fetch is stubbed for the Logto Management API.
// The module is re-imported per test so the M2M token cache starts empty.

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}));

const ENDPOINT = 'https://logto.test';

let app: FastifyInstance | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await truncateAll();
  vi.resetModules();
  process.env.AUTH_MODE = 'logto';
  process.env.LOGTO_ENDPOINT = ENDPOINT;
  delete process.env.LOGTO_M2M_APP_ID;
  delete process.env.LOGTO_M2M_APP_SECRET;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Build a fresh app (fresh plugin import → empty M2M cache) and set the JWT payload. */
async function buildApp(payload?: Record<string, unknown>) {
  const jose = await import('jose');
  if (payload) {
    vi.mocked(jose.jwtVerify).mockResolvedValue({ payload } as never);
  } else {
    vi.mocked(jose.jwtVerify).mockRejectedValue(new Error('invalid token'));
  }
  const { default: authPlugin } = await import('./auth.js');
  app = Fastify();
  await app.register(authPlugin);
  app.get('/whoami', async (req) => req.auth);
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/api/downloads', async () => ({ ok: true }));
  await app.ready();
  return app;
}

const okJson = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => '',
});

const get = async (url: string, headers: Record<string, string> = {}) => {
  const res = await app!.inject({ method: 'GET', url, headers });
  return { status: res.statusCode, body: res.statusCode === 200 ? res.json() : null };
};
const bearer = (token = 'tok') => ({ authorization: `Bearer ${token}` });

describe('auth logto mode — token validation', () => {
  it('rejects a request with no Authorization header (401)', async () => {
    await buildApp({ sub: 'sub-1' });
    const { status } = await get('/whoami');
    expect(status).toBe(401);
  });

  it('rejects a non-Bearer Authorization header (401)', async () => {
    await buildApp({ sub: 'sub-1' });
    const { status } = await get('/whoami', { authorization: 'Basic abc' });
    expect(status).toBe(401);
  });

  it('rejects a token that fails verification (401)', async () => {
    await buildApp(undefined); // jwtVerify rejects
    const { status } = await get('/whoami', bearer('bad'));
    expect(status).toBe(401);
  });

  it('skips auth for public endpoints (/health, /api/downloads)', async () => {
    await buildApp({ sub: 'sub-1' });
    expect((await get('/health')).status).toBe(200);
    expect((await get('/api/downloads')).status).toBe(200);
  });
});

describe('auth logto mode — JIT provisioning', () => {
  it('resolves an existing user by externalAuthId and applies the token role', async () => {
    const [u] = await db
      .insert(users)
      .values({ displayName: 'Jan', email: 'jan@x.io', externalAuthId: 'sub-1', globalRole: 'user' })
      .returning();

    await buildApp({ sub: 'sub-1', scope: 'admin', roles: [] }); // admin via scope
    const { status, body } = await get('/whoami', bearer());

    expect(status).toBe(200);
    expect(body.userId).toBe(u!.id);
    expect(body.globalRole).toBe('admin'); // token scope upgraded the role
    // and it was persisted
    const [after] = await db.select().from(users).where(eq(users.id, u!.id));
    expect(after!.globalRole).toBe('admin');
  });

  it('creates a minimal "New User" when no M2M creds are configured', async () => {
    await buildApp({ sub: 'sub-new', scope: '', roles: [] });
    const { status, body } = await get('/whoami', bearer());

    expect(status).toBe(200);
    expect(body.displayName).toBe('New User');
    expect(body.globalRole).toBe('user');
    expect(fetchMock).not.toHaveBeenCalled(); // getManagementToken bailed before fetching

    const [created] = await db.select().from(users).where(eq(users.externalAuthId, 'sub-new'));
    expect(created).toBeDefined();
  });

  it('auto-links a new sub to an existing unlinked synced user by email', async () => {
    // synced user with no externalAuthId yet
    const [synced] = await db
      .insert(users)
      .values({ displayName: 'Synced', email: 'match@x.io', togglId: 'T1' })
      .returning();

    process.env.LOGTO_M2M_APP_ID = 'm2m';
    process.env.LOGTO_M2M_APP_SECRET = 'secret';
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/oidc/token')) return okJson({ access_token: 'mgmt', expires_in: 3600 });
      if (url.includes('/api/users/')) return okJson({ primaryEmail: 'match@x.io' });
      throw new Error(`unexpected fetch: ${url}`);
    });

    await buildApp({ sub: 'sub-link', scope: '', roles: [] });
    const { status, body } = await get('/whoami', bearer());

    expect(status).toBe(200);
    expect(body.userId).toBe(synced!.id); // linked the existing row, not a new one
    const [after] = await db.select().from(users).where(eq(users.id, synced!.id));
    expect(after!.externalAuthId).toBe('sub-link');
    expect(await db.select().from(users)).toHaveLength(1); // no duplicate created
  });

  it('creates a new user with the email when no synced profile matches', async () => {
    process.env.LOGTO_M2M_APP_ID = 'm2m';
    process.env.LOGTO_M2M_APP_SECRET = 'secret';
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/oidc/token')) return okJson({ access_token: 'mgmt', expires_in: 3600 });
      if (url.includes('/api/users/'))
        return okJson({ primaryEmail: 'fresh@x.io', name: 'Fresh Person' });
      throw new Error(`unexpected fetch: ${url}`);
    });

    await buildApp({ sub: 'sub-fresh', scope: '', roles: [] });
    const { status, body } = await get('/whoami', bearer());

    expect(status).toBe(200);
    expect(body.email).toBe('fresh@x.io');
    expect(body.displayName).toBe('Fresh Person');
    const [created] = await db.select().from(users).where(eq(users.externalAuthId, 'sub-fresh'));
    expect(created!.email).toBe('fresh@x.io');
  });

  it('derives the admin role from a roles claim', async () => {
    await buildApp({ sub: 'sub-admin', scope: '', roles: ['admin'] });
    const { body } = await get('/whoami', bearer());
    expect(body.globalRole).toBe('admin');
  });
});
