import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { entryAuditLog, entrySegments, timeEntries, users } from '../db/schema.js';
import { entriesRoutes } from './entries.js';

// Integration tests for the entry read routes: GET /api/entries (day-grouped list
// with date/user/deleted filters), GET /api/entries/recent, GET /api/entries/:id/audit.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(entriesRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(role: 'admin' | 'user' = 'user') {
  const [u] = await db
    .insert(users)
    .values({ displayName: `U-${Math.random()}`, email: `u${Math.random()}@x.io`, globalRole: role })
    .returning();
  return u!;
}
async function makeEntry(userId: string, over: Partial<typeof timeEntries.$inferInsert> = {}) {
  const [e] = await db.insert(timeEntries).values({ userId, description: 'Task', ...over }).returning();
  return e!;
}
async function makeSegmentAt(entryId: string, startedAtISO: string, durationSeconds = 3600) {
  await db.insert(entrySegments).values({
    entryId,
    type: 'manual',
    startedAt: new Date(startedAtISO),
    stoppedAt: new Date(new Date(startedAtISO).getTime() + durationSeconds * 1000),
    durationSeconds,
  });
}

const getJson = async (url: string, userId: string) => {
  const res = await app.inject({ method: 'GET', url, headers: { 'x-dev-user-id': userId } });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};
// flatten day-grouped list → entry ids
const listIds = (groups: Array<{ entries: Array<{ id: string }> }>) =>
  groups.flatMap((g) => g.entries.map((e) => e.id));

describe('GET /api/entries (list)', () => {
  it('returns only the caller’s own active entries by default', async () => {
    const ann = await makeUser();
    const bob = await makeUser();
    const mine = await makeEntry(ann.id, { description: 'Mine' });
    await makeSegmentAt(mine.id, '2026-03-15T12:00:00Z');
    const theirs = await makeEntry(bob.id);
    await makeSegmentAt(theirs.id, '2026-03-15T12:00:00Z');
    const deleted = await makeEntry(ann.id, { isActive: false });
    await makeSegmentAt(deleted.id, '2026-03-15T12:00:00Z');

    const { status, body } = await getJson('/api/entries?from=2026-03-01&to=2026-03-31', ann.id);
    expect(status).toBe(200);
    expect(listIds(body)).toEqual([mine.id]);
  });

  it('filters by the from/to date range', async () => {
    const u = await makeUser();
    const inRange = await makeEntry(u.id, { description: 'March' });
    await makeSegmentAt(inRange.id, '2026-03-15T12:00:00Z');
    const outOfRange = await makeEntry(u.id, { description: 'April' });
    await makeSegmentAt(outOfRange.id, '2026-04-15T12:00:00Z');

    const ids = listIds((await getJson('/api/entries?from=2026-03-01&to=2026-03-31', u.id)).body);
    expect(ids).toEqual([inRange.id]);
  });

  it('shows soft-deleted entries with ?deleted=true', async () => {
    const u = await makeUser();
    const active = await makeEntry(u.id, { description: 'Active' });
    await makeSegmentAt(active.id, '2026-03-15T12:00:00Z');
    const deleted = await makeEntry(u.id, { description: 'Deleted', isActive: false });
    await makeSegmentAt(deleted.id, '2026-03-15T12:00:00Z');

    const ids = listIds((await getJson('/api/entries?from=2026-03-01&to=2026-03-31&deleted=true', u.id)).body);
    expect(ids).toEqual([deleted.id]);
  });

  it('groups entries by day with a per-day total', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    await makeSegmentAt(e.id, '2026-03-15T12:00:00Z', 3600);

    const { body } = await getJson('/api/entries?from=2026-03-01&to=2026-03-31', u.id);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ date: '2026-03-15', totalSeconds: 3600 });
  });

  describe('admin cross-user access', () => {
    it('rejects a non-admin passing ?userId (403)', async () => {
      const u = await makeUser('user');
      const other = await makeUser();
      expect((await getJson(`/api/entries?userId=${other.id}`, u.id)).status).toBe(403);
    });

    it('lets an admin view a specific user, and everyone with ?userId=all', async () => {
      const admin = await makeUser('admin');
      const target = await makeUser();
      const t = await makeEntry(target.id, { description: 'Target' });
      await makeSegmentAt(t.id, '2026-03-15T12:00:00Z');
      const a = await makeEntry(admin.id, { description: 'Admin' });
      await makeSegmentAt(a.id, '2026-03-15T12:00:00Z');

      const specific = listIds((await getJson(`/api/entries?userId=${target.id}&from=2026-03-01&to=2026-03-31`, admin.id)).body);
      expect(specific).toEqual([t.id]);

      const all = listIds((await getJson('/api/entries?userId=all&from=2026-03-01&to=2026-03-31', admin.id)).body);
      expect(all.sort()).toEqual([t.id, a.id].sort());
    });
  });
});

