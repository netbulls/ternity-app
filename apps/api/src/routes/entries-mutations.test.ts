import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { entryAuditLog, entrySegments, tags, timeEntries, users } from '../db/schema.js';
import { entriesRoutes } from './entries.js';

// Integration tests for the entry mutation routes: PATCH (metadata), DELETE
// (soft-delete policy — no hard deletes, per the no-delete architecture), restore,
// and adjust. Focus on ownership/state guards and the audit trail.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(entriesRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser() {
  const [u] = await db
    .insert(users)
    .values({ displayName: 'U', email: `u${Math.random()}@x.io`, globalRole: 'user' })
    .returning();
  return u!;
}
async function makeEntry(userId: string, over: Partial<typeof timeEntries.$inferInsert> = {}) {
  const [e] = await db
    .insert(timeEntries)
    .values({ userId, description: 'Task', ...over })
    .returning();
  return e!;
}
const auditFor = (entryId: string) =>
  db.select().from(entryAuditLog).where(eq(entryAuditLog.entryId, entryId));

const call = async (method: 'PATCH' | 'DELETE' | 'POST', url: string, userId: string, body?: unknown) => {
  const res = await app.inject({ method, url, headers: { 'x-dev-user-id': userId }, payload: body as object });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};

describe('PATCH /api/entries/:id', () => {
  it('404 for a non-existent or inactive entry', async () => {
    const u = await makeUser();
    expect((await call('PATCH', '/api/entries/00000000-0000-0000-0000-000000000000', u.id, {})).status).toBe(404);
    const inactive = await makeEntry(u.id, { isActive: false });
    expect((await call('PATCH', `/api/entries/${inactive.id}`, u.id, {})).status).toBe(404);
  });

  it('403 when patching someone else’s entry', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const e = await makeEntry(owner.id);
    expect((await call('PATCH', `/api/entries/${e.id}`, other.id, { description: 'x' })).status).toBe(403);
  });

  it('updates description + tags and records an "updated" audit of changed fields', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { description: 'old' });
    const [tag] = await db.insert(tags).values({ name: 'Billable', userId: u.id }).returning();

    const { status, body } = await call('PATCH', `/api/entries/${e.id}`, u.id, {
      description: 'new',
      tagIds: [tag!.id],
    });
    expect(status).toBe(200);
    expect(body.description).toBe('new');
    expect(body.tags.map((t: { id: string }) => t.id)).toEqual([tag!.id]);

    const audit = await auditFor(e.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.action).toBe('updated');
    expect(audit[0]!.changes).toMatchObject({ description: { old: 'old', new: 'new' } });
  });

  it('records no audit when nothing actually changes', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { description: 'same' });
    await call('PATCH', `/api/entries/${e.id}`, u.id, { description: 'same' });
    expect(await auditFor(e.id)).toHaveLength(0);
  });
});

describe('DELETE /api/entries/:id (soft-delete)', () => {
  it('soft-deletes: row remains, isActive=false, "deleted" audit recorded', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);

    const { status, body } = await call('DELETE', `/api/entries/${e.id}`, u.id);
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });

    const [row] = await db.select().from(timeEntries).where(eq(timeEntries.id, e.id));
    expect(row).toBeDefined(); // not hard-deleted
    expect(row!.isActive).toBe(false);

    const audit = await auditFor(e.id);
    expect(audit.some((a) => a.action === 'deleted')).toBe(true);
  });

  it('stops a running clocked segment while deleting', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    const [seg] = await db
      .insert(entrySegments)
      .values({ entryId: e.id, type: 'clocked', startedAt: new Date(Date.now() - 60_000), stoppedAt: null })
      .returning();

    await call('DELETE', `/api/entries/${e.id}`, u.id);
    const [after] = await db.select().from(entrySegments).where(eq(entrySegments.id, seg!.id));
    expect(after!.stoppedAt).not.toBeNull();
    expect(after!.durationSeconds).toBeGreaterThan(0);
  });

  it('404 not found, 403 not owner, 400 already deleted', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    expect((await call('DELETE', '/api/entries/00000000-0000-0000-0000-000000000000', owner.id)).status).toBe(404);
    const e = await makeEntry(owner.id);
    expect((await call('DELETE', `/api/entries/${e.id}`, other.id)).status).toBe(403);
    const gone = await makeEntry(owner.id, { isActive: false });
    expect((await call('DELETE', `/api/entries/${gone.id}`, owner.id)).status).toBe(400);
  });
});

describe('POST /api/entries/:id/restore', () => {
  it('restores a soft-deleted entry and audits it', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { isActive: false });

    const { status, body } = await call('POST', `/api/entries/${e.id}/restore`, u.id);
    expect(status).toBe(200);
    expect(body.isActive).toBe(true);

    const [row] = await db.select().from(timeEntries).where(eq(timeEntries.id, e.id));
    expect(row!.isActive).toBe(true);
    const audit = await auditFor(e.id);
    expect(audit.some((a) => a.action === 'updated')).toBe(true);
  });

  it('400 when the entry is not deleted, 403 not owner', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const active = await makeEntry(owner.id, { isActive: true });
    expect((await call('POST', `/api/entries/${active.id}/restore`, owner.id)).status).toBe(400);
    const deleted = await makeEntry(owner.id, { isActive: false });
    expect((await call('POST', `/api/entries/${deleted.id}/restore`, other.id)).status).toBe(403);
  });
});

describe('POST /api/entries/:id/adjust', () => {
  it('adds a manual adjustment segment (negative allowed) and audits it', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);

    const { status } = await call('POST', `/api/entries/${e.id}/adjust`, u.id, {
      durationSeconds: -600,
      note: 'remove overlog',
    });
    expect(status).toBe(200);

    const segs = await db.select().from(entrySegments).where(eq(entrySegments.entryId, e.id));
    expect(segs).toHaveLength(1);
    expect(segs[0]!.type).toBe('manual');
    expect(segs[0]!.durationSeconds).toBe(-600);

    const audit = await auditFor(e.id);
    expect(audit.some((a) => a.action === 'adjustment_added')).toBe(true);
  });

  it('400 without a note', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    expect((await call('POST', `/api/entries/${e.id}/adjust`, u.id, { durationSeconds: 60 })).status).toBe(400);
  });

  it('404 inactive entry, 403 not owner', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const inactive = await makeEntry(owner.id, { isActive: false });
    expect((await call('POST', `/api/entries/${inactive.id}/adjust`, owner.id, { durationSeconds: 1, note: 'x' })).status).toBe(404);
    const e = await makeEntry(owner.id);
    expect((await call('POST', `/api/entries/${e.id}/adjust`, other.id, { durationSeconds: 1, note: 'x' })).status).toBe(403);
  });
});
