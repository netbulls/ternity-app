import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users } from '../db/schema.js';
import { meRoutes } from './me.js';

// Integration tests for the Logto avatar/phone refresh branch of GET /api/me.
//
// In production this block runs when AUTH_MODE=logto and LOGTO_ENDPOINT is set:
// it fetches the user from Logto's Management API and syncs avatar + phone back
// into our DB. The plain stub-mode tests in me.test.ts deliberately don't touch
// this branch (a live Logto isn't available in tests).
//
// We mock `getManagementToken` from the auth plugin and `globalThis.fetch` so the
// branch is exercised end-to-end without a real Logto. AUTH_MODE/LOGTO_ENDPOINT
// are flipped per-test; buildApp() initially forces stub mode for the auth hook,
// but me.ts reads process.env.AUTH_MODE inline in the handler, so changing it
// later doesn't affect how request.auth is built (still stub) but DOES switch the
// route into its Logto-refresh branch — exactly what we need.

// Replace just `getManagementToken` while keeping the default export (authPlugin)
// real, so buildApp can still register stub auth.
vi.mock('../plugins/auth.js', async () => {
  const actual = await vi.importActual<typeof import('../plugins/auth.js')>('../plugins/auth.js');
  return {
    ...actual,
    getManagementToken: vi.fn(),
  };
});

const LOGTO_ENDPOINT = 'https://test-auth.example.com';
const MGMT_TOKEN = 'test-management-token';

let app: FastifyInstance;
let getManagementTokenMock: Mock;
const fetchMock = vi.fn();

const originalAuthMode = process.env.AUTH_MODE;
const originalLogtoEndpoint = process.env.LOGTO_ENDPOINT;

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function notOk(status: number, body: string) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  };
}

async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      displayName: 'Elena Marsh',
      email: `elena${Math.random()}@acme.io`,
      globalRole: 'user',
      ...overrides,
    })
    .returning();
  return u!;
}

beforeAll(async () => {
  app = await buildApp(meRoutes);
  const auth = await import('../plugins/auth.js');
  getManagementTokenMock = auth.getManagementToken as unknown as Mock;
});

afterAll(async () => {
  await app.close();
  // Restore env so subsequent test files (and the dev shell) see what they expect.
  if (originalAuthMode === undefined) delete process.env.AUTH_MODE;
  else process.env.AUTH_MODE = originalAuthMode;
  if (originalLogtoEndpoint === undefined) delete process.env.LOGTO_ENDPOINT;
  else process.env.LOGTO_ENDPOINT = originalLogtoEndpoint;
});

beforeEach(async () => {
  await truncateAll();
  fetchMock.mockReset();
  getManagementTokenMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Default: Logto mode + endpoint set. Individual tests override as needed.
  process.env.AUTH_MODE = 'logto';
  process.env.LOGTO_ENDPOINT = LOGTO_ENDPOINT;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function get(userId: string) {
  return app.inject({ method: 'GET', url: '/api/me', headers: { 'x-dev-user-id': userId } });
}

// ─── gate condition (process.env.AUTH_MODE === 'logto' && logtoEndpoint) ───────

describe('GET /api/me — Logto refresh gate', () => {
  it('enters the Logto branch when AUTH_MODE=logto AND LOGTO_ENDPOINT is set', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1' });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(okJson({}));

    await get(u.id);

    expect(getManagementTokenMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('skips the Logto branch in stub mode even if LOGTO_ENDPOINT is set', async () => {
    process.env.AUTH_MODE = 'stub';
    const u = await makeUser({ externalAuthId: 'logto-user-1' });

    await get(u.id);

    expect(getManagementTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the Logto branch when LOGTO_ENDPOINT is unset (even with AUTH_MODE=logto)', async () => {
    delete process.env.LOGTO_ENDPOINT;
    const u = await makeUser({ externalAuthId: 'logto-user-1' });

    await get(u.id);

    expect(getManagementTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── internal gates inside the branch ─────────────────────────────────────────

describe('GET /api/me — Logto refresh: internal gates', () => {
  it('does not call Logto when the local user has no externalAuthId', async () => {
    const u = await makeUser({ externalAuthId: null });

    await get(u.id);

    // externalAuthId guard short-circuits before getManagementToken/fetch
    expect(getManagementTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch from Logto when no management token is available', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1' });
    getManagementTokenMock.mockResolvedValueOnce(null);

    await get(u.id);

    expect(getManagementTokenMock).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the management token as Bearer auth and the right Logto URL', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1' });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(okJson({}));

    await get(u.id);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe(`${LOGTO_ENDPOINT}/api/users/logto-user-1`);
    expect((calledInit as RequestInit).headers).toEqual({
      Authorization: `Bearer ${MGMT_TOKEN}`,
    });
  });
});

// ─── avatar resolution (top-level vs identity fallback) ───────────────────────

describe('GET /api/me — Logto refresh: avatar resolution', () => {
  it('uses the top-level avatar when Logto returns one', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1', avatarUrl: null });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(
      okJson({ avatar: 'https://cdn.example.com/top.png' }),
    );

    const res = await get(u.id);

    expect(res.statusCode).toBe(200);
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.avatarUrl).toBe('https://cdn.example.com/top.png');
  });

  it('falls back to an identity-level avatar when top-level avatar is missing', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1', avatarUrl: null });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(
      okJson({
        identities: {
          google: { details: { avatar: 'https://lh3.googleusercontent.com/social.png' } },
        },
      }),
    );

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.avatarUrl).toBe('https://lh3.googleusercontent.com/social.png');
  });

  it('sets avatar to null when Logto has no avatar anywhere and the user previously had one', async () => {
    const u = await makeUser({
      externalAuthId: 'logto-user-1',
      avatarUrl: 'https://old.example.com/a.png',
    });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(okJson({}));

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.avatarUrl).toBeNull();
  });

  it('safely skips identity entries that have no `details` (no crash, no avatar update)', async () => {
    // Real Logto identities can be shape-incomplete (no `details`). The route relies on
    // optional chaining (`id.details?.avatar`) to skip them safely. Without this test,
    // mutations that remove the `?.` survive — they would NOT crash in production for
    // perfectly-shaped data, only for an identity without details.
    const u = await makeUser({
      externalAuthId: 'logto-user-1',
      avatarUrl: 'https://cdn.example.com/keep.png',
    });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(
      okJson({
        identities: {
          broken: {}, // no details
          alsoBroken: { details: {} }, // details present but no avatar
        },
      }),
    );

    const res = await get(u.id);

    // Route survives, returns 200, and the avatar resolves to null (no candidate found)
    expect(res.statusCode).toBe(200);
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.avatarUrl).toBeNull();
  });

  it('prefers the top-level avatar over an identity-level one when both are present', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1', avatarUrl: null });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(
      okJson({
        avatar: 'https://cdn.example.com/top.png',
        identities: {
          google: { details: { avatar: 'https://lh3.googleusercontent.com/social.png' } },
        },
      }),
    );

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.avatarUrl).toBe('https://cdn.example.com/top.png');
  });
});

