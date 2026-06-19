import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { clients, projects, users } from '../db/schema.js';
import { adminProjectsRoutes } from './admin-projects.js';

// Characterization tests for /api/admin/projects/* and /api/admin/clients/* routes.
// All endpoints require globalRole='admin'.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(adminProjectsRoutes);
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
async function makeClient(name = 'Acme') {
  const [c] = await db.insert(clients).values({ name }).returning();
  return c!;
}
async function makeProject(clientId: string, name = 'Web', over: Partial<typeof projects.$inferInsert> = {}) {
  const [p] = await db.insert(projects).values({ name, clientId, ...over }).returning();
  return p!;
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

// ── GET /api/admin/projects ─────────────────────────────────────────────────

describe('GET /api/admin/projects', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await get('/api/admin/projects', u.id)).status).toBe(403);
  });

  it('returns all projects with client info and entry counts', async () => {
    const admin = await makeUser();
    const c = await makeClient('Acme');
    const p = await makeProject(c.id, 'Alpha');

    const { status, body } = await get('/api/admin/projects', admin.id);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: p.id,
      name: 'Alpha',
      clientId: c.id,
      clientName: 'Acme',
      isActive: true,
      entryCount: 0,
    });
  });

  it('returns results ordered by project name ascending', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    await makeProject(c.id, 'Zeta');
    await makeProject(c.id, 'Alpha');
    const { body } = await get('/api/admin/projects', admin.id);
    const names: string[] = body.map((p: { name: string }) => p.name);
    expect(names).toEqual([...names].sort());
  });
});

// ── POST /api/admin/projects ─────────────────────────────────────────────────

describe('POST /api/admin/projects', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const c = await makeClient();
    expect((await post('/api/admin/projects', u.id, { name: 'New', clientId: c.id })).status).toBe(403);
  });

  it('creates a project and returns 201 with the row', async () => {
    const admin = await makeUser();
    const c = await makeClient('GlobalCorp');

    const { status, body } = await post('/api/admin/projects', admin.id, {
      name: 'New Feature',
      clientId: c.id,
      color: '#3B82F6',
      description: 'Nice project',
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({ name: 'New Feature', clientId: c.id, color: '#3B82F6', isActive: true });

    const [row] = await db.select().from(projects).where(eq(projects.id, body.id));
    expect(row).toBeDefined();
    expect(row!.description).toBe('Nice project');
  });

  it('returns 400 for missing name', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    const { status } = await post('/api/admin/projects', admin.id, { clientId: c.id });
    expect(status).toBe(400);
  });

  it('returns 400 for invalid clientId (not a UUID)', async () => {
    const admin = await makeUser();
    const { status } = await post('/api/admin/projects', admin.id, { name: 'X', clientId: 'not-a-uuid' });
    expect(status).toBe(400);
  });
});

// ── PATCH /api/admin/projects/:id ───────────────────────────────────────────

describe('PATCH /api/admin/projects/:id', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const c = await makeClient();
    const p = await makeProject(c.id);
    expect((await patch(`/api/admin/projects/${p.id}`, u.id, { name: 'X' })).status).toBe(403);
  });

  it('updates the project name', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    const p = await makeProject(c.id, 'Old Name');

    const { status, body } = await patch(`/api/admin/projects/${p.id}`, admin.id, { name: 'New Name' });
    expect(status).toBe(200);
    expect(body.name).toBe('New Name');

    const [row] = await db.select().from(projects).where(eq(projects.id, p.id));
    expect(row!.name).toBe('New Name');
  });

  it('returns 400 when no updatable fields are provided', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    const p = await makeProject(c.id);
    // Empty object passes Zod (all optional) but UpdateProjectSchema will still pass;
    // the route then checks Object.keys(updates).length === 0 → 400
    const { status } = await patch(`/api/admin/projects/${p.id}`, admin.id, {});
    expect(status).toBe(400);
  });

  it('returns 404 for unknown project', async () => {
    const admin = await makeUser();
    const { status } = await patch('/api/admin/projects/00000000-0000-0000-0000-000000000000', admin.id, { name: 'X' });
    expect(status).toBe(404);
  });
});

// ── PATCH /api/admin/projects/:id/activate & /deactivate ───────────────────

describe('PATCH /api/admin/projects/:id/activate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const c = await makeClient();
    const p = await makeProject(c.id);
    expect((await patch(`/api/admin/projects/${p.id}/activate`, u.id)).status).toBe(403);
  });

  it('sets isActive=true on the project', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    const p = await makeProject(c.id, 'Archived', { isActive: false });

    const { status, body } = await patch(`/api/admin/projects/${p.id}/activate`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const [row] = await db.select().from(projects).where(eq(projects.id, p.id));
    expect(row!.isActive).toBe(true);
  });

  it('returns 404 for unknown project', async () => {
    const admin = await makeUser();
    expect((await patch('/api/admin/projects/00000000-0000-0000-0000-000000000000/activate', admin.id)).status).toBe(404);
  });
});