describe('GET /api/entries/recent', () => {
  it('returns own active, non-empty entries deduplicated by description', async () => {
    const u = await makeUser();
    const older = await makeEntry(u.id, { description: 'Standup', createdAt: new Date('2026-01-01T00:00:00Z') });
    await makeSegmentAt(older.id, '2026-01-01T09:00:00Z');
    const newer = await makeEntry(u.id, { description: 'Standup', createdAt: new Date('2026-05-01T00:00:00Z') });
    await makeSegmentAt(newer.id, '2026-05-01T09:00:00Z');

    const { status, body } = await getJson('/api/entries/recent', u.id);
    expect(status).toBe(200);
    expect(body).toHaveLength(1); // deduped
    expect(body[0].id).toBe(newer.id); // most recent kept
  });

  it('excludes other users, inactive entries and empty descriptions', async () => {
    const u = await makeUser();
    const other = await makeUser();
    await makeEntry(other.id, { description: 'Theirs' });
    await makeEntry(u.id, { description: 'Gone', isActive: false });
    await makeEntry(u.id, { description: '' });
    const visible = await makeEntry(u.id, { description: 'Mine' });

    const ids = (await getJson('/api/entries/recent', u.id)).body.map((r: { id: string }) => r.id);
    expect(ids).toEqual([visible.id]);
  });

  it('caps the limit at 20', async () => {
    const u = await makeUser();
    for (let i = 0; i < 25; i++) await makeEntry(u.id, { description: `Task ${i}` });
    expect((await getJson('/api/entries/recent?limit=50', u.id)).body.length).toBeLessThanOrEqual(20);
  });
});

describe('GET /api/entries/:id/audit', () => {
  async function addAudit(entryId: string, userId: string, actorId: string, createdAt: Date) {
    await db.insert(entryAuditLog).values({ entryId, userId, actorId, action: 'updated', createdAt });
  }

  it('returns the audit trail newest-first with the actor name', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    await addAudit(e.id, u.id, u.id, new Date('2026-01-01T00:00:00Z'));
    await addAudit(e.id, u.id, u.id, new Date('2026-05-01T00:00:00Z'));

    const { status, body } = await getJson(`/api/entries/${e.id}/audit`, u.id);
    expect(status).toBe(200);
    expect(body).toHaveLength(2);
    expect(new Date(body[0].createdAt).getTime()).toBeGreaterThan(new Date(body[1].createdAt).getTime());
    expect(body[0].actorName).toBe(u.displayName);
  });

  it('404 for a missing entry; 403 for a non-owner non-admin; allows an admin', async () => {
    const owner = await makeUser();
    const other = await makeUser('user');
    const admin = await makeUser('admin');
    const e = await makeEntry(owner.id);
    await addAudit(e.id, owner.id, owner.id, new Date());

    expect((await getJson('/api/entries/00000000-0000-0000-0000-000000000000/audit', owner.id)).status).toBe(404);
    expect((await getJson(`/api/entries/${e.id}/audit`, other.id)).status).toBe(403);
    expect((await getJson(`/api/entries/${e.id}/audit`, admin.id)).status).toBe(200);
  });
});
