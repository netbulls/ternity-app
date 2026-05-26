import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import {
  clients,
  entrySegments,
  entryTags,
  projectMembers,
  projects,
  tags,
  timeEntries,
  users,
} from '../db/schema.js';
import { buildEntryResponse, timerRoutes } from './timer.js';

// Integration tests for the timer routes (start/resume/start-or-resume/stop/get) and
// the buildEntryResponse helper that the whole entries API uses to shape responses.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(timerRoutes);
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
async function makeEntry(userId: string, over: Partial<typeof timeEntries.$inferInsert> = {}) {
  const [e] = await db.insert(timeEntries).values({ userId, description: 'Task', ...over }).returning();
  return e!;
}

const post = async (url: string, userId: string, body?: unknown) => {
  const res = await app.inject({ method: 'POST', url, headers: { 'x-dev-user-id': userId }, payload: body as object });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};
const getTimer = async (userId: string) => (await app.inject({ method: 'GET', url: '/api/timer', headers: { 'x-dev-user-id': userId } })).json();
const segmentsOf = (entryId: string) => db.select().from(entrySegments).where(eq(entrySegments.entryId, entryId));

// ── buildEntryResponse ─────────────────────────────────────────────────────

describe('buildEntryResponse', () => {
  it('returns null for a missing entry', async () => {
    expect(await buildEntryResponse('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('assembles project, tags, segments and totals', async () => {
    const u = await makeUser();
    const p = await makeProject('Apollo');
    const e = await makeEntry(u.id, { description: 'Build', projectId: p.id });
    const [tag] = await db.insert(tags).values({ name: 'Billable', userId: u.id }).returning();
    await db.insert(entryTags).values({ entryId: e.id, tagId: tag!.id });
    await db.insert(entrySegments).values([
      { entryId: e.id, type: 'manual', durationSeconds: 1200, note: 'a' },
      { entryId: e.id, type: 'manual', durationSeconds: 600, note: 'b' },
    ]);

    const entry = (await buildEntryResponse(e.id))!;
    expect(entry).toMatchObject({
      description: 'Build',
      projectName: 'Apollo',
      clientName: 'Apollo Client',
      totalDurationSeconds: 1800,
      isRunning: false,
    });
    expect(entry.tags.map((t) => t.id)).toEqual([tag!.id]);
    expect(entry.segments).toHaveLength(2);
  });

  it('reports isRunning=true only when a clocked segment is unstopped', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    await db.insert(entrySegments).values({ entryId: e.id, type: 'clocked', startedAt: new Date(), stoppedAt: null });
    expect((await buildEntryResponse(e.id))!.isRunning).toBe(true);
  });
});

// ── GET /api/timer ─────────────────────────────────────────────────────────

describe('GET /api/timer', () => {
  it('reports no running timer when none exists', async () => {
    const u = await makeUser();
    expect(await getTimer(u.id)).toEqual({ running: false, entry: null });
  });

  it('returns the running entry when a clocked segment is open', async () => {
    const u = await makeUser();
    const { body } = await post('/api/timer/start', u.id, { description: 'Now' });
    const state = await getTimer(u.id);
    expect(state.running).toBe(true);
    expect(state.entry.id).toBe(body.entry.id);
  });
});

// ── POST /api/timer/start ───────────────────────────────────────────────────

describe('POST /api/timer/start', () => {
  it('creates an entry with an open clocked segment', async () => {
    const u = await makeUser();
    const { status, body } = await post('/api/timer/start', u.id, { description: 'Coding' });
    expect(status).toBe(200);
    expect(body.running).toBe(true);
    expect(body.entry.isRunning).toBe(true);
    expect(body.entry.segments).toHaveLength(1);
    expect(body.entry.segments[0]).toMatchObject({ type: 'clocked', stoppedAt: null });
  });

  it('defaults description to "" and project to null', async () => {
    const u = await makeUser();
    const { body } = await post('/api/timer/start', u.id, {});
    expect(body.entry).toMatchObject({ description: '', projectId: null });
  });

  it('auto-stops a previously running timer before starting the new one', async () => {
    const u = await makeUser();
    const first = await post('/api/timer/start', u.id, { description: 'First' });
    await post('/api/timer/start', u.id, { description: 'Second' });

    const firstSegs = await segmentsOf(first.body.entry.id);
    expect(firstSegs[0]!.stoppedAt).not.toBeNull(); // previous timer was stopped
    // only one timer is running for the user now
    const running = await db
      .select()
      .from(entrySegments)
      .innerJoin(timeEntries, eq(entrySegments.entryId, timeEntries.id))
      .where(and(eq(timeEntries.userId, u.id), eq(entrySegments.type, 'clocked'), isNull(entrySegments.stoppedAt)));
    expect(running).toHaveLength(1);
  });

  it('rejects a non-admin starting on a project they are not a member of (403)', async () => {
    const u = await makeUser('user');
    const p = await makeProject();
    expect((await post('/api/timer/start', u.id, { projectId: p.id })).status).toBe(403);
  });

  it('400 on a malformed body (body validated by StartTimerSchema)', async () => {
    const u = await makeUser();
    // tagIds must be an array of strings — a wrong type is a ZodError → 400, not a 500 crash
    expect((await post('/api/timer/start', u.id, { tagIds: 'nope' })).status).toBe(400);
  });
});

// ── POST /api/timer/resume/:id ──────────────────────────────────────────────

describe('POST /api/timer/resume/:id', () => {
  it('adds a new clocked segment to a stopped entry', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    await db.insert(entrySegments).values({
      entryId: e.id,
      type: 'clocked',
      startedAt: new Date('2026-05-01T09:00:00Z'),
      stoppedAt: new Date('2026-05-01T10:00:00Z'),
      durationSeconds: 3600,
    });

    const { status, body } = await post(`/api/timer/resume/${e.id}`, u.id);
    expect(status).toBe(200);
    expect(body.entry.isRunning).toBe(true);
    expect(await segmentsOf(e.id)).toHaveLength(2); // original + new open segment
  });

  it('returns the entry as-is if it is already running (no extra segment)', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);
    await db.insert(entrySegments).values({ entryId: e.id, type: 'clocked', startedAt: new Date(), stoppedAt: null });

    const { body } = await post(`/api/timer/resume/${e.id}`, u.id);
    expect(body.running).toBe(true);
    expect(await segmentsOf(e.id)).toHaveLength(1);
  });

  it('404 for missing/inactive, 403 for not-owner', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    expect((await post('/api/timer/resume/00000000-0000-0000-0000-000000000000', owner.id)).status).toBe(404);
    const inactive = await makeEntry(owner.id, { isActive: false });
    expect((await post(`/api/timer/resume/${inactive.id}`, owner.id)).status).toBe(404);
    const e = await makeEntry(owner.id);
    expect((await post(`/api/timer/resume/${e.id}`, other.id)).status).toBe(403);
  });
});

