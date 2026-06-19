import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { clients, entrySegments, projects, timeEntries, users } from '../db/schema.js';
import { dashboardRoutes } from './dashboard.js';

// Integration tests for GET /api/dashboard — the main dashboard aggregation endpoint.
// Seeds segment timestamps at midday UTC (12:00Z) to avoid date-boundary flakiness
// when the test runs near Europe/Warsaw midnight (UTC+1/+2).

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(dashboardRoutes);
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

async function makeProject(name = 'Acme', color = '#00D4AA') {
  const [c] = await db.insert(clients).values({ name: `${name} Client` }).returning();
  const [p] = await db.insert(projects).values({ name, clientId: c!.id, color }).returning();
  return p!;
}

async function makeEntry(userId: string, over: Partial<typeof timeEntries.$inferInsert> = {}) {
  const [e] = await db.insert(timeEntries).values({ userId, description: 'Task', ...over }).returning();
  return e!;
}

async function makeSegmentAt(entryId: string, startedAt: Date, durationSeconds: number) {
  await db.insert(entrySegments).values({
    entryId,
    type: 'manual',
    startedAt,
    stoppedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
    durationSeconds,
  });
}

const getDashboard = async (userId: string) => {
  const res = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { 'x-dev-user-id': userId } });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};

// Returns a Date at 12:00 UTC for a given YYYY-MM-DD string
function middayUTC(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00Z');
}

