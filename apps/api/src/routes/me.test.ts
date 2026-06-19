import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users } from '../db/schema.js';
import { meRoutes } from './me.js';

// Integration tests for GET /api/me
//
// In AUTH_MODE=stub the route returns request.auth — the auth context built from
// the DB row identified by the x-dev-user-id header. The Logto avatar-refresh
// branch (AUTH_MODE=logto) is NOT exercised here because: (a) the harness forces
// stub mode, (b) it requires a live Logto Management API.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(meRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      displayName: 'Alice Marsh',
      email: `alice${Math.random()}@acme.io`,
      globalRole: 'admin',
      ...overrides,
    })
    .returning();
  return u!;
}

describe('GET /api/me', () => {
  it('returns the authenticated user profile from request.auth', async () => {
    const u = await makeUser({ displayName: 'James Oakley', email: 'james@acme.io' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { 'x-dev-user-id': u.id },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ userId: string; displayName: string; globalRole: string }>();
    expect(body.userId).toBe(u.id);
    expect(body.displayName).toBe('James Oakley');
    expect(body.globalRole).toBe('admin');
  });

  it('reflects the user role correctly for a non-admin user', async () => {
    const u = await makeUser({ displayName: 'Regular User', globalRole: 'user' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { 'x-dev-user-id': u.id },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ globalRole: string }>();
    expect(body.globalRole).toBe('user');
  });

  it('includes avatarUrl and email in the profile', async () => {
    const u = await makeUser({
      displayName: 'Elena Marsh',
      email: 'elena@acme.io',
      avatarUrl: 'https://cdn.acme.io/avatar.png',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { 'x-dev-user-id': u.id },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ email: string; avatarUrl: string | null }>();
    expect(body.email).toBe('elena@acme.io');
    expect(body.avatarUrl).toBe('https://cdn.acme.io/avatar.png');
  });

  it('includes orgRoles reflecting project memberships', async () => {
    // The auth plugin builds orgRoles from the project_members table.
    // In stub mode, the user from the header is loaded and orgRoles populated.
    const u = await makeUser();

    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { 'x-dev-user-id': u.id },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ orgRoles: Record<string, string> }>();
    // No memberships seeded — should be an empty object
    expect(body.orgRoles).toEqual({});
  });

  it('does NOT mutate the DB row in stub mode (no Logto sync)', async () => {
    const u = await makeUser({ avatarUrl: null });

    await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { 'x-dev-user-id': u.id },
    });

    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    // avatarUrl must remain null — the Logto refresh branch is skipped in stub mode
    expect(after!.avatarUrl).toBeNull();
  });
});
