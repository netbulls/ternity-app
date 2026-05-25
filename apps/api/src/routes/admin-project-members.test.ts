import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { clients, projectMembers, projects, users } from '../db/schema.js';
import { adminProjectMembersRoutes } from './admin-project-members.js';

// Characterization tests for project-member admin routes:
//   GET/POST/PATCH/DELETE /api/admin/projects/:projectId/members[/:userId]
//   POST                   /api/admin/projects/:projectId/members/bulk-assign
//   POST                   /api/admin/projects/:projectId/members/bulk-remove
//   GET/POST/DELETE        /api/admin/users/:userId/projects[/:projectId]
// All endpoints require globalRole='admin'.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(adminProjectMembersRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(role: 'admin' | 'user' = 'admin') {
  const [u] = await db
    .insert(users)
    .values({ displayName: 'U', email: `u${Math.random()}@x.io`, globalRole: role })
    .returning();
  return u!;
}
async function makeProject(name = 'Web') {
  const [c] = await db.insert(clients).values({ name: `${name} Client` }).returning();
  const [p] = await db.insert(projects).values({ name, clientId: c!.id }).returning();
  return p!;
}
async function assignMember(userId: string, projectId: string, role: 'manager' | 'user' = 'user') {
  await db.insert(projectMembers).values({ userId, projectId, role });
}
const memberRow = (userId: string, projectId: string) =>
  db.select().from(projectMembers).where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)));

const get = async (url: string, userId: string) => {
  const res = await app.inject({ method: 'GET', url, headers: { 'x-dev-user-id': userId } });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};
const post = async (url: string, userId: string, body?: unknown) => {
  const res = await app.inject({ method: 'POST', url, headers: { 'x-dev-user-id': userId }, payload: body as object });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};
const patch = async (url: string, userId: string, body?: unknown) => {
  const res = await app.inject({ method: 'PATCH', url, headers: { 'x-dev-user-id': userId }, payload: body as object });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};
const del = async (url: string, userId: string) => {
  const res = await app.inject({ method: 'DELETE', url, headers: { 'x-dev-user-id': userId } });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};

// ── GET /api/admin/projects/:projectId/members ──────────────────────────────

describe('GET /api/admin/projects/:projectId/members', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    expect((await get(`/api/admin/projects/${p.id}/members`, u.id)).status).toBe(403);
  });

  it('returns all users with their assignment status for the project', async () => {
    const admin = await makeUser('admin');
    const member = await makeUser('user');
    const p = await makeProject();
    await assignMember(member.id, p.id, 'manager');

    const { status, body } = await get(`/api/admin/projects/${p.id}/members`, admin.id);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);

    const memberRow = body.find((r: { userId: string }) => r.userId === member.id);
    const adminRow = body.find((r: { userId: string }) => r.userId === admin.id);

    expect(memberRow).toMatchObject({ assigned: true, role: 'manager' });
    expect(adminRow).toMatchObject({ assigned: false, role: 'user' }); // default for unassigned
  });

  it('returns assigned=false and role="user" for users not in the project', async () => {
    const admin = await makeUser('admin');
    const other = await makeUser('user');
    const p = await makeProject();

    const { body } = await get(`/api/admin/projects/${p.id}/members`, admin.id);
    const otherRow = body.find((r: { userId: string }) => r.userId === other.id);
    expect(otherRow).toMatchObject({ assigned: false, role: 'user' });
  });
});

// ── POST /api/admin/projects/:projectId/members ─────────────────────────────

