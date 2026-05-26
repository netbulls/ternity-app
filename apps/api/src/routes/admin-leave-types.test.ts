import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { leaveTypeGroups, leaveTypes, users } from '../db/schema.js';
import { adminLeaveTypesRoutes } from './admin-leave-types.js';

// Characterization tests for leave-type admin routes:
//   GET/POST/PATCH/DELETE /api/admin/leave-type-groups[/:id]
//   GET/POST/PATCH        /api/admin/leave-types[/:id]
//   PATCH                 /api/admin/leave-types/bulk
//   DELETE                /api/admin/leave-types/:id
// All endpoints require globalRole='admin'.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(adminLeaveTypesRoutes);
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
async function makeGroup(name = 'Holiday', color = '#00D4AA', sortOrder = 0) {
  const [g] = await db.insert(leaveTypeGroups).values({ name, color, sortOrder }).returning();
  return g!;
}
async function makeLeaveType(over: Partial<typeof leaveTypes.$inferInsert> = {}) {
  const [t] = await db
    .insert(leaveTypes)
    .values({ name: `Type-${Math.random()}`, daysPerYear: 20, ...over })
    .returning();
  return t!;
}

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

// ── GET /api/admin/leave-type-groups ───────────────────────────────────────

describe('GET /api/admin/leave-type-groups', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await get('/api/admin/leave-type-groups', u.id)).status).toBe(403);
  });

  it('returns all groups with type counts', async () => {
    const admin = await makeUser();
    const g = await makeGroup('Holiday');
    await makeLeaveType({ groupId: g.id, active: true });
    await makeLeaveType({ groupId: g.id, active: false });

    const { status, body } = await get('/api/admin/leave-type-groups', admin.id);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    const row = body.find((r: { id: string }) => r.id === g.id);
    expect(row).toMatchObject({ name: 'Holiday', typeCount: 2, activeTypeCount: 1 });
  });

  it('returns results ordered by sortOrder then name', async () => {
    const admin = await makeUser();
    await makeGroup('Beta', '#aaa', 1);
    await makeGroup('Alpha', '#bbb', 0);
    const { body } = await get('/api/admin/leave-type-groups', admin.id);
    // Alpha is sortOrder=0, Beta is sortOrder=1
    expect(body[0].name).toBe('Alpha');
    expect(body[1].name).toBe('Beta');
  });
});

// ── POST /api/admin/leave-type-groups ──────────────────────────────────────

describe('POST /api/admin/leave-type-groups', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/leave-type-groups', u.id, { name: 'G', color: '#fff' })).status).toBe(403);
  });

  it('creates a group and auto-assigns sortOrder', async () => {
    const admin = await makeUser();
    await makeGroup('Existing', '#aaa', 0);

    const { status, body } = await post('/api/admin/leave-type-groups', admin.id, {
      name: 'Sick Leave',
      color: '#ff0000',
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ name: 'Sick Leave', color: '#ff0000' });
    expect(body.sortOrder).toBe(1); // max(0) + 1

    const [row] = await db.select().from(leaveTypeGroups).where(eq(leaveTypeGroups.id, body.id));
    expect(row).toBeDefined();
  });

  it('returns 400 when name or color is missing/blank', async () => {
    const admin = await makeUser();
    expect((await post('/api/admin/leave-type-groups', admin.id, { color: '#fff' })).status).toBe(400);
    expect((await post('/api/admin/leave-type-groups', admin.id, { name: 'G' })).status).toBe(400);
    expect((await post('/api/admin/leave-type-groups', admin.id, { name: '  ', color: '#fff' })).status).toBe(400);
  });
});

// ── PATCH /api/admin/leave-type-groups/:id ─────────────────────────────────

describe('PATCH /api/admin/leave-type-groups/:id', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const g = await makeGroup();
    expect((await patch(`/api/admin/leave-type-groups/${g.id}`, u.id, { name: 'X' })).status).toBe(403);
  });

  it('updates group name', async () => {
    const admin = await makeUser();
    const g = await makeGroup('Old');
    const { status, body } = await patch(`/api/admin/leave-type-groups/${g.id}`, admin.id, { name: 'New' });
    expect(status).toBe(200);
    expect(body.name).toBe('New');

    const [row] = await db.select().from(leaveTypeGroups).where(eq(leaveTypeGroups.id, g.id));
    expect(row!.name).toBe('New');
  });

  it('updates sortOrder', async () => {
    const admin = await makeUser();
    const g = await makeGroup('G', '#aaa', 0);
    await patch(`/api/admin/leave-type-groups/${g.id}`, admin.id, { sortOrder: 5 });
    const [row] = await db.select().from(leaveTypeGroups).where(eq(leaveTypeGroups.id, g.id));
    expect(row!.sortOrder).toBe(5);
  });

  it('returns 400 when no fields to update are provided', async () => {
    const admin = await makeUser();
    const g = await makeGroup();
    expect((await patch(`/api/admin/leave-type-groups/${g.id}`, admin.id, {})).status).toBe(400);
  });

  it('returns 404 for unknown group', async () => {
    const admin = await makeUser();
    expect((await patch('/api/admin/leave-type-groups/00000000-0000-0000-0000-000000000000', admin.id, { name: 'X' })).status).toBe(404);
  });
});

