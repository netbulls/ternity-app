import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { entrySegments, timeEntries, users } from '../db/schema.js';
import { entriesRoutes } from './entries.js';

// Integration tests for the block-level operations: move-block (move a time block
// into a new entry) and split (split off time into a new entry). Both create a new
// entry and offset the original with a negative adjustment segment.

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
  const [e] = await db.insert(timeEntries).values({ userId, description: 'Task', ...over }).returning();
  return e!;
}
async function makeSegment(entryId: string, over: Partial<typeof entrySegments.$inferInsert>) {
  const [s] = await db
    .insert(entrySegments)
    .values({ entryId, type: 'manual', ...over })
    .returning();
  return s!;
}
const post = async (url: string, userId: string, body: unknown) => {
  const res = await app.inject({ method: 'POST', url, headers: { 'x-dev-user-id': userId }, payload: body as object });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};
const segmentsOf = (entryId: string) =>
  db.select().from(entrySegments).where(eq(entrySegments.entryId, entryId));

describe('POST /api/entries/:id/move-block', () => {
  it('moves a completed block to a new entry and offsets the original', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { description: 'Original' });
    const seg = await makeSegment(e.id, {
      type: 'clocked',
      startedAt: new Date('2026-05-20T09:00:00Z'),
      stoppedAt: new Date('2026-05-20T10:00:00Z'),
      durationSeconds: 3600,
    });

    const { status, body } = await post(`/api/entries/${e.id}/move-block`, u.id, { segmentId: seg.id });
    expect(status).toBe(200);

    // new entry returned, total now 2 entries
    expect(await db.select().from(timeEntries)).toHaveLength(2);
    expect(body.id).not.toBe(e.id);

    // original gets a -3600 adjustment segment
    const origSegs = await segmentsOf(e.id);
    expect(origSegs.some((s) => s.durationSeconds === -3600)).toBe(true);
    // new entry carries the moved duration
    const newSegs = await segmentsOf(body.id);
    expect(newSegs.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)).toBe(3600);
  });

  it('auto-generates a "(N)" description when none is provided', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { description: 'Standup' });
    const seg = await makeSegment(e.id, {
      type: 'clocked',
      startedAt: new Date('2026-05-20T09:00:00Z'),
      stoppedAt: new Date('2026-05-20T10:00:00Z'),
      durationSeconds: 3600,
    });
    const { body } = await post(`/api/entries/${e.id}/move-block`, u.id, { segmentId: seg.id });
    expect(body.description).toBe('Standup (1)');
  });

  it('400 when the segment is not on the entry', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    const { status } = await post(`/api/entries/${e.id}/move-block`, u.id, {
      segmentId: '00000000-0000-0000-0000-000000000000',
    });
    expect(status).toBe(400);
  });

  it('404 inactive entry, 403 not owner', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const inactive = await makeEntry(owner.id, { isActive: false });
    expect((await post(`/api/entries/${inactive.id}/move-block`, owner.id, { segmentId: 'x' })).status).toBe(404);
    const e = await makeEntry(owner.id);
    expect((await post(`/api/entries/${e.id}/move-block`, other.id, { segmentId: 'x' })).status).toBe(403);
  });
});

describe('POST /api/entries/:id/split', () => {
  async function entryWith3600(userId: string) {
    const e = await makeEntry(userId, { description: 'Work' });
    await makeSegment(e.id, {
      type: 'manual',
      startedAt: new Date('2026-05-20T09:00:00Z'),
      stoppedAt: new Date('2026-05-20T10:00:00Z'),
      durationSeconds: 3600,
    });
    return e;
  }

  it('splits off part of the time into a new entry, offsetting the original', async () => {
    const u = await makeUser();
    const e = await entryWith3600(u.id);

    const { status, body } = await post(`/api/entries/${e.id}/split`, u.id, { durationSeconds: 1200 });
    expect(status).toBe(200);

    expect(await db.select().from(timeEntries)).toHaveLength(2);
    expect(body.id).not.toBe(e.id);
    expect((await segmentsOf(body.id)).reduce((s, x) => s + (x.durationSeconds ?? 0), 0)).toBe(1200);
    // original offset by -1200 → net 2400
    expect((await segmentsOf(e.id)).reduce((s, x) => s + (x.durationSeconds ?? 0), 0)).toBe(2400);
  });

  it('400 when split duration is >= the entry total', async () => {
    const u = await makeUser();
    const e = await entryWith3600(u.id);
    expect((await post(`/api/entries/${e.id}/split`, u.id, { durationSeconds: 3600 })).status).toBe(400);
  });

  it('400 when the entry is still running', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    await makeSegment(e.id, { type: 'clocked', startedAt: new Date(), stoppedAt: null });
    expect((await post(`/api/entries/${e.id}/split`, u.id, { durationSeconds: 60 })).status).toBe(400);
  });

  it('400 when the entry has no segments', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    expect((await post(`/api/entries/${e.id}/split`, u.id, { durationSeconds: 60 })).status).toBe(400);
  });

  it('404 inactive, 403 not owner', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const inactive = await makeEntry(owner.id, { isActive: false });
    expect((await post(`/api/entries/${inactive.id}/split`, owner.id, { durationSeconds: 1 })).status).toBe(404);
    const e = await entryWith3600(owner.id);
    expect((await post(`/api/entries/${e.id}/split`, other.id, { durationSeconds: 1 })).status).toBe(403);
  });
});