describe('POST /api/admin/projects/:projectId/members', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    expect((await post(`/api/admin/projects/${p.id}/members`, u.id, { userId: u.id })).status).toBe(403);
  });

  it('assigns a user to the project with default role "user"', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();

    const { status, body } = await post(`/api/admin/projects/${p.id}/members`, admin.id, { userId: target.id });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const rows = await memberRow(target.id, p.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.role).toBe('user');
  });

  it('assigns a user with role "manager"', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();

    await post(`/api/admin/projects/${p.id}/members`, admin.id, { userId: target.id, role: 'manager' });
    const rows = await memberRow(target.id, p.id);
    expect(rows[0]!.role).toBe('manager');
  });

  it('is idempotent — upserts role on re-assignment', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();

    await post(`/api/admin/projects/${p.id}/members`, admin.id, { userId: target.id, role: 'user' });
    await post(`/api/admin/projects/${p.id}/members`, admin.id, { userId: target.id, role: 'manager' });

    const rows = await memberRow(target.id, p.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.role).toBe('manager'); // updated
  });

  it('returns 400 for invalid userId (not a UUID)', async () => {
    const admin = await makeUser('admin');
    const p = await makeProject();
    const { status } = await post(`/api/admin/projects/${p.id}/members`, admin.id, { userId: 'not-a-uuid' });
    expect(status).toBe(400);
  });
});

// ── PATCH /api/admin/projects/:projectId/members/:userId ────────────────────

describe('PATCH /api/admin/projects/:projectId/members/:userId', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    await assignMember(u.id, p.id);
    expect((await patch(`/api/admin/projects/${p.id}/members/${u.id}`, u.id, { role: 'manager' })).status).toBe(403);
  });

  it('updates the member role', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();
    await assignMember(target.id, p.id, 'user');

    const { status, body } = await patch(`/api/admin/projects/${p.id}/members/${target.id}`, admin.id, { role: 'manager' });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const rows = await memberRow(target.id, p.id);
    expect(rows[0]!.role).toBe('manager');
  });

  it('returns 404 when the membership does not exist', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();
    const { status } = await patch(`/api/admin/projects/${p.id}/members/${target.id}`, admin.id, { role: 'manager' });
    expect(status).toBe(404);
  });

  it('returns 400 for an invalid role value', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();
    await assignMember(target.id, p.id);
    const { status } = await patch(`/api/admin/projects/${p.id}/members/${target.id}`, admin.id, { role: 'superuser' });
    expect(status).toBe(400);
  });
});

// ── DELETE /api/admin/projects/:projectId/members/:userId ───────────────────

describe('DELETE /api/admin/projects/:projectId/members/:userId', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    await assignMember(u.id, p.id);
    expect((await del(`/api/admin/projects/${p.id}/members/${u.id}`, u.id)).status).toBe(403);
  });

  it('removes the membership row', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();
    await assignMember(target.id, p.id);

    const { status, body } = await del(`/api/admin/projects/${p.id}/members/${target.id}`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const rows = await memberRow(target.id, p.id);
    expect(rows).toHaveLength(0);
  });

  it('succeeds silently when the membership did not exist (no error)', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();

    // NOTE: this is a real hard DELETE on the join table (project_members is a
    // join table, not a business entity) — no-delete policy does not apply here.
    const { status } = await del(`/api/admin/projects/${p.id}/members/${target.id}`, admin.id);
    expect(status).toBe(200);
  });
});

// ── POST /api/admin/projects/:projectId/members/bulk-assign ────────────────

describe('POST /api/admin/projects/:projectId/members/bulk-assign', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    expect((await post(`/api/admin/projects/${p.id}/members/bulk-assign`, u.id, { userIds: [u.id] })).status).toBe(403);
  });

  it('returns 400 when userIds is empty', async () => {
    const admin = await makeUser('admin');
    const p = await makeProject();
    expect((await post(`/api/admin/projects/${p.id}/members/bulk-assign`, admin.id, { userIds: [] })).status).toBe(400);
  });

  it('assigns multiple users at once with default role', async () => {
    const admin = await makeUser('admin');
    const u1 = await makeUser('user');
    const u2 = await makeUser('user');
    const p = await makeProject();

    const { status, body } = await post(`/api/admin/projects/${p.id}/members/bulk-assign`, admin.id, {
      userIds: [u1.id, u2.id],
    });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, count: 2 });

    for (const uid of [u1.id, u2.id]) {
      const rows = await memberRow(uid, p.id);
      expect(rows).toHaveLength(1);
    }
  });

  it('upserts — re-assigning with a different role updates the existing row', async () => {
    const admin = await makeUser('admin');
    const u1 = await makeUser('user');
    const p = await makeProject();
    await assignMember(u1.id, p.id, 'user');

    await post(`/api/admin/projects/${p.id}/members/bulk-assign`, admin.id, { userIds: [u1.id], role: 'manager' });

    const rows = await memberRow(u1.id, p.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.role).toBe('manager');
  });
});