// ── DELETE /api/admin/leave-type-groups/:id ────────────────────────────────

describe('DELETE /api/admin/leave-type-groups/:id', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const g = await makeGroup();
    expect((await del(`/api/admin/leave-type-groups/${g.id}`, u.id)).status).toBe(403);
  });

  it('deletes the group and unassigns leave types (sets groupId to null)', async () => {
    const admin = await makeUser();
    const g = await makeGroup();
    const lt = await makeLeaveType({ groupId: g.id });

    const { status, body } = await del(`/api/admin/leave-type-groups/${g.id}`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });

    // Group row should be gone
    const [groupRow] = await db.select().from(leaveTypeGroups).where(eq(leaveTypeGroups.id, g.id));
    expect(groupRow).toBeUndefined();

    // Leave type should still exist with groupId=null (unassigned)
    const [ltRow] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, lt.id));
    expect(ltRow).toBeDefined();
    expect(ltRow!.groupId).toBeNull();
  });

  it('returns 404 for unknown group', async () => {
    const admin = await makeUser();
    expect((await del('/api/admin/leave-type-groups/00000000-0000-0000-0000-000000000000', admin.id)).status).toBe(404);
  });
});

// ── GET /api/admin/leave-types ──────────────────────────────────────────────

describe('GET /api/admin/leave-types', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await get('/api/admin/leave-types', u.id)).status).toBe(403);
  });

  it('returns all leave types including inactive ones', async () => {
    const admin = await makeUser();
    const active = await makeLeaveType({ name: 'Active', active: true });
    const inactive = await makeLeaveType({ name: 'Inactive', active: false });

    const { status, body } = await get('/api/admin/leave-types', admin.id);
    expect(status).toBe(200);
    const ids = body.map((t: { id: string }) => t.id);
    expect(ids).toContain(active.id);
    expect(ids).toContain(inactive.id);
  });

  it('returns contractor default first in the list', async () => {
    const admin = await makeUser();
    await makeLeaveType({ name: 'Regular', isContractorDefault: false });
    await makeLeaveType({ name: 'Default', isContractorDefault: true });

    const { body } = await get('/api/admin/leave-types', admin.id);
    expect(body[0].isContractorDefault).toBe(true);
  });

  it('includes expected fields', async () => {
    const admin = await makeUser();
    const g = await makeGroup();
    await makeLeaveType({ groupId: g.id, visibility: 'contractor', color: '#123456' });

    const { body } = await get('/api/admin/leave-types', admin.id);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('name');
    expect(body[0]).toHaveProperty('daysPerYear');
    expect(body[0]).toHaveProperty('color');
    expect(body[0]).toHaveProperty('deducted');
    expect(body[0]).toHaveProperty('groupId');
    expect(body[0]).toHaveProperty('active');
    expect(body[0]).toHaveProperty('visibility');
    expect(body[0]).toHaveProperty('isContractorDefault');
  });
});

// ── POST /api/admin/leave-types ─────────────────────────────────────────────

describe('POST /api/admin/leave-types', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/leave-types', u.id, { name: 'Vacation', daysPerYear: 20 })).status).toBe(403);
  });

  it('creates a leave type with required fields', async () => {
    const admin = await makeUser();
    const { status, body } = await post('/api/admin/leave-types', admin.id, {
      name: 'Vacation',
      daysPerYear: 20,
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ name: 'Vacation', daysPerYear: 20, active: true, deducted: true, visibility: 'all' });

    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, body.id));
    expect(row).toBeDefined();
  });

  it('creates a leave type with optional fields', async () => {
    const admin = await makeUser();
    const g = await makeGroup();
    const { body } = await post('/api/admin/leave-types', admin.id, {
      name: 'Sick Leave',
      daysPerYear: 10,
      color: '#ff0000',
      deducted: false,
      groupId: g.id,
      visibility: 'employee',
    });
    expect(body).toMatchObject({ color: '#ff0000', deducted: false, groupId: g.id, visibility: 'employee' });
  });

  it('returns 400 when name is missing or blank', async () => {
    const admin = await makeUser();
    expect((await post('/api/admin/leave-types', admin.id, { daysPerYear: 10 })).status).toBe(400);
    expect((await post('/api/admin/leave-types', admin.id, { name: '  ', daysPerYear: 10 })).status).toBe(400);
  });

  it('returns 400 when daysPerYear is negative', async () => {
    const admin = await makeUser();
    expect((await post('/api/admin/leave-types', admin.id, { name: 'X', daysPerYear: -1 })).status).toBe(400);
  });

  it('returns 400 when daysPerYear is missing', async () => {
    const admin = await makeUser();
    expect((await post('/api/admin/leave-types', admin.id, { name: 'X' })).status).toBe(400);
  });

  it('returns 400 for invalid visibility value', async () => {
    const admin = await makeUser();
    expect(
      (await post('/api/admin/leave-types', admin.id, { name: 'X', daysPerYear: 10, visibility: 'alien' })).status,
    ).toBe(400);
  });
});

