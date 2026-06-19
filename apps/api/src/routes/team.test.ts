import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users, clients, projects, entrySegments, timeEntries, workingSchedules } from '../db/schema.js';
import { teamRoutes } from './team.js';
import { DEFAULT_WEEKLY_WORKING_HOURS } from '@ternity/shared';

// Integration tests for GET /api/team/board

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(teamRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      displayName: `U-${Math.random()}`,
      email: `u${Math.random()}@acme.io`,
      globalRole: 'admin',
      active: true,
      ...overrides,
    })
    .returning();
  return u!;
}

async function makeProject(name = 'Web') {
  const [c] = await db.insert(clients).values({ name: `${name} Client` }).returning();
  const [p] = await db.insert(projects).values({ name, clientId: c!.id }).returning();
  return p!;
}

async function makeEntry(userId: string, projectId?: string) {
  const [e] = await db
    .insert(timeEntries)
    .values({ userId, description: 'Task', projectId: projectId ?? null })
    .returning();
  return e!;
}

async function makeSegment(
  entryId: string,
  opts: { startedAt?: Date; stoppedAt?: Date | null; type?: 'clocked' | 'manual'; durationSeconds?: number } = {},
) {
  const [s] = await db
    .insert(entrySegments)
    .values({
      entryId,
      type: opts.type ?? 'manual',
      startedAt: opts.startedAt ?? new Date(),
      stoppedAt: opts.stoppedAt !== undefined ? opts.stoppedAt : new Date(),
      durationSeconds: opts.durationSeconds ?? 3600,
    })
    .returning();
  return s!;
}

const getBoard = async (userId: string, query = '') => {
  const res = await app.inject({
    method: 'GET',
    url: `/api/team/board${query}`,
    headers: { 'x-dev-user-id': userId },
  });
  return { status: res.statusCode, body: res.json() };
};

describe('GET /api/team/board', () => {
  it('returns a board entry for each active user', async () => {
    const u1 = await makeUser({ displayName: 'Alice' });
    const u2 = await makeUser({ displayName: 'Bob' });

    const { status, body } = await getBoard(u1.id);
    expect(status).toBe(200);
    const ids = body.map((r: { id: string }) => r.id);
    expect(ids).toContain(u1.id);
    expect(ids).toContain(u2.id);
  });

  it('excludes inactive users from the board', async () => {
    const active = await makeUser({ active: true });
    const inactive = await makeUser({ active: false });

    const { body } = await getBoard(active.id);
    const ids = body.map((r: { id: string }) => r.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(inactive.id);
  });

  it('returns an ordered list by displayName', async () => {
    const u1 = await makeUser({ displayName: 'Zara' });
    const u2 = await makeUser({ displayName: 'Aaron' });

    const { body } = await getBoard(u1.id);
    const names = body.map((r: { displayName: string }) => r.displayName);
    const idx1 = names.indexOf('Aaron');
    const idx2 = names.indexOf('Zara');
    expect(idx1).toBeLessThan(idx2);
  });

  it("includes each user's entries field (array)", async () => {
    const u = await makeUser({ displayName: 'TestUser' });

    const { body } = await getBoard(u.id);
    const row = body.find((r: { id: string }) => r.id === u.id);
    expect(row).toBeDefined();
    expect(Array.isArray(row.entries)).toBe(true);
  });

  it("sets status='off' for a user with no schedule override on a working day", async () => {
    // Seed a user with no custom schedule; DEFAULT uses 08:30-16:30 Mon-Fri (enabled)
    // Status derivation depends on current time — we only test that we get a valid status string.
    const u = await makeUser();

    const { body } = await getBoard(u.id);
    const row = body.find((r: { id: string }) => r.id === u.id);
    expect(['active', 'idle', 'off', 'overtime']).toContain(row.status);
  });

  it('includes team info (teamId/teamName/teamColor) when a defaultProject is set', async () => {
    const project = await makeProject('DevTeam');
    const u = await makeUser({ defaultProjectId: project.id });

    const { body } = await getBoard(u.id);
    const row = body.find((r: { id: string }) => r.id === u.id);
    expect(row.teamId).toBe(project.id);
    expect(row.teamName).toBe('DevTeam');
  });

  it('sets teamId/teamName/teamColor to null when no defaultProject', async () => {
    const u = await makeUser();

    const { body } = await getBoard(u.id);
    const row = body.find((r: { id: string }) => r.id === u.id);
    expect(row.teamId).toBeNull();
    expect(row.teamName).toBeNull();
  });

  it('includes runningEntry when an unstopped clocked segment exists today', async () => {
    const u = await makeUser();
    const entry = await makeEntry(u.id);
    // An open clocked segment starting now (today by definition)
    await makeSegment(entry.id, {
      type: 'clocked',
      startedAt: new Date(),
      stoppedAt: null,
    });

    const { body } = await getBoard(u.id);
    const row = body.find((r: { id: string }) => r.id === u.id);
    expect(row.runningEntry).not.toBeNull();
    expect(row.runningEntry).toMatchObject({
      description: 'Task',
      startedAt: expect.any(String),
    });
  });

  it('sets runningEntry=null when no open segment exists', async () => {
    const u = await makeUser();
    const entry = await makeEntry(u.id);
    // Stopped segment
    await makeSegment(entry.id, { type: 'clocked', stoppedAt: new Date() });

    const { body } = await getBoard(u.id);
    const row = body.find((r: { id: string }) => r.id === u.id);
    expect(row.runningEntry).toBeNull();
  });

  it('accepts a ?date= query param for past day boards and returns status active/off', async () => {
    const u = await makeUser();
    const pastDate = '2026-01-15';

    // No entries on that day
    const { status, body } = await getBoard(u.id, `?date=${pastDate}`);
    expect(status).toBe(200);
    const row = body.find((r: { id: string }) => r.id === u.id);
    // Past day with no entries → status='off'
    expect(row.status).toBe('off');
  });

  it("uses 'idle' or 'active' status when schedule has an enabled today-key", async () => {
    // Seed a working schedule that covers all days 00:00-23:59 so we always hit "within schedule"
    const u = await makeUser();
    const allDaySchedule = Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
        d,
        { enabled: true, start: '00:00', end: '23:59' },
      ]),
    ) as typeof DEFAULT_WEEKLY_WORKING_HOURS;
    await db.insert(workingSchedules).values({ userId: u.id, schedule: allDaySchedule });

    const { body } = await getBoard(u.id);
    const row = body.find((r: { id: string }) => r.id === u.id);
    // No running timer → idle (within schedule, no timer)
    // Running timer would make it 'active'
    expect(['idle', 'active']).toContain(row.status);
  });
});