describe('PATCH /api/admin/projects/:id/deactivate', () => {
  it('sets isActive=false on the project (soft deactivate — row preserved)', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    const p = await makeProject(c.id);

    const { status, body } = await patch(`/api/admin/projects/${p.id}/deactivate`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    // Row must still exist (no-delete policy)
    const [row] = await db.select().from(projects).where(eq(projects.id, p.id));
    expect(row).toBeDefined();
    expect(row!.isActive).toBe(false);
  });

  it('returns 404 for unknown project', async () => {
    const admin = await makeUser();
    expect((await patch('/api/admin/projects/00000000-0000-0000-0000-000000000000/deactivate', admin.id)).status).toBe(404);
  });
});

// ── POST /api/admin/projects/bulk-activate & /bulk-deactivate ──────────────

describe('POST /api/admin/projects/bulk-activate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/projects/bulk-activate', u.id, { projectIds: [] })).status).toBe(403);
  });

  it('returns 400 when projectIds is empty or missing', async () => {
    const admin = await makeUser();
    expect((await post('/api/admin/projects/bulk-activate', admin.id, { projectIds: [] })).status).toBe(400);
    expect((await post('/api/admin/projects/bulk-activate', admin.id, {})).status).toBe(400);
  });

  it('returns 400 for a malformed body (validated by BulkProjectIdsSchema)', async () => {
    const admin = await makeUser();
    // not an array, and array of non-UUID strings — both are ZodErrors → 400, not a 500
    expect((await post('/api/admin/projects/bulk-activate', admin.id, { projectIds: 'nope' })).status).toBe(400);
    expect((await post('/api/admin/projects/bulk-activate', admin.id, { projectIds: ['not-a-uuid'] })).status).toBe(400);
  });

  it('activates multiple projects and returns count', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    const p1 = await makeProject(c.id, 'P1', { isActive: false });
    const p2 = await makeProject(c.id, 'P2', { isActive: false });

    const { status, body } = await post('/api/admin/projects/bulk-activate', admin.id, {
      projectIds: [p1.id, p2.id],
    });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, count: 2 });

    for (const id of [p1.id, p2.id]) {
      const [row] = await db.select().from(projects).where(eq(projects.id, id));
      expect(row!.isActive).toBe(true);
    }
  });
});

describe('POST /api/admin/projects/bulk-deactivate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/projects/bulk-deactivate', u.id, { projectIds: [] })).status).toBe(403);
  });

  it('deactivates multiple projects and returns count', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    const p1 = await makeProject(c.id, 'P1');
    const p2 = await makeProject(c.id, 'P2');

    const { status, body } = await post('/api/admin/projects/bulk-deactivate', admin.id, {
      projectIds: [p1.id, p2.id],
    });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, count: 2 });

    for (const id of [p1.id, p2.id]) {
      const [row] = await db.select().from(projects).where(eq(projects.id, id));
      expect(row!.isActive).toBe(false); // row preserved (no-delete policy)
    }
  });
});

// ── GET /api/admin/clients ──────────────────────────────────────────────────

describe('GET /api/admin/clients', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await get('/api/admin/clients', u.id)).status).toBe(403);
  });

  it('returns all clients with project/entry counts', async () => {
    const admin = await makeUser();
    const c = await makeClient('BigCorp');
    await makeProject(c.id, 'Alpha');

    const { status, body } = await get('/api/admin/clients', admin.id);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    const row = body.find((r: { id: string }) => r.id === c.id);
    expect(row).toMatchObject({ name: 'BigCorp', isActive: true, projectCount: 1, entryCount: 0 });
  });

  it('returns results ordered by name ascending', async () => {
    const admin = await makeUser();
    await makeClient('Zeta Corp');
    await makeClient('Alpha Corp');
    const { body } = await get('/api/admin/clients', admin.id);
    const names: string[] = body.map((c: { name: string }) => c.name);
    expect(names).toEqual([...names].sort());
  });
});

// ── POST /api/admin/clients ─────────────────────────────────────────────────

describe('POST /api/admin/clients', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/clients', u.id, { name: 'New' })).status).toBe(403);
  });

  it('creates a client and returns 201', async () => {
    const admin = await makeUser();
    const { status, body } = await post('/api/admin/clients', admin.id, { name: 'Netbulls' });
    expect(status).toBe(201);
    expect(body).toMatchObject({ name: 'Netbulls', isActive: true });

    const [row] = await db.select().from(clients).where(eq(clients.id, body.id));
    expect(row).toBeDefined();
  });

  it('returns 400 when name is missing or empty', async () => {
    const admin = await makeUser();
    expect((await post('/api/admin/clients', admin.id, {})).status).toBe(400);
    expect((await post('/api/admin/clients', admin.id, { name: '' })).status).toBe(400);
  });
});

