import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users, clients, projects, projectMembers, tags, timeEntries, entryTags } from '../db/schema.js';
import { referenceRoutes } from './reference.js';

// Integration tests for:
//   GET    /api/projects
//   GET    /api/tags
//   POST   /api/tags
//   PATCH  /api/tags/:id
//   DELETE /api/tags/:id
//   GET    /api/users

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(referenceRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(role: 'admin' | 'user' = 'admin') {
  const [u] = await db
    .insert(users)
    .values({ displayName: `U-${Math.random()}`, email: `u${Math.random()}@acme.io`, globalRole: role })
    .returning();
  return u!;
}

async function makeProject(name = 'Acme Web', active = true) {
  const [c] = await db.insert(clients).values({ name: `${name} Client` }).returning();
  const [p] = await db
    .insert(projects)
    .values({ name, clientId: c!.id, isActive: active })
    .returning();
  return p!;
}

async function makeTag(userId: string, name = 'Billable', color?: string) {
  const [t] = await db
    .insert(tags)
    .values({ name, color: color ?? null, userId })
    .returning();
  return t!;
}

// ── GET /api/projects ────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  it('returns all active projects for an admin user', async () => {
    const admin = await makeUser('admin');
    const p1 = await makeProject('Alpha');
    const p2 = await makeProject('Beta');

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { 'x-dev-user-id': admin.id },
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json<Array<{ id: string }>>().map((r) => r.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
  });

  it('excludes inactive projects', async () => {
    const admin = await makeUser('admin');
    const active = await makeProject('Active');
    const inactive = await makeProject('Inactive', false);

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { 'x-dev-user-id': admin.id },
    });
    const ids = res.json<Array<{ id: string }>>().map((r) => r.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(inactive.id);
  });

  it('returns only assigned projects for a regular user', async () => {
    const u = await makeUser('user');
    const assigned = await makeProject('Assigned');
    const unassigned = await makeProject('Unassigned');
    await db.insert(projectMembers).values({ userId: u.id, projectId: assigned.id, role: 'user' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { 'x-dev-user-id': u.id },
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json<Array<{ id: string }>>().map((r) => r.id);
    expect(ids).toContain(assigned.id);
    expect(ids).not.toContain(unassigned.id);
  });

  it('returns empty list for a regular user with no memberships', async () => {
    const u = await makeUser('user');
    await makeProject('Some Project');

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { 'x-dev-user-id': u.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('respects ?assigned=true for admin (forces assignment filter)', async () => {
    const admin = await makeUser('admin');
    const p1 = await makeProject('AdminAssigned');
    const p2 = await makeProject('AdminNotAssigned');
    await db.insert(projectMembers).values({ userId: admin.id, projectId: p1.id, role: 'manager' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects?assigned=true',
      headers: { 'x-dev-user-id': admin.id },
    });
    const ids = res.json<Array<{ id: string }>>().map((r) => r.id);
    expect(ids).toContain(p1.id);
    expect(ids).not.toContain(p2.id);
  });

  it('includes clientName in the response', async () => {
    const admin = await makeUser('admin');
    await makeProject('ClientTest');

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { 'x-dev-user-id': admin.id },
    });
    const rows = res.json<Array<{ clientName: string | null }>>()
    expect(rows.every((r) => 'clientName' in r)).toBe(true);
  });
});

// ── GET /api/tags ─────────────────────────────────────────────────────────────

describe('GET /api/tags', () => {
  it("returns only the caller's own tags ordered by name", async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const t1 = await makeTag(alice.id, 'Zzz');
    const t2 = await makeTag(alice.id, 'Aaa');
    await makeTag(bob.id, 'Bob tag');

    const res = await app.inject({
      method: 'GET',
      url: '/api/tags',
      headers: { 'x-dev-user-id': alice.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ id: string; name: string }>>()
    expect(body.map((t) => t.id)).toEqual([t2.id, t1.id]); // alphabetical
  });

  it('returns an empty array when the user has no tags', async () => {
    const u = await makeUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/tags',
      headers: { 'x-dev-user-id': u.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

// ── POST /api/tags ────────────────────────────────────────────────────────────

describe('POST /api/tags', () => {
  it('creates a tag and returns 201 with the new row', async () => {
    const u = await makeUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/tags',
      headers: { 'x-dev-user-id': u.id },
      payload: { name: 'Billable', color: '#FF0000' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; name: string; color: string | null }>();
    expect(body.name).toBe('Billable');
    expect(body.color).toBe('#FF0000');

    // Verify DB
    const [row] = await db.select().from(tags).where(eq(tags.id, body.id));
    expect(row!.userId).toBe(u.id);
  });

  it('creates a tag without a color (null)', async () => {
    const u = await makeUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/tags',
      headers: { 'x-dev-user-id': u.id },
      payload: { name: 'NoColor' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ color: null }>().color).toBeNull();
  });

  it('returns 400 for missing name', async () => {
    const u = await makeUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/tags',
      headers: { 'x-dev-user-id': u.id },
      payload: { color: '#FF0000' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /api/tags/:id ───────────────────────────────────────────────────────

describe('PATCH /api/tags/:id', () => {
  it('updates name and returns the updated tag', async () => {
    const u = await makeUser();
    const tag = await makeTag(u.id, 'Old');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tags/${tag.id}`,
      headers: { 'x-dev-user-id': u.id },
      payload: { name: 'New' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ name: string }>().name).toBe('New');
  });

  it('returns 404 when the tag does not belong to the caller', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const tag = await makeTag(bob.id, 'Bob tag');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tags/${tag.id}`,
      headers: { 'x-dev-user-id': alice.id },
      payload: { name: 'Stolen' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when no fields are provided', async () => {
    const u = await makeUser();
    const tag = await makeTag(u.id, 'X');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tags/${tag.id}`,
      headers: { 'x-dev-user-id': u.id },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /api/tags/:id ──────────────────────────────────────────────────────

describe('DELETE /api/tags/:id', () => {
  it('deletes the tag and returns 204', async () => {
    const u = await makeUser();
    const tag = await makeTag(u.id, 'DeleteMe');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/tags/${tag.id}`,
      headers: { 'x-dev-user-id': u.id },
    });
    expect(res.statusCode).toBe(204);

    // Verify it's gone from the DB
    const rows = await db.select().from(tags).where(eq(tags.id, tag.id));
    expect(rows).toHaveLength(0);
  });

  it('removes entry_tags associations before deleting the tag', async () => {
    const u = await makeUser();
    const tag = await makeTag(u.id, 'WithEntries');
    const [entry] = await db
      .insert(timeEntries)
      .values({ userId: u.id, description: 'Task' })
      .returning();
    await db.insert(entryTags).values({ entryId: entry!.id, tagId: tag.id });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/tags/${tag.id}`,
      headers: { 'x-dev-user-id': u.id },
    });
    expect(res.statusCode).toBe(204);

    const assocs = await db
      .select()
      .from(entryTags)
      .where(eq(entryTags.tagId, tag.id));
    expect(assocs).toHaveLength(0);
  });

  it('returns 404 for a tag that belongs to another user', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const tag = await makeTag(bob.id, "Bob's private");

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/tags/${tag.id}`,
      headers: { 'x-dev-user-id': alice.id },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── GET /api/users ────────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('returns all users for an admin', async () => {
    const admin = await makeUser('admin');
    const other = await makeUser('user');

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { 'x-dev-user-id': admin.id },
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json<Array<{ id: string }>>().map((r) => r.id);
    expect(ids).toContain(admin.id);
    expect(ids).toContain(other.id);
  });

  it('returns 403 for a non-admin user', async () => {
    const u = await makeUser('user');

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { 'x-dev-user-id': u.id },
    });
    expect(res.statusCode).toBe(403);
  });

  it('includes id, displayName, email, globalRole, active, avatarUrl in each row', async () => {
    const admin = await makeUser('admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { 'x-dev-user-id': admin.id },
    });
    const rows = res.json<Array<Record<string, unknown>>>();
    for (const row of rows) {
      expect(Object.keys(row)).toEqual(
        expect.arrayContaining(['id', 'displayName', 'email', 'globalRole', 'active', 'avatarUrl']),
      );
    }
  });
});