// Get Monday of current week in Europe/Warsaw timezone as YYYY-MM-DD
function mondayOfCurrentWeekWaw(): string {
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const d = new Date(todayISO + 'T12:00:00Z');
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('GET /api/dashboard', () => {
  it('returns a 200 with the expected top-level shape', async () => {
    const u = await makeUser();
    const { status, body } = await getDashboard(u.id);
    expect(status).toBe(200);
    // Shape assertions
    expect(body).toHaveProperty('weekNumber');
    expect(body).toHaveProperty('weekStart');
    expect(body).toHaveProperty('weekEnd');
    expect(body).toHaveProperty('attention');
    expect(body).toHaveProperty('weekDays');
    expect(body).toHaveProperty('heatmapDays');
    expect(body).toHaveProperty('monthTotalSeconds');
    expect(body).toHaveProperty('projectBreakdown');
    expect(body).toHaveProperty('weekAvgPerDaySeconds');
    // weekDays must always be exactly 7
    expect(body.weekDays).toHaveLength(7);
  });

  it('returns zero totals when the user has no entries', async () => {
    const u = await makeUser();
    const { body } = await getDashboard(u.id);
    expect(body.attention.weekTotalSeconds).toBe(0);
    expect(body.attention.weekPercentage).toBe(0);
    expect(body.monthTotalSeconds).toBe(0);
    expect(body.projectBreakdown).toHaveLength(0);
    expect(body.weekAvgPerDaySeconds).toBe(0);
  });

  it('reflects this-week segments in weekDays totals', async () => {
    const u = await makeUser();
    const weekStart = mondayOfCurrentWeekWaw();
    // Seed a 1h segment on Monday
    const e = await makeEntry(u.id);
    await makeSegmentAt(e.id, middayUTC(weekStart), 3600);

    const { body } = await getDashboard(u.id);
    const monday = body.weekDays.find((d: { date: string }) => d.date === weekStart);
    expect(monday).toBeDefined();
    expect(monday.totalSeconds).toBe(3600);
    expect(body.attention.weekTotalSeconds).toBeGreaterThanOrEqual(3600);
  });

  it('weekDays are Mon–Sun in order with dayOfWeek 1–7', async () => {
    const u = await makeUser();
    const { body } = await getDashboard(u.id);
    const days: Array<{ dayOfWeek: number; dayLabel: string }> = body.weekDays;
    expect(days.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days[0]!.dayLabel).toBe('Mon');
    expect(days[6]!.dayLabel).toBe('Sun');
  });

  it('does not include another user entries', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const weekStart = mondayOfCurrentWeekWaw();
    const e = await makeEntry(bob.id);
    await makeSegmentAt(e.id, middayUTC(weekStart), 9000);

    const { body } = await getDashboard(alice.id);
    expect(body.attention.weekTotalSeconds).toBe(0);
    expect(body.projectBreakdown).toHaveLength(0);
  });

  it('does not include inactive (soft-deleted) entries', async () => {
    const u = await makeUser();
    const weekStart = mondayOfCurrentWeekWaw();
    const e = await makeEntry(u.id, { isActive: false });
    await makeSegmentAt(e.id, middayUTC(weekStart), 7200);

    const { body } = await getDashboard(u.id);
    expect(body.attention.weekTotalSeconds).toBe(0);
  });

  it('weekPercentage is clamped correctly — 40h target', async () => {
    const u = await makeUser();
    const weekStart = mondayOfCurrentWeekWaw();
    // Seed 20h = 72000s → expect 50%
    const e = await makeEntry(u.id);
    await makeSegmentAt(e.id, middayUTC(weekStart), 72_000);

    const { body } = await getDashboard(u.id);
    // weekPercentage = round(weekTotalSeconds / 144000 * 100)
    expect(body.attention.weekTargetSeconds).toBe(144_000);
    expect(body.attention.weekPercentage).toBe(50);
  });

  it('projectBreakdown includes named projects sorted by totalSeconds desc', async () => {
    const u = await makeUser();
    const weekStart = mondayOfCurrentWeekWaw();
    const pA = await makeProject('Alpha', '#ff0000');
    const pB = await makeProject('Beta', '#00ff00');

    const eA = await makeEntry(u.id, { projectId: pA.id });
    await makeSegmentAt(eA.id, middayUTC(weekStart), 3600); // 1h
    const eB = await makeEntry(u.id, { projectId: pB.id });
    await makeSegmentAt(eB.id, middayUTC(weekStart), 7200); // 2h

    const { body } = await getDashboard(u.id);
    const breakdown: Array<{ projectName: string; totalSeconds: number; percentage: number }> =
      body.projectBreakdown;
    // sorted desc: Beta (7200) first, Alpha (3600) second
    expect(breakdown[0]!.projectName).toBe('Beta');
    expect(breakdown[0]!.totalSeconds).toBe(7200);
    expect(breakdown[1]!.projectName).toBe('Alpha');
    expect(breakdown[1]!.totalSeconds).toBe(3600);

    // Percentages: 7200 / 10800 * 100 = 67, 3600 / 10800 * 100 = 33
    expect(breakdown[0]!.percentage).toBe(67);
    expect(breakdown[1]!.percentage).toBe(33);
  });

  it('entries without a project count as "No project" in projectBreakdown with amber color', async () => {
    const u = await makeUser();
    const weekStart = mondayOfCurrentWeekWaw();
    const e = await makeEntry(u.id); // no projectId
    await makeSegmentAt(e.id, middayUTC(weekStart), 1800);

    const { body } = await getDashboard(u.id);
    const breakdown: Array<{ projectName: string; projectColor: string; projectId: null }> =
      body.projectBreakdown;
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]!.projectName).toBe('No project');
    expect(breakdown[0]!.projectColor).toBe('#F59E0B');
    expect(breakdown[0]!.projectId).toBeNull();
  });

  it('attention.noProjectCount counts entries without a project this week', async () => {
    const u = await makeUser();
    const weekStart = mondayOfCurrentWeekWaw();

    const noProj1 = await makeEntry(u.id);
    await makeSegmentAt(noProj1.id, middayUTC(weekStart), 600);
    const noProj2 = await makeEntry(u.id);
    await makeSegmentAt(noProj2.id, middayUTC(weekStart), 600);

    const { body } = await getDashboard(u.id);
    expect(body.attention.noProjectCount).toBe(2);
  });

  it('heatmapDays covers all days of the current month', async () => {
    const u = await makeUser();
    const { body } = await getDashboard(u.id);
    const days: Array<{ dayOfMonth: number; dayOfWeek: number; weekIndex: number }> = body.heatmapDays;
    // Must have at least 28 days
    expect(days.length).toBeGreaterThanOrEqual(28);
    // dayOfMonth goes 1..N monotonically
    expect(days[0]!.dayOfMonth).toBe(1);
    expect(days[days.length - 1]!.dayOfMonth).toBe(days.length);
    // dayOfWeek in 1–7
    for (const d of days) {
      expect(d.dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(d.dayOfWeek).toBeLessThanOrEqual(7);
    }
  });

  it('heatmapDays totalSeconds reflects seeded month entries', async () => {
    const u = await makeUser();
    // Seed an entry at the start of the current month at midday Warsaw time
    const nowWaw = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const [yearStr, monthStr] = nowWaw.split('-') as [string, string];
    const monthStartISO = `${yearStr}-${monthStr}-01`;

    const e = await makeEntry(u.id);
    await makeSegmentAt(e.id, middayUTC(monthStartISO), 5400); // 1.5h

    const { body } = await getDashboard(u.id);
    const day1 = (body.heatmapDays as Array<{ dayOfMonth: number; totalSeconds: number }>).find(
      (d) => d.dayOfMonth === 1,
    );
    expect(day1).toBeDefined();
    expect(day1!.totalSeconds).toBe(5400);
    expect(body.monthTotalSeconds).toBeGreaterThanOrEqual(5400);
  });

  it('weekNumber is a positive integer in 1–53', async () => {
    const u = await makeUser();
    const { body } = await getDashboard(u.id);
    expect(body.weekNumber).toBeGreaterThanOrEqual(1);
    expect(body.weekNumber).toBeLessThanOrEqual(53);
  });

  it('weekStart is always a Monday and weekEnd a Sunday', async () => {
    const u = await makeUser();
    const { body } = await getDashboard(u.id);
    const startDow = new Date(body.weekStart + 'T12:00:00Z').getUTCDay();
    const endDow = new Date(body.weekEnd + 'T12:00:00Z').getUTCDay();
    expect(startDow).toBe(1); // Monday
    expect(endDow).toBe(0); // Sunday
    // Must be exactly 6 days apart
    const diff =
      (new Date(body.weekEnd + 'T12:00:00Z').getTime() -
        new Date(body.weekStart + 'T12:00:00Z').getTime()) /
      86_400_000;
    expect(diff).toBe(6);
  });

  it('weekAvgPerDaySeconds equals weekday total divided by elapsed weekdays', async () => {
    const u = await makeUser();
    const weekStart = mondayOfCurrentWeekWaw();
    const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    // Seed 3600s on Monday
    const e = await makeEntry(u.id);
    await makeSegmentAt(e.id, middayUTC(weekStart), 3600);

    const { body } = await getDashboard(u.id);

    // Count elapsed weekdays (Mon–Fri) up to and including today
    let elapsed = 0;
    for (let i = 0; i < 5; i++) {
      const d = addDays(weekStart, i);
      if (d <= todayISO) elapsed++;
    }

    // The avg is computed on elapsed Mon-Fri days only
    if (elapsed > 0) {
      // weekAvgPerDaySeconds = Math.round(weekdayTotal / elapsed)
      const weekdayTotal = body.weekDays
        .filter((d: { dayOfWeek: number }) => d.dayOfWeek <= 5)
        .filter((d: { date: string }) => d.date <= todayISO)
        .reduce((s: number, d: { totalSeconds: number }) => s + d.totalSeconds, 0);
      expect(body.weekAvgPerDaySeconds).toBe(Math.round(weekdayTotal / elapsed));
    }
  });
});
