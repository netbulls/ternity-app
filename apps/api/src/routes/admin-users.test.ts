import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { clients, projects, users } from '../db/schema.js';
import { adminUsersRoutes } from './admin-users.js';

// Characterization tests for GET/PATCH /api/admin/users/* routes.
// All endpoints require globalRole='admin'.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(adminUsersRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(role: 'admin' | 'user' = 'admin', over: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db
    .insert(users)
    .values({ displayName: 'Test User', email: `u${Math.random()}@x.io`, globalRole: role, ...over })
    .returning();
  return u!;
}

async function makeProject(name = 'Web') {
  const [c] = await db.insert(clients).values({ name: `${name} Client` }).returning();
  const [p] = await db.insert(projects).values({ name, clientId: c!.id }).returning();
  return p!;
}

const get = async (url: string, userId: string) => {
  const res = await app.inject({ method: 'GET', url, headers: { 'x-dev-user-id': userId } });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};
const patch = async (url: string, userId: string, body?: unknown) => {
  const res = await app.inject({ method: 'PATCH', url, headers: { 'x-dev-user-id': userId }, payload: body as object });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};
const post = async (url: string, userId: string, body?: unknown) => {
  const res = await app.inject({ method: 'POST', url, headers: { 'x-dev-user-id': userId }, payload: body as object });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};

// ── GET /api/admin/users ────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await get('/api/admin/users', u.id)).status).toBe(403);
  });

  it('returns all users with stats for admin', async () => {
    const admin = await makeUser('admin');
    const { status, body } = await get('/api/admin/users', admin.id);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    const row = body[0];
    expect(row).toMatchObject({
      id: admin.id,
      displayName: admin.displayName,
      email: admin.email,
      globalRole: 'admin',
      active: true,
      entryCount: 0,
    });
    expect(row).toHaveProperty('lastEntryAt');
  });

  it('filters by status=active', async () => {
    const admin = await makeUser('admin');
    await makeUser('user', { displayName: 'Inactive', active: false });
    const { body } = await get('/api/admin/users?status=active', admin.id);
    expect(body.every((u: { active: boolean }) => u.active === true)).toBe(true);
  });

  it('filters by status=inactive', async () => {
    const admin = await makeUser('admin');
    await makeUser('user', { displayName: 'Inactive', active: false });
    const { body } = await get('/api/admin/users?status=inactive', admin.id);
    expect(body.every((u: { active: boolean }) => u.active === false)).toBe(true);
  });

  it('filters by search term (case-insensitive name match)', async () => {
    const admin = await makeUser('admin', { displayName: 'Alice Admin', email: 'alice@acme.io' });
    await makeUser('user', { displayName: 'Bob User', email: 'bob@acme.io' });
    const { body } = await get('/api/admin/users?search=alice', admin.id);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(admin.id);
  });

  it('filters by search term matching email', async () => {
    const admin = await makeUser('admin', { displayName: 'Alice Admin', email: 'unique-addr@example.io' });
    await makeUser('user', { displayName: 'Bob', email: 'bob@example.io' });
    const { body } = await get('/api/admin/users?search=unique-addr', admin.id);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(admin.id);
  });

  it('includes teamName and teamColor when user has a defaultProject', async () => {
    const admin = await makeUser('admin');
    const p = await makeProject('Apollo');
    await db.update(users).set({ defaultProjectId: p.id }).where(eq(users.id, admin.id));
    const { body } = await get('/api/admin/users', admin.id);
    expect(body[0]).toMatchObject({ teamName: 'Apollo', teamColor: p.color });
  });

  it('returns results ordered by displayName ascending', async () => {
    const admin = await makeUser('admin', { displayName: 'Zara' });
    await makeUser('user', { displayName: 'Anna' });
    const { body } = await get('/api/admin/users', admin.id);
    const names: string[] = body.map((u: { displayName: string }) => u.displayName);
    expect(names).toEqual([...names].sort());
  });
});

// ── PATCH /api/admin/users/:id/team ────────────────────────────────────────

describe('PATCH /api/admin/users/:id/team', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const { status } = await patch(`/api/admin/users/${u.id}/team`, u.id, { projectId: null });
    expect(status).toBe(403);
  });

  it('sets the defaultProject for a user', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();

    const { status, body } = await patch(`/api/admin/users/${target.id}/team`, admin.id, { projectId: p.id });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row!.defaultProjectId).toBe(p.id);
  });

  it('clears the defaultProject when projectId is null', async () => {
    const admin = await makeUser('admin');
    const p = await makeProject();
    const target = await makeUser('user', { defaultProjectId: p.id });

    await patch(`/api/admin/users/${target.id}/team`, admin.id, { projectId: null });
    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row!.defaultProjectId).toBeNull();
  });

  it('returns 400 when project does not exist', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const { status } = await patch(`/api/admin/users/${target.id}/team`, admin.id, {
      projectId: '00000000-0000-0000-0000-000000000000',
    });
    expect(status).toBe(400);
  });

  it('returns 404 when user does not exist', async () => {
    const admin = await makeUser('admin');
    const { status } = await patch('/api/admin/users/00000000-0000-0000-0000-000000000000/team', admin.id, {
      projectId: null,
    });
    expect(status).toBe(404);
  });

  it('returns 400 for a non-UUID projectId (validated by schema)', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const { status } = await patch(`/api/admin/users/${target.id}/team`, admin.id, {
      projectId: 'not-a-uuid',
    });
    expect(status).toBe(400);
  });
});

// ── PATCH /api/admin/users/:id/employment-type ─────────────────────────────