// ── POST /api/admin/projects/:projectId/members/bulk-remove ────────────────

describe('POST /api/admin/projects/:projectId/members/bulk-remove', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    expect((await post(`/api/admin/projects/${p.id}/members/bulk-remove`, u.id, { userIds: [u.id] })).status).toBe(403);
  });

  it('returns 400 when userIds is empty', async () => {
    const admin = await makeUser('admin');
    const p = await makeProject();
    expect((await post(`/api/admin/projects/${p.id}/members/bulk-remove`, admin.id, { userIds: [] })).status).toBe(400);
  });

  it('removes multiple memberships at once', async () => {
    const admin = await makeUser('admin');
    const u1 = await makeUser('user');
    const u2 = await makeUser('user');
    const p = await makeProject();
    await assignMember(u1.id, p.id);
    await assignMember(u2.id, p.id);

    const { status, body } = await post(`/api/admin/projects/${p.id}/members/bulk-remove`, admin.id, {
      userIds: [u1.id, u2.id],
    });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, count: 2 });

    for (const uid of [u1.id, u2.id]) {
      expect(await memberRow(uid, p.id)).toHaveLength(0);
    }
  });
});

// ── GET /api/admin/users/:userId/projects ───────────────────────────────────

describe('GET /api/admin/users/:userId/projects', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await get(`/api/admin/users/${u.id}/projects`, u.id)).status).toBe(403);
  });

  it('lists all projects with assignment status for the given user', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p1 = await makeProject('Assigned');
    const p2 = await makeProject('Unassigned');
    await assignMember(target.id, p1.id, 'manager');

    const { status, body } = await get(`/api/admin/users/${target.id}/projects`, admin.id);
    expect(status).toBe(200);

    const assignedRow = body.find((r: { projectId: string }) => r.projectId === p1.id);
    const unassignedRow = body.find((r: { projectId: string }) => r.projectId === p2.id);

    expect(assignedRow).toMatchObject({ assigned: true, role: 'manager' });
    expect(unassignedRow).toMatchObject({ assigned: false, role: 'user' });
  });
});

// ── POST /api/admin/users/:userId/projects ──────────────────────────────────

describe('POST /api/admin/users/:userId/projects', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    expect((await post(`/api/admin/users/${u.id}/projects`, u.id, { projectId: p.id })).status).toBe(403);
  });

  it('assigns a project to the user', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();

    const { status, body } = await post(`/api/admin/users/${target.id}/projects`, admin.id, { projectId: p.id });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    expect(await memberRow(target.id, p.id)).toHaveLength(1);
  });

  it('is idempotent — upserts on re-assignment', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();

    await post(`/api/admin/users/${target.id}/projects`, admin.id, { projectId: p.id, role: 'user' });
    await post(`/api/admin/users/${target.id}/projects`, admin.id, { projectId: p.id, role: 'manager' });

    const rows = await memberRow(target.id, p.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.role).toBe('manager');
  });

  it('returns 400 for invalid projectId', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    expect((await post(`/api/admin/users/${target.id}/projects`, admin.id, { projectId: 'bad' })).status).toBe(400);
  });
});

// ── DELETE /api/admin/users/:userId/projects/:projectId ─────────────────────

describe('DELETE /api/admin/users/:userId/projects/:projectId', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    expect((await del(`/api/admin/users/${u.id}/projects/${p.id}`, u.id)).status).toBe(403);
  });

  it('removes the project assignment', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();
    await assignMember(target.id, p.id);

    const { status, body } = await del(`/api/admin/users/${target.id}/projects/${p.id}`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    expect(await memberRow(target.id, p.id)).toHaveLength(0);
  });

  it('succeeds silently when assignment did not exist', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const p = await makeProject();

    const { status } = await del(`/api/admin/users/${target.id}/projects/${p.id}`, admin.id);
    expect(status).toBe(200);
  });
});
