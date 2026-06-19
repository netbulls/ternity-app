import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users, syncRuns, syncScheduleState } from '../db/schema.js';
import { syncStatusRoutes } from './sync-status.js';

// Integration tests for:
//   GET /api/sync/status  — scheduler state + last completed runs per entity
//   GET /api/sync/runs    — paginated run history with optional filters

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(syncStatusRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser() {
  const [u] = await db
    .insert(users)
    .values({ displayName: 'Sync Admin', email: `u${Math.random()}@acme.io`, globalRole: 'admin' })
    .returning();
  return u!;
}

// ── GET /api/sync/status ─────────────────────────────────────────────────────

describe('GET /api/sync/status', () => {
  it('returns scheduler.alive=false and empty lastRuns when no data exists', async () => {
    const u = await makeUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/status',
      headers: { 'x-dev-user-id': u.id },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      scheduler: { alive: boolean; startedAt: null; heartbeatAt: null };
      lastRuns: unknown[];
    }>();
    expect(body.scheduler.alive).toBe(false);
    expect(body.scheduler.startedAt).toBeNull();
    expect(body.lastRuns).toEqual([]);
  });

  it('reports scheduler.alive=true when heartbeat is fresh', async () => {
    const u = await makeUser();
    // Insert a heartbeat timestamped right now — well within the 5-minute stale window
    await db.insert(syncScheduleState).values({
      schedulerHeartbeatAt: new Date(),
      schedulerStartedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/status',
      headers: { 'x-dev-user-id': u.id },
    });
    const body = res.json<{ scheduler: { alive: boolean } }>();
    expect(body.scheduler.alive).toBe(true);
  });

  it('reports scheduler.alive=false when heartbeat is stale (> 5 min ago)', async () => {
    const u = await makeUser();
    const staleTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
    await db.insert(syncScheduleState).values({
      schedulerHeartbeatAt: staleTime,
      schedulerStartedAt: staleTime,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/status',
      headers: { 'x-dev-user-id': u.id },
    });
    const body = res.json<{ scheduler: { alive: boolean } }>();
    expect(body.scheduler.alive).toBe(false);
  });

  it('returns the last completed run per source+entity (skips running runs)', async () => {
    const u = await makeUser();

    // Insert two completed runs for the same entity — only the latest should appear
    await db.insert(syncRuns).values([
      {
        source: 'toggl',
        entity: 'time_entries',
        status: 'completed',
        scheduleTrigger: 'daily',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        completedAt: new Date('2026-01-01T00:05:00Z'),
        recordCount: 100,
      },
      {
        source: 'toggl',
        entity: 'time_entries',
        status: 'completed',
        scheduleTrigger: 'frequent',
        startedAt: new Date('2026-01-02T00:00:00Z'),
        completedAt: new Date('2026-01-02T00:05:00Z'),
        recordCount: 50,
      },
      // A running run — should NOT appear in lastRuns
      {
        source: 'toggl',
        entity: 'users',
        status: 'running',
        scheduleTrigger: 'manual',
        startedAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/status',
      headers: { 'x-dev-user-id': u.id },
    });
    const body = res.json<{
      lastRuns: Array<{ source: string; entity: string; status: string; recordCount: number | null }>;
    }>();

    // Only the latest completed run for toggl/time_entries
    expect(body.lastRuns).toHaveLength(1);
    expect(body.lastRuns[0]).toMatchObject({
      source: 'toggl',
      entity: 'time_entries',
      status: 'completed',
      recordCount: 50,
    });
  });

  it('includes the scheduler next run timestamps when set', async () => {
    const u = await makeUser();
    const nextFrequent = new Date(Date.now() + 10 * 60 * 1000);
    const nextDaily = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(syncScheduleState).values({
      schedulerHeartbeatAt: new Date(),
      schedulerStartedAt: new Date(),
      nextFrequentRunAt: nextFrequent,
      nextDailyRunAt: nextDaily,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/status',
      headers: { 'x-dev-user-id': u.id },
    });
    const body = res.json<{
      scheduler: { nextFrequentRunAt: string | null; nextDailyRunAt: string | null };
    }>();
    expect(body.scheduler.nextFrequentRunAt).not.toBeNull();
    expect(body.scheduler.nextDailyRunAt).not.toBeNull();
  });
});

// ── GET /api/sync/runs ───────────────────────────────────────────────────────

describe('GET /api/sync/runs', () => {
  it('returns empty list and total=0 when no runs exist', async () => {
    const u = await makeUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/runs',
      headers: { 'x-dev-user-id': u.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ runs: unknown[]; total: number; limit: number; offset: number }>();
    expect(body.runs).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(50); // default
    expect(body.offset).toBe(0); // default
  });

  it('returns all runs ordered by startedAt descending', async () => {
    const u = await makeUser();
    await db.insert(syncRuns).values([
      {
        source: 'toggl',
        entity: 'users',
        status: 'completed',
        scheduleTrigger: 'manual',
        startedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        source: 'toggl',
        entity: 'users',
        status: 'completed',
        scheduleTrigger: 'manual',
        startedAt: new Date('2026-01-03T00:00:00Z'),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/runs',
      headers: { 'x-dev-user-id': u.id },
    });
    const body = res.json<{
      runs: Array<{ startedAt: string }>;
      total: number;
    }>();
    expect(body.total).toBe(2);
    // Newest first
    expect(new Date(body.runs[0]!.startedAt).getTime()).toBeGreaterThan(
      new Date(body.runs[1]!.startedAt).getTime(),
    );
  });

  it('filters by source when ?source= is provided', async () => {
    const u = await makeUser();
    await db.insert(syncRuns).values([
      { source: 'toggl', entity: 'users', status: 'completed', scheduleTrigger: 'manual', startedAt: new Date() },
      { source: 'timetastic', entity: 'absences', status: 'completed', scheduleTrigger: 'manual', startedAt: new Date() },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/runs?source=toggl',
      headers: { 'x-dev-user-id': u.id },
    });
    const body = res.json<{
      runs: Array<{ source: string }>;
      total: number;
    }>();
    expect(body.total).toBe(1);
    expect(body.runs[0]!.source).toBe('toggl');
  });

  it('filters by status when ?status= is provided', async () => {
    const u = await makeUser();
    await db.insert(syncRuns).values([
      { source: 'toggl', entity: 'users', status: 'completed', scheduleTrigger: 'manual', startedAt: new Date() },
      { source: 'toggl', entity: 'users', status: 'failed', scheduleTrigger: 'manual', startedAt: new Date() },
      { source: 'toggl', entity: 'users', status: 'running', scheduleTrigger: 'manual', startedAt: new Date() },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/runs?status=failed',
      headers: { 'x-dev-user-id': u.id },
    });
    const body = res.json<{
      runs: Array<{ status: string }>;
      total: number;
    }>();
    expect(body.total).toBe(1);
    expect(body.runs[0]!.status).toBe('failed');
  });

  it('caps ?limit at 200', async () => {
    const u = await makeUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/runs?limit=999',
      headers: { 'x-dev-user-id': u.id },
    });
    expect(res.json<{ limit: number }>().limit).toBe(200);
  });

  it('supports pagination via ?offset=', async () => {
    const u = await makeUser();
    await db.insert(syncRuns).values([
      { source: 'toggl', entity: 'a', status: 'completed', scheduleTrigger: 'manual', startedAt: new Date('2026-01-01T00:00:00Z') },
      { source: 'toggl', entity: 'b', status: 'completed', scheduleTrigger: 'manual', startedAt: new Date('2026-01-02T00:00:00Z') },
      { source: 'toggl', entity: 'c', status: 'completed', scheduleTrigger: 'manual', startedAt: new Date('2026-01-03T00:00:00Z') },
    ]);

    const page1 = await app.inject({
      method: 'GET',
      url: '/api/sync/runs?limit=2&offset=0',
      headers: { 'x-dev-user-id': u.id },
    });
    const page2 = await app.inject({
      method: 'GET',
      url: '/api/sync/runs?limit=2&offset=2',
      headers: { 'x-dev-user-id': u.id },
    });

    const p1 = page1.json<{ runs: Array<{ entity: string }>; total: number }>();
    const p2 = page2.json<{ runs: Array<{ entity: string }>; total: number }>();

    expect(p1.total).toBe(3);
    expect(p1.runs).toHaveLength(2);
    expect(p2.runs).toHaveLength(1);
    // No overlap between pages
    const p1Entities = p1.runs.map((r) => r.entity);
    const p2Entities = p2.runs.map((r) => r.entity);
    expect(p1Entities.some((e) => p2Entities.includes(e))).toBe(false);
  });
});