// ── PATCH /api/admin/leave-types/:id ───────────────────────────────────────

describe('PATCH /api/admin/leave-types/:id', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const lt = await makeLeaveType();
    expect((await patch(`/api/admin/leave-types/${lt.id}`, u.id, { name: 'X' })).status).toBe(403);
  });

  it('returns 404 for unknown leave type', async () => {
    const admin = await makeUser();
    expect((await patch('/api/admin/leave-types/00000000-0000-0000-0000-000000000000', admin.id, { name: 'X' })).status).toBe(404);
  });

  it('updates name and color', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType({ name: 'Old', color: null });

    const { status, body } = await patch(`/api/admin/leave-types/${lt.id}`, admin.id, {
      name: 'New Name',
      color: '#abcdef',
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ name: 'New Name', color: '#abcdef' });

    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, lt.id));
    expect(row!.name).toBe('New Name');
    expect(row!.color).toBe('#abcdef');
  });

  it('deactivates a non-contractor-default leave type', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType({ active: true, isContractorDefault: false });

    const { status, body } = await patch(`/api/admin/leave-types/${lt.id}`, admin.id, { active: false });
    expect(status).toBe(200);
    expect(body.active).toBe(false);

    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, lt.id));
    expect(row!.active).toBe(false);
  });

  it('protects contractor default from deactivation', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType({ isContractorDefault: true, active: true });

    const { status } = await patch(`/api/admin/leave-types/${lt.id}`, admin.id, { active: false });
    expect(status).toBe(400);

    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, lt.id));
    expect(row!.active).toBe(true); // unchanged
  });

  it('protects contractor default from employee-only visibility', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType({ isContractorDefault: true });

    const { status } = await patch(`/api/admin/leave-types/${lt.id}`, admin.id, { visibility: 'employee' });
    expect(status).toBe(400);
  });

  it('returns 400 for invalid visibility', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType();
    expect((await patch(`/api/admin/leave-types/${lt.id}`, admin.id, { visibility: 'aliens' })).status).toBe(400);
  });

  it('setting isContractorDefault=true clears it from any other type (radio-style)', async () => {
    const admin = await makeUser();
    const old = await makeLeaveType({ isContractorDefault: true });
    const new_ = await makeLeaveType({ isContractorDefault: false });

    await patch(`/api/admin/leave-types/${new_.id}`, admin.id, { isContractorDefault: true });

    const [oldRow] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, old.id));
    const [newRow] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, new_.id));

    expect(oldRow!.isContractorDefault).toBe(false);
    expect(newRow!.isContractorDefault).toBe(true);
  });

  it('setting isContractorDefault=true also forces active=true on the type', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType({ isContractorDefault: false, active: false });

    await patch(`/api/admin/leave-types/${lt.id}`, admin.id, { isContractorDefault: true });

    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, lt.id));
    expect(row!.active).toBe(true);
    expect(row!.isContractorDefault).toBe(true);
  });

  it('returns 400 when trying to unset contractor default (isContractorDefault=false on current default)', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType({ isContractorDefault: true });
    // Must set another type as default instead; unset-by-flag is forbidden
    const { status } = await patch(`/api/admin/leave-types/${lt.id}`, admin.id, { isContractorDefault: false });
    expect(status).toBe(400);
  });

  it('returns 400 when no fields to update are provided', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType();
    expect((await patch(`/api/admin/leave-types/${lt.id}`, admin.id, {})).status).toBe(400);
  });

  it('assigns a group to a leave type', async () => {
    const admin = await makeUser();
    const g = await makeGroup();
    const lt = await makeLeaveType({ groupId: null });

    const { status, body } = await patch(`/api/admin/leave-types/${lt.id}`, admin.id, { groupId: g.id });
    expect(status).toBe(200);
    expect(body.groupId).toBe(g.id);
  });
});

