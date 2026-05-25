import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { clients, entrySegments, projects, timeEntries, users } from '../db/schema.js';
import { statsRoutes } from './stats.js';

// Integration tests for GET /api/stats — today + this-week totals.
//
// NOTE: stats.ts uses `timeEntries.createdAt` (not segment.startedAt) for date
// filtering (see the WHERE clause in both queries). This is a potential bug: if a
// segment is added later the same day but the entry was created yesterday, the
// segment may not appear in "today". Tests characterize ACTUAL behaviour.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(statsRoutes);
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

async function makeSegment(
  entryId: string,
  startedAt: Date,
  durationSeconds: number,
) {
  const stoppedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
  await db.insert(entrySegments).values({
    entryId,
    type: 'manual',
    startedAt,
    stoppedAt,
    durationSeconds,
  });
}

const getStats = async (userId: string) => {
  const res = await app.inject({ method: 'GET', url: '/api/stats', headers: { 'x-dev-user-id': userId } });
  return { status: res.statusCode, body: res.json() };
};

describe('GET /api/stats', () => {
  it('returns zero totals when the user has no entries', async () => {
    const u = await makeUser();
    const { status, body } = await getStats(u.id);
    expect(status).toBe(200);
    expect(body).toEqual({ todaySeconds: 0, weekSeconds: 0 });
  });

  it('sums segment durations for entries created today', async () => {
    const u = await makeUser();
    // Entry created NOW (today in any TZ) with two segments
    const e = await makeEntry(u.id);
    const midday = new Date();
    midday.setUTCHours(12, 0, 0, 0);
    await makeSegment(e.id, midday, 1800); // 30 min
    await makeSegment(e.id, new Date(midday.getTime() + 3600_000), 900); // 15 min

    const { body } = await getStats(u.id);
    expect(body.todaySeconds).toBe(2700);
    expect(body.weekSeconds).toBeGreaterThanOrEqual(2700);
  });

  it('includes this-week entries in weekSeconds but not in todaySeconds', async () => {
    const u = await makeUser();

    // An entry from earlier this week (Mon) — characterizes the createdAt-based filter.
    // We force createdAt to Monday of this week using a raw date well within the week.
    const mondayISO = getMondayOfCurrentWeek();
    const mondayMidnightLike = new Date(mondayISO + 'T12:00:00Z');

    // Entry with a past createdAt (still this week, but not today)
    const e = await makeEntry(u.id, { createdAt: mondayMidnightLike });
    await makeSegment(e.id, mondayMidnightLike, 3600); // 1h

    const { body } = await getStats(u.id);
    // todaySeconds: entry NOT created today → not counted (characterizes createdAt filter)
    // This is the potentially-buggy filter — pin actual behaviour.
    if (mondayISO === getTodayISO()) {
      // Monday IS today — it will appear in both
      expect(body.todaySeconds).toBe(3600);
      expect(body.weekSeconds).toBe(3600);
    } else {
      // Not today — appears in week total only
      expect(body.todaySeconds).toBe(0);
      expect(body.weekSeconds).toBe(3600);
    }
  });

  it('excludes inactive (soft-deleted) entries', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { isActive: false });
    const midday = new Date();
    midday.setUTCHours(12, 0, 0, 0);
    await makeSegment(e.id, midday, 7200);

    const { body } = await getStats(u.id);
    expect(body.todaySeconds).toBe(0);
    expect(body.weekSeconds).toBe(0);
  });

  it('does not include another user entries', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const e = await makeEntry(bob.id);
    const midday = new Date();
    midday.setUTCHours(12, 0, 0, 0);
    await makeSegment(e.id, midday, 5000);

    const { body } = await getStats(alice.id);
    expect(body.todaySeconds).toBe(0);
    expect(body.weekSeconds).toBe(0);
  });

  it('accounts for multiple entries summed together', async () => {
    const u = await makeUser();
    const midday = new Date();
    midday.setUTCHours(12, 0, 0, 0);
    const e1 = await makeEntry(u.id);
    await makeSegment(e1.id, midday, 1000);
    const e2 = await makeEntry(u.id);
    await makeSegment(e2.id, new Date(midday.getTime() + 3_600_000), 500);

    const { body } = await getStats(u.id);
    expect(body.todaySeconds).toBe(1500);
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

function getTodayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}

function getMondayOfCurrentWeek(): string {
  const todayISO = getTodayISO();
  const d = new Date(todayISO + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}
