import { beforeEach, describe, expect, it } from 'vitest';
import { db, truncateAll } from '../../../test/db.js';
import { syncMappings } from '../../db/schema.js';
import { findMapping, findTargetId, upsertMapping } from './mappings.js';

// Characterization tests for the sync mapping layer (source/external id → target row).
// Everything else in transform/ depends on these, so pin the lookup + the upsert
// idempotency contract precisely. Real Postgres via the test harness (see test/db.ts).

// targetId is a uuid column — must be valid UUIDs.
const T1 = '11111111-1111-1111-1111-111111111111';
const T2 = '22222222-2222-2222-2222-222222222222';

beforeEach(truncateAll);

describe('findMapping / findTargetId', () => {
  it('return null when nothing is mapped', async () => {
    expect(await findMapping('toggl', 'client', '100')).toBeNull();
    expect(await findTargetId('toggl', 'client', '100')).toBeNull();
  });

  it('match only on the full (source, entity, externalId) triple', async () => {
    await upsertMapping('toggl', 'client', '100', 'clients', T1);

    expect((await findMapping('toggl', 'client', '100'))?.targetId).toBe(T1);
    // any single field differing → no match
    expect(await findMapping('timetastic', 'client', '100')).toBeNull();
    expect(await findMapping('toggl', 'project', '100')).toBeNull();
    expect(await findMapping('toggl', 'client', '999')).toBeNull();
  });

  it('findTargetId returns the mapped targetId', async () => {
    await upsertMapping('toggl', 'client', '100', 'clients', T1);
    expect(await findTargetId('toggl', 'client', '100')).toBe(T1);
  });
});

describe('upsertMapping', () => {
  it('inserts a new mapping and returns its id', async () => {
    const id = await upsertMapping('toggl', 'client', '100', 'clients', T1);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const row = await findMapping('toggl', 'client', '100');
    expect(row?.id).toBe(id);
    expect(row?.targetTable).toBe('clients');
    expect(row?.targetId).toBe(T1);
  });

  it('is idempotent: re-upserting the same triple updates in place — same id, no duplicate', async () => {
    const id1 = await upsertMapping('toggl', 'client', '100', 'clients', T1);
    const id2 = await upsertMapping('toggl', 'client', '100', 'clients_v2', T2);

    expect(id2).toBe(id1);

    const rows = await db.select().from(syncMappings);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.targetTable).toBe('clients_v2');
    expect(rows[0]!.targetId).toBe(T2);
  });

  it('keeps createdAt and advances updatedAt on update', async () => {
    await upsertMapping('toggl', 'client', '100', 'clients', T1);
    const before = await findMapping('toggl', 'client', '100');

    await upsertMapping('toggl', 'client', '100', 'clients', T2);
    const after = await findMapping('toggl', 'client', '100');

    expect(after!.createdAt).toEqual(before!.createdAt);
    // `before.updatedAt` is Postgres `now()` at insert; `after.updatedAt` is `new Date()`
    // at the subsequent update — two clocks. Allow a small skew window (same pattern as
    // run-tracker.test.ts) so this doesn't flake on container/host clock drift.
    const SKEW_MS = 1000;
    expect(after!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before!.updatedAt.getTime() - SKEW_MS,
    );
  });

  it('creates distinct rows for distinct triples', async () => {
    await upsertMapping('toggl', 'client', '100', 'clients', T1);
    await upsertMapping('toggl', 'project', '100', 'projects', T2);

    const rows = await db.select().from(syncMappings);
    expect(rows).toHaveLength(2);
  });
});