// ── POST /api/timer/start-or-resume ─────────────────────────────────────────

describe('POST /api/timer/start-or-resume', () => {
  it('resumes an existing entry that matches the jiraIssueKey', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { jiraIssueKey: 'PROJ-1' });
    await db.insert(entrySegments).values({
      entryId: e.id,
      type: 'clocked',
      startedAt: new Date('2026-05-01T09:00:00Z'),
      stoppedAt: new Date('2026-05-01T10:00:00Z'),
      durationSeconds: 3600,
    });

    const { body } = await post('/api/timer/start-or-resume', u.id, { jiraIssueKey: 'PROJ-1' });
    expect(body.entry.id).toBe(e.id); // resumed, not a new entry
    expect(await db.select().from(timeEntries)).toHaveLength(1);
  });

  it('creates a new entry when no jiraIssueKey match exists', async () => {
    const u = await makeUser();
    const { body } = await post('/api/timer/start-or-resume', u.id, { jiraIssueKey: 'NEW-9', description: 'fresh' });
    expect(body.entry.description).toBe('fresh');
    expect(body.entry.isRunning).toBe(true);
    expect(await db.select().from(timeEntries)).toHaveLength(1);
  });
});

// ── POST /api/timer/stop ────────────────────────────────────────────────────

describe('POST /api/timer/stop', () => {
  it('404 when there is no running timer', async () => {
    const u = await makeUser();
    expect((await post('/api/timer/stop', u.id)).status).toBe(404);
  });

  it('stops the running segment and sets a duration', async () => {
    const u = await makeUser();
    const started = await post('/api/timer/start', u.id, { description: 'Work' });

    const { status, body } = await post('/api/timer/stop', u.id);
    expect(status).toBe(200);
    expect(body.running).toBe(false);

    const [seg] = await segmentsOf(started.body.entry.id);
    expect(seg!.stoppedAt).not.toBeNull();
    expect(seg!.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it('saves a pending description supplied with the stop', async () => {
    const u = await makeUser();
    const started = await post('/api/timer/start', u.id, { description: 'old' });
    await post('/api/timer/stop', u.id, { description: 'final description' });

    const [row] = await db.select().from(timeEntries).where(eq(timeEntries.id, started.body.entry.id));
    expect(row!.description).toBe('final description');
  });

  it('400 when description is the wrong type (body validated by StopTimerSchema)', async () => {
    const u = await makeUser();
    await post('/api/timer/start', u.id, { description: 'Work' });
    expect((await post('/api/timer/stop', u.id, { description: 42 })).status).toBe(400);
  });
});