// ── PATCH /api/admin/clients/:id ────────────────────────────────────────────

describe('PATCH /api/admin/clients/:id', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const c = await makeClient();
    expect((await patch(`/api/admin/clients/${c.id}`, u.id, { name: 'New' })).status).toBe(403);
  });

  it('renames the client', async () => {
    const admin = await makeUser();
    const c = await makeClient('Old Name');
    const { status, body } = await patch(`/api/admin/clients/${c.id}`, admin.id, { name: 'New Name' });
    expect(status).toBe(200);
    expect(body.name).toBe('New Name');

    const [row] = await db.select().from(clients).where(eq(clients.id, c.id));
    expect(row!.name).toBe('New Name');
  });

  it('returns 404 for unknown client', async () => {
    const admin = await makeUser();
    const { status } = await patch('/api/admin/clients/00000000-0000-0000-0000-000000000000', admin.id, { name: 'X' });
    expect(status).toBe(404);
  });
});

// ── PATCH /api/admin/clients/:id/activate & /deactivate ────────────────────

describe('PATCH /api/admin/clients/:id/activate', () => {
  it('sets isActive=true on the client', async () => {
    const admin = await makeUser();
    const c = await makeClient();
    await db.update(clients).set({ isActive: false }).where(eq(clients.id, c.id));

    const { status, body } = await patch(`/api/admin/clients/${c.id}/activate`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const [row] = await db.select().from(clients).where(eq(clients.id, c.id));
    expect(row!.isActive).toBe(true);
  });

  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const c = await makeClient();
    expect((await patch(`/api/admin/clients/${c.id}/activate`, u.id)).status).toBe(403);
  });

  it('returns 404 for unknown client', async () => {
    const admin = await makeUser();
    expect((await patch('/api/admin/clients/00000000-0000-0000-0000-000000000000/activate', admin.id)).status).toBe(404);
  });
});

describe('PATCH /api/admin/clients/:id/deactivate', () => {
  it('sets isActive=false on the client (row preserved — no-delete policy)', async () => {
    const admin = await makeUser();
    const c = await makeClient();

    const { status, body } = await patch(`/api/admin/clients/${c.id}/deactivate`, admin.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const [row] = await db.select().from(clients).where(eq(clients.id, c.id));
    expect(row).toBeDefined();
    expect(row!.isActive).toBe(false);
  });

  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    const c = await makeClient();
    expect((await patch(`/api/admin/clients/${c.id}/deactivate`, u.id)).status).toBe(403);
  });
});

// ── POST /api/admin/clients/bulk-activate & /bulk-deactivate ───────────────

describe('POST /api/admin/clients/bulk-activate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/clients/bulk-activate', u.id, { clientIds: [] })).status).toBe(403);
  });

  it('returns 400 when clientIds is empty or missing', async () => {
    const admin = await makeUser();
    expect((await post('/api/admin/clients/bulk-activate', admin.id, { clientIds: [] })).status).toBe(400);
    expect((await post('/api/admin/clients/bulk-activate', admin.id, {})).status).toBe(400);
  });

  it('returns 400 for a malformed body (validated by BulkClientIdsSchema)', async () => {
    const admin = await makeUser();
    expect((await post('/api/admin/clients/bulk-activate', admin.id, { clientIds: 'nope' })).status).toBe(400);
    expect((await post('/api/admin/clients/bulk-activate', admin.id, { clientIds: ['not-a-uuid'] })).status).toBe(400);
  });

  it('activates multiple clients and returns count', async () => {
    const admin = await makeUser();
    const c1 = await makeClient('C1');
    const c2 = await makeClient('C2');
    await db.update(clients).set({ isActive: false }).where(eq(clients.id, c1.id));
    await db.update(clients).set({ isActive: false }).where(eq(clients.id, c2.id));

    const { status, body } = await post('/api/admin/clients/bulk-activate', admin.id, { clientIds: [c1.id, c2.id] });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, count: 2 });

    for (const id of [c1.id, c2.id]) {
      const [row] = await db.select().from(clients).where(eq(clients.id, id));
      expect(row!.isActive).toBe(true);
    }
  });
});

describe('POST /api/admin/clients/bulk-deactivate', () => {
  it('returns 403 for non-admin', async () => {
    const u = await makeUser('user');
    expect((await post('/api/admin/clients/bulk-deactivate', u.id, { clientIds: [] })).status).toBe(403);
  });

  it('deactivates multiple clients and returns count', async () => {
    const admin = await makeUser();
    const c1 = await makeClient('C1');
    const c2 = await makeClient('C2');

    const { status, body } = await post('/api/admin/clients/bulk-deactivate', admin.id, { clientIds: [c1.id, c2.id] });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, count: 2 });

    for (const id of [c1.id, c2.id]) {
      const [row] = await db.select().from(clients).where(eq(clients.id, id));
      expect(row!.isActive).toBe(false);
    }
  });
});
