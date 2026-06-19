import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { clients, projectMembers, projects, users } from '../db/schema.js';
import authPlugin from './auth.js';

// Integration tests for the auth plugin in stub mode (AUTH_MODE=stub) + the
// impersonation hook. These exercise real user resolution + buildOrgRoles +
// impersonation RBAC against a live Postgres, driven through Fastify's inject().
// No external services: stub mode reads the acting user straight from the DB.

let app: FastifyInstance;

beforeAll(async () => {
  process.env.AUTH_MODE = 'stub';
  app = Fastify();
  await app.register(authPlugin);
  // Echo the resolved auth context so assertions can inspect it.
  app.get('/whoami', async (req) => req.auth);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateAll();
  delete process.env.DEV_USER_ROLE;
  delete process.env.DEV_ADMIN_ID;
  delete process.env.DEV_USER_ID;
});

async function makeUser(opts: {
  displayName?: string;
  email?: string;
  globalRole?: 'admin' | 'user';
  createdAt?: Date;
}) {
  const [u] = await db
    .insert(users)
    .values({
      displayName: opts.displayName ?? 'U',
      email: opts.email ?? null,
      globalRole: opts.globalRole ?? 'user',
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    })
    .returning();
  return u!;
}

async function makeProject(name: string) {
  const [c] = await db.insert(clients).values({ name: `${name} Client` }).returning();
  const [p] = await db.insert(projects).values({ name, clientId: c!.id }).returning();
  return p!;
}

const whoami = async (headers: Record<string, string> = {}) => {
  const res = await app.inject({ method: 'GET', url: '/whoami', headers });
  return { status: res.statusCode, body: res.json() };
};

describe('auth stub mode — user resolution', () => {
  it('resolves the user named by the x-dev-user-id header', async () => {
    await makeUser({ displayName: 'Other', globalRole: 'admin' });
    const target = await makeUser({ displayName: 'Elena', email: 'elena@x.io', globalRole: 'user' });

    const { status, body } = await whoami({ 'x-dev-user-id': target.id });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      userId: target.id,
      displayName: 'Elena',
      email: 'elena@x.io',
      globalRole: 'user',
      orgRoles: {},
    });
  });

  it('builds orgRoles from project memberships', async () => {
    const u = await makeUser({ globalRole: 'user' });
    const pa = await makeProject('Apollo');
    const pb = await makeProject('Beacon');
    await db.insert(projectMembers).values({ userId: u.id, projectId: pa.id, role: 'manager' });
    await db.insert(projectMembers).values({ userId: u.id, projectId: pb.id, role: 'user' });

    const { body } = await whoami({ 'x-dev-user-id': u.id });
    expect(body.orgRoles).toEqual({ [pa.id]: 'manager', [pb.id]: 'user' });
  });

  it('falls back to "unknown" when there are no users at all', async () => {
    const { status, body } = await whoami();
    expect(status).toBe(200);
    expect(body).toMatchObject({ userId: 'unknown', globalRole: 'user', orgRoles: {} });
  });

  it('with no header, picks the earliest user of the default role (admin)', async () => {
    await makeUser({ displayName: 'PlainUser', globalRole: 'user' });
    const olderAdmin = await makeUser({
      displayName: 'OldAdmin',
      globalRole: 'admin',
      createdAt: new Date('2020-01-01T00:00:00Z'),
    });
    await makeUser({
      displayName: 'NewAdmin',
      globalRole: 'admin',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });

    const { body } = await whoami(); // DEV_USER_ROLE unset → defaults to 'admin'
    expect(body.userId).toBe(olderAdmin.id);
    expect(body.displayName).toBe('OldAdmin');
  });

  it('honors DEV_USER_ROLE=user', async () => {
    await makeUser({ displayName: 'Admin', globalRole: 'admin' });
    const plain = await makeUser({ displayName: 'Plain', globalRole: 'user' });

    process.env.DEV_USER_ROLE = 'user';
    const { body } = await whoami();
    expect(body.userId).toBe(plain.id);
  });

  it('honors an explicit DEV_ADMIN_ID', async () => {
    await makeUser({
      displayName: 'FirstAdmin',
      globalRole: 'admin',
      createdAt: new Date('2020-01-01T00:00:00Z'),
    });
    const chosen = await makeUser({
      displayName: 'ChosenAdmin',
      globalRole: 'admin',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });

    process.env.DEV_ADMIN_ID = chosen.id;
    const { body } = await whoami();
    expect(body.userId).toBe(chosen.id);
  });

  it('falls back to the first user overall when no one matches the role', async () => {
    const onlyUser = await makeUser({ displayName: 'Solo', globalRole: 'user' });
    // default role is admin, but there is no admin → fall back to first user overall
    const { body } = await whoami();
    expect(body.userId).toBe(onlyUser.id);
  });
});

describe('auth stub mode — impersonation', () => {
  it('lets an admin impersonate another user', async () => {
    const admin = await makeUser({ displayName: 'Admin', globalRole: 'admin' });
    const target = await makeUser({ displayName: 'Target', email: 't@x.io', globalRole: 'user' });
    const p = await makeProject('Apollo');
    await db.insert(projectMembers).values({ userId: target.id, projectId: p.id, role: 'manager' });

    const { status, body } = await whoami({
      'x-dev-user-id': admin.id,
      'x-impersonate-user-id': target.id,
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({
      userId: target.id,
      displayName: 'Target',
      impersonating: true,
      realUserId: admin.id,
      orgRoles: { [p.id]: 'manager' },
    });
  });

  it('rejects impersonation by a non-admin with 403', async () => {
    const user = await makeUser({ displayName: 'Plain', globalRole: 'user' });
    const target = await makeUser({ displayName: 'Target', globalRole: 'user' });

    const { status } = await whoami({
      'x-dev-user-id': user.id,
      'x-impersonate-user-id': target.id,
    });
    expect(status).toBe(403);
  });

  it('returns 404 when the impersonation target does not exist', async () => {
    const admin = await makeUser({ displayName: 'Admin', globalRole: 'admin' });

    const { status } = await whoami({
      'x-dev-user-id': admin.id,
      'x-impersonate-user-id': '00000000-0000-0000-0000-000000000000',
    });
    expect(status).toBe(404);
  });

  it('is a no-op when an admin "impersonates" themselves', async () => {
    const admin = await makeUser({ displayName: 'Admin', globalRole: 'admin' });

    const { status, body } = await whoami({
      'x-dev-user-id': admin.id,
      'x-impersonate-user-id': admin.id,
    });
    expect(status).toBe(200);
    expect(body.userId).toBe(admin.id);
    expect(body.impersonating).toBeUndefined();
  });
});