// ─── phone normalization (+ prefix handling) ──────────────────────────────────

describe('GET /api/me — Logto refresh: phone normalization', () => {
  it('keeps a phone number that already starts with "+" as-is', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1', phone: null });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(okJson({ primaryPhone: '+48123456789' }));

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.phone).toBe('+48123456789');
  });

  it('prepends "+" to a phone number that has none', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1', phone: null });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(okJson({ primaryPhone: '48123456789' }));

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.phone).toBe('+48123456789');
  });

  it('trims whitespace from the Logto-provided phone', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1', phone: null });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(okJson({ primaryPhone: '  +48123456789  ' }));

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.phone).toBe('+48123456789');
  });

  it('sets phone to null when Logto returns no primaryPhone', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1', phone: '+11111111111' });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(okJson({}));

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.phone).toBeNull();
  });
});

// ─── DB write discipline (only on actual change) ──────────────────────────────

describe('GET /api/me — Logto refresh: DB update discipline', () => {
  it('does NOT touch the DB row when avatar and phone are already up to date', async () => {
    const u = await makeUser({
      externalAuthId: 'logto-user-1',
      avatarUrl: 'https://cdn.example.com/same.png',
      phone: '+48123456789',
    });
    const beforeUpdatedAt = u.updatedAt;
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(
      okJson({ avatar: 'https://cdn.example.com/same.png', primaryPhone: '+48123456789' }),
    );

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    // updatedAt would change if `db.update(...).set({ updatedAt: new Date() })` ran
    expect(row!.updatedAt).toEqual(beforeUpdatedAt);
    expect(row!.avatarUrl).toBe('https://cdn.example.com/same.png');
    expect(row!.phone).toBe('+48123456789');
  });

  it('updates only the changed columns, leaving the other intact', async () => {
    const u = await makeUser({
      externalAuthId: 'logto-user-1',
      avatarUrl: 'https://cdn.example.com/old.png',
      phone: '+48999999999',
    });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    // Avatar changes; phone stays the same.
    fetchMock.mockResolvedValueOnce(
      okJson({ avatar: 'https://cdn.example.com/new.png', primaryPhone: '+48999999999' }),
    );

    await get(u.id);

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.avatarUrl).toBe('https://cdn.example.com/new.png');
    expect(row!.phone).toBe('+48999999999');
  });
});

// ─── error paths (non-ok response, fetch throws) ──────────────────────────────

describe('GET /api/me — Logto refresh: error paths', () => {
  it('does not touch the DB row when Logto returns a non-ok response', async () => {
    const u = await makeUser({
      externalAuthId: 'logto-user-1',
      avatarUrl: 'https://cdn.example.com/keep.png',
      phone: '+48123456789',
    });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockResolvedValueOnce(notOk(503, 'service unavailable'));

    const res = await get(u.id);

    expect(res.statusCode).toBe(200); // request still succeeds; refresh is best-effort
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.avatarUrl).toBe('https://cdn.example.com/keep.png');
    expect(row!.phone).toBe('+48123456789');
  });

  it('catches a thrown fetch error and still returns the profile (refresh is best-effort)', async () => {
    const u = await makeUser({ externalAuthId: 'logto-user-1' });
    getManagementTokenMock.mockResolvedValueOnce(MGMT_TOKEN);
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

    const res = await get(u.id);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ userId: u.id });
  });
});