describe('PATCH /api/admin/users/:id/employment-type', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const { status } = await patch(`/api/admin/users/${u.id}/employment-type`, u.id, { employmentType: 'employee' });
    expect(status).toBe(403);
  });

  it('updates employmentType to employee', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user', { employmentType: 'contractor' });

    const { status, body } = await patch(`/api/admin/users/${target.id}/employment-type`, admin.id, {
      employmentType: 'employee',
    });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row!.employmentType).toBe('employee');
  });

  it('updates employmentType to contractor', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user', { employmentType: 'employee' });

    await patch(`/api/admin/users/${target.id}/employment-type`, admin.id, { employmentType: 'contractor' });
    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row!.employmentType).toBe('contractor');
  });

  it('returns 400 for an invalid employmentType', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    // Body is validated by SetEmploymentTypeSchema (enum), so 'freelancer' is a ZodError → 400.
    const { status } = await patch(`/api/admin/users/${target.id}/employment-type`, admin.id, {
      employmentType: 'freelancer',
    });
    expect(status).toBe(400);
  });

  it('returns 400 for a missing/malformed employmentType (validated by schema)', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    expect((await patch(`/api/admin/users/${target.id}/employment-type`, admin.id, {})).status).toBe(400);
    expect(
      (await patch(`/api/admin/users/${target.id}/employment-type`, admin.id, { employmentType: 42 })).status,
    ).toBe(400);
  });

  it('returns 404 when user does not exist', async () => {
    const admin = await makeUser('admin');
    const { status } = await patch('/api/admin/users/00000000-0000-0000-0000-000000000000/employment-type', admin.id, {
      employmentType: 'contractor',
    });
    expect(status).toBe(404);
  });
});

// ── PATCH /api/admin/users/:id/activate & /deactivate ──────────────────────

describe('PATCH /api/admin/users/:id/activate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await patch(`/api/admin/users/${u.id}/activate`, u.id)).status).toBe(403);
  });

  it('sets active=true on the target user', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user', { active: false });

    const { status, body } = await patch(`/api/admin/users/${target.id}/activate`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row!.active).toBe(true);
  });

  it('returns 404 for unknown user', async () => {
    const admin = await makeUser('admin');
    expect((await patch('/api/admin/users/00000000-0000-0000-0000-000000000000/activate', admin.id)).status).toBe(404);
  });
});

describe('PATCH /api/admin/users/:id/deactivate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await patch(`/api/admin/users/${u.id}/deactivate`, u.id)).status).toBe(403);
  });

  it('sets active=false on the target user', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user', { active: true });

    const { status, body } = await patch(`/api/admin/users/${target.id}/deactivate`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row!.active).toBe(false);
  });

  it('returns 404 for unknown user', async () => {
    const admin = await makeUser('admin');
    expect((await patch('/api/admin/users/00000000-0000-0000-0000-000000000000/deactivate', admin.id)).status).toBe(404);
  });
});

// ── POST /api/admin/users/bulk-activate & /bulk-deactivate ─────────────────

describe('POST /api/admin/users/bulk-activate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/users/bulk-activate', u.id, { userIds: [u.id] })).status).toBe(403);
  });

  it('returns 400 when userIds is empty', async () => {
    const admin = await makeUser('admin');
    expect((await post('/api/admin/users/bulk-activate', admin.id, { userIds: [] })).status).toBe(400);
  });

  it('returns 400 when userIds is missing', async () => {
    const admin = await makeUser('admin');
    expect((await post('/api/admin/users/bulk-activate', admin.id, {})).status).toBe(400);
  });

  it('returns 400 for a malformed userIds (validated by schema)', async () => {
    const admin = await makeUser('admin');
    expect((await post('/api/admin/users/bulk-activate', admin.id, { userIds: 'nope' })).status).toBe(400);
    expect((await post('/api/admin/users/bulk-activate', admin.id, { userIds: ['not-a-uuid'] })).status).toBe(400);
  });

  it('activates multiple users and returns count', async () => {
    const admin = await makeUser('admin');
    const u1 = await makeUser('user', { active: false });
    const u2 = await makeUser('user', { active: false });

    const { status, body } = await post('/api/admin/users/bulk-activate', admin.id, { userIds: [u1.id, u2.id] });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, count: 2 });

    const rows = await db.select().from(users).where(eq(users.active, false));
    // none of u1/u2 remain inactive
    expect(rows.filter((r) => r.id === u1.id || r.id === u2.id)).toHaveLength(0);
  });

  it('silently ignores unknown userIds (count reflects actual DB matches)', async () => {
    const admin = await makeUser('admin');
    const { body } = await post('/api/admin/users/bulk-activate', admin.id, {
      userIds: ['00000000-0000-0000-0000-000000000001'],
    });
    // No rows matched → count 0, but request succeeds
    expect(body.success).toBe(true);
    expect(body.count).toBe(0);
  });
});

describe('POST /api/admin/users/bulk-deactivate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/users/bulk-deactivate', u.id, { userIds: [u.id] })).status).toBe(403);
  });

  it('returns 400 when userIds is missing', async () => {
    const admin = await makeUser('admin');
    expect((await post('/api/admin/users/bulk-deactivate', admin.id, {})).status).toBe(400);
  });

  it('deactivates multiple users and returns count', async () => {
    const admin = await makeUser('admin');
    const u1 = await makeUser('user', { active: true });
    const u2 = await makeUser('user', { active: true });

    const { status, body } = await post('/api/admin/users/bulk-deactivate', admin.id, { userIds: [u1.id, u2.id] });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, count: 2 });

    for (const id of [u1.id, u2.id]) {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      expect(row!.active).toBe(false);
    }
  });
});
