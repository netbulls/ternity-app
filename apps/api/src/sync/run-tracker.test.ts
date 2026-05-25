import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { syncRuns } from '../db/schema.js';
import { completeRun, failRun, startRun } from './run-tracker.js';

// Characterization tests for apps/api/src/sync/run-tracker.ts.
// All three functions (startRun, completeRun, failRun) write to the sync_runs
// table — tested against the live Testcontainers Postgres.

beforeEach(truncateAll);

// ─── helper ───────────────────────────────────────────────────────────────────

const getRunById = (id: string) =>
  db.select().from(syncRuns).where(eq(syncRuns.id, id)).then(([r]) => r ?? null);

// ─── startRun ─────────────────────────────────────────────────────────────────

describe('startRun', () => {
  it('inserts a sync_runs row and returns its id', async () => {
    const run = await startRun('toggl', 'time_entries');
    expect(run).toBeDefined();
    expect(run!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('row has status=running immediately after start', async () => {
    const run = await startRun('toggl', 'clients');
    const row = await getRunById(run!.id);
    expect(row).not.toBeNull();
    expect(row!.status).toBe('running');
  });

  it('stores source and entity correctly', async () => {
    const run = await startRun('timetastic', 'absences');
    const row = await getRunById(run!.id);
    expect(row!.source).toBe('timetastic');
    expect(row!.entity).toBe('absences');
  });

  it('defaults scheduleTrigger to "manual"', async () => {
    const run = await startRun('toggl', 'projects');
    const row = await getRunById(run!.id);
    expect(row!.scheduleTrigger).toBe('manual');
  });

  it('accepts an explicit scheduleTrigger', async () => {
    const frequent = await startRun('toggl', 'projects', 'frequent');
    const daily = await startRun('toggl', 'projects', 'daily');

    expect((await getRunById(frequent!.id))!.scheduleTrigger).toBe('frequent');
    expect((await getRunById(daily!.id))!.scheduleTrigger).toBe('daily');
  });

  it('sets startedAt to now and leaves completedAt null', async () => {
    const before = new Date();
    const run = await startRun('toggl', 'tags');
    const after = new Date();
    const row = await getRunById(run!.id);

    expect(row!.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(row!.startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(row!.completedAt).toBeNull();
  });

  it('optional fields (recordCount, errorMessage) start as null, retryCount=0', async () => {
    const run = await startRun('toggl', 'users');
    const row = await getRunById(run!.id);
    expect(row!.recordCount).toBeNull();
    expect(row!.errorMessage).toBeNull();
    expect(row!.retryCount).toBe(0);
  });

  it('each call creates a distinct row', async () => {
    const a = await startRun('toggl', 'clients');
    const b = await startRun('toggl', 'clients');
    expect(a!.id).not.toBe(b!.id);

    const all = await db.select().from(syncRuns);
    expect(all).toHaveLength(2);
  });
});

// ─── completeRun ──────────────────────────────────────────────────────────────

describe('completeRun', () => {
  it('transitions status from running to completed', async () => {
    const run = await startRun('toggl', 'clients');
    await completeRun(run!.id, 42);
    const row = await getRunById(run!.id);
    expect(row!.status).toBe('completed');
  });

  it('stores the provided recordCount', async () => {
    const run = await startRun('toggl', 'time_entries');
    await completeRun(run!.id, 1234);
    const row = await getRunById(run!.id);
    expect(row!.recordCount).toBe(1234);
  });

  it('accepts recordCount=0 (valid: entity had nothing to sync)', async () => {
    const run = await startRun('toggl', 'tags');
    await completeRun(run!.id, 0);
    const row = await getRunById(run!.id);
    expect(row!.status).toBe('completed');
    expect(row!.recordCount).toBe(0);
  });

  it('defaults retryCount to 0 when not provided', async () => {
    const run = await startRun('toggl', 'clients');
    await completeRun(run!.id, 10);
    const row = await getRunById(run!.id);
    expect(row!.retryCount).toBe(0);
  });

  it('stores provided retryCount', async () => {
    const run = await startRun('toggl', 'clients');
    await completeRun(run!.id, 10, 3);
    const row = await getRunById(run!.id);
    expect(row!.retryCount).toBe(3);
  });

  it('sets completedAt to a recent timestamp', async () => {
    const before = new Date();
    const run = await startRun('toggl', 'projects');
    await completeRun(run!.id, 5);
    const after = new Date();
    const row = await getRunById(run!.id);

    expect(row!.completedAt).not.toBeNull();
    expect(row!.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(row!.completedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('does not set errorMessage on a completed run', async () => {
    const run = await startRun('timetastic', 'absences');
    await completeRun(run!.id, 100);
    const row = await getRunById(run!.id);
    expect(row!.errorMessage).toBeNull();
  });

  it('does not affect other rows', async () => {
    const a = await startRun('toggl', 'clients');
    const b = await startRun('toggl', 'clients');
    await completeRun(a!.id, 7);

    const rowB = await getRunById(b!.id);
    expect(rowB!.status).toBe('running');
    expect(rowB!.completedAt).toBeNull();
  });
});

// ─── failRun ──────────────────────────────────────────────────────────────────

describe('failRun', () => {
  it('transitions status from running to failed', async () => {
    const run = await startRun('toggl', 'projects');
    await failRun(run!.id, 'API timeout');
    const row = await getRunById(run!.id);
    expect(row!.status).toBe('failed');
  });

  it('stores the error message verbatim', async () => {
    const run = await startRun('timetastic', 'users');
    await failRun(run!.id, 'HTTP 502 Bad Gateway from Timetastic API');
    const row = await getRunById(run!.id);
    expect(row!.errorMessage).toBe('HTTP 502 Bad Gateway from Timetastic API');
  });

  it('defaults retryCount to 0 when not provided', async () => {
    const run = await startRun('toggl', 'time_entries');
    await failRun(run!.id, 'timeout');
    const row = await getRunById(run!.id);
    expect(row!.retryCount).toBe(0);
  });

  it('stores provided retryCount', async () => {
    const run = await startRun('toggl', 'time_entries');
    await failRun(run!.id, 'rate limited', 5);
    const row = await getRunById(run!.id);
    expect(row!.retryCount).toBe(5);
  });

  it('sets completedAt to a recent timestamp', async () => {
    const before = new Date();
    const run = await startRun('toggl', 'clients');
    await failRun(run!.id, 'error');
    const after = new Date();
    const row = await getRunById(run!.id);

    expect(row!.completedAt).not.toBeNull();
    expect(row!.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(row!.completedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('does not set recordCount on a failed run', async () => {
    // BUG NOTE: the current implementation of failRun does not set recordCount
    // (stays null). completeRun sets it but failRun has no such parameter.
    // This is consistent with the current behavior — pinned here for characterization.
    const run = await startRun('toggl', 'tags');
    await failRun(run!.id, 'connection refused');
    const row = await getRunById(run!.id);
    expect(row!.recordCount).toBeNull();
  });

  it('stores an empty-string error message (edge case: caller passes "")', async () => {
    // Pinning current behavior: empty string is stored as-is.
    const run = await startRun('toggl', 'users');
    await failRun(run!.id, '');
    const row = await getRunById(run!.id);
    expect(row!.errorMessage).toBe('');
  });

  it('does not affect other rows', async () => {
    const a = await startRun('toggl', 'clients');
    const b = await startRun('toggl', 'clients');
    await failRun(a!.id, 'oops');

    const rowB = await getRunById(b!.id);
    expect(rowB!.status).toBe('running');
    expect(rowB!.errorMessage).toBeNull();
  });
});

// ─── start + complete/fail lifecycle ─────────────────────────────────────────

describe('lifecycle: start → complete / start → fail', () => {
  it('start → complete: full field snapshot', async () => {
    const run = await startRun('toggl', 'clients', 'frequent');
    await completeRun(run!.id, 99, 2);
    const row = await getRunById(run!.id);

    expect(row!.source).toBe('toggl');
    expect(row!.entity).toBe('clients');
    expect(row!.scheduleTrigger).toBe('frequent');
    expect(row!.status).toBe('completed');
    expect(row!.recordCount).toBe(99);
    expect(row!.retryCount).toBe(2);
    expect(row!.errorMessage).toBeNull();
    expect(row!.completedAt).not.toBeNull();
  });

  it('start → fail: full field snapshot', async () => {
    const run = await startRun('timetastic', 'absences', 'daily');
    await failRun(run!.id, 'timeout after 3 retries', 3);
    const row = await getRunById(run!.id);

    expect(row!.source).toBe('timetastic');
    expect(row!.entity).toBe('absences');
    expect(row!.scheduleTrigger).toBe('daily');
    expect(row!.status).toBe('failed');
    expect(row!.recordCount).toBeNull();
    expect(row!.retryCount).toBe(3);
    expect(row!.errorMessage).toBe('timeout after 3 retries');
    expect(row!.completedAt).not.toBeNull();
  });
});