// ── PATCH /api/admin/leave-types/bulk ──────────────────────────────────────

describe('PATCH /api/admin/leave-types/bulk', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const lt = await makeLeaveType();
    expect((await patch('/api/admin/leave-types/bulk', u.id, { ids: [lt.id], active: true })).status).toBe(403);
  });

  it('returns 400 when ids array is empty or missing', async () => {
    const admin = await makeUser();
    expect((await patch('/api/admin/leave-types/bulk', admin.id, { ids: [], active: true })).status).toBe(400);
    expect((await patch('/api/admin/leave-types/bulk', admin.id, { active: true })).status).toBe(400);
  });

  it('returns 400 when no update fields provided', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType();
    expect((await patch('/api/admin/leave-types/bulk', admin.id, { ids: [lt.id] })).status).toBe(400);
  });

  it('returns 400 for invalid visibility in bulk update', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType();
    expect((await patch('/api/admin/leave-types/bulk', admin.id, { ids: [lt.id], visibility: 'nope' })).status).toBe(400);
  });

  it('bulk-assigns a group to multiple leave types', async () => {
    const admin = await makeUser();
    const g = await makeGroup();
    const lt1 = await makeLeaveType({ groupId: null });
    const lt2 = await makeLeaveType({ groupId: null });

    const { status, body } = await patch('/api/admin/leave-types/bulk', admin.id, {
      ids: [lt1.id, lt2.id],
      groupId: g.id,
    });
    expect(status).toBe(200);
    expect(body.updated).toBe(2);

    for (const id of [lt1.id, lt2.id]) {
      const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, id));
      expect(row!.groupId).toBe(g.id);
    }
  });

  it('bulk-activates leave types', async () => {
    const admin = await makeUser();
    const lt1 = await makeLeaveType({ active: false });
    const lt2 = await makeLeaveType({ active: false });

    const { status, body } = await patch('/api/admin/leave-types/bulk', admin.id, {
      ids: [lt1.id, lt2.id],
      active: true,
    });
    expect(status).toBe(200);
    expect(body.updated).toBe(2);

    for (const id of [lt1.id, lt2.id]) {
      const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, id));
      expect(row!.active).toBe(true);
    }
  });

  it('blocks bulk deactivation when the batch contains the contractor default (400)', async () => {
    const admin = await makeUser();
    const defaultType = await makeLeaveType({ isContractorDefault: true, active: true });
    const normal = await makeLeaveType({ active: true });

    const { status } = await patch('/api/admin/leave-types/bulk', admin.id, {
      ids: [defaultType.id, normal.id],
      active: false,
    });
    expect(status).toBe(400);

    // Rows must be unmodified — the guard rejected the whole batch
    for (const id of [defaultType.id, normal.id]) {
      const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, id));
      expect(row!.active).toBe(true);
    }
  });

  it('blocks bulk visibility=employee when the batch contains the contractor default (400)', async () => {
    const admin = await makeUser();
    const defaultType = await makeLeaveType({ isContractorDefault: true });
    const normal = await makeLeaveType();

    const { status } = await patch('/api/admin/leave-types/bulk', admin.id, {
      ids: [defaultType.id, normal.id],
      visibility: 'employee',
    });
    expect(status).toBe(400);
  });
});

// ── DELETE /api/admin/leave-types/:id ──────────────────────────────────────

describe('DELETE /api/admin/leave-types/:id', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const lt = await makeLeaveType();
    expect((await del(`/api/admin/leave-types/${lt.id}`, u.id)).status).toBe(403);
  });

  it('returns 404 for unknown leave type', async () => {
    const admin = await makeUser();
    expect((await del('/api/admin/leave-types/00000000-0000-0000-0000-000000000000', admin.id)).status).toBe(404);
  });

  it('deletes a non-default leave type', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType({ isContractorDefault: false });

    const { status, body } = await del(`/api/admin/leave-types/${lt.id}`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });

    // NOTE: leave types ARE hard-deleted (unlike users/projects/clients). This is
    // intentional — leave types are configuration, not business entity user data.
    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, lt.id));
    expect(row).toBeUndefined();
  });

  it('protects contractor default from deletion', async () => {
    const admin = await makeUser();
    const lt = await makeLeaveType({ isContractorDefault: true });

    const { status } = await del(`/api/admin/leave-types/${lt.id}`, admin.id);
    expect(status).toBe(400);

    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, lt.id));
    expect(row).toBeDefined(); // still exists
  });
});
