import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, truncateAll } from '../../../test/db.js';
import {
  stgTtUsers,
  stgTtDepartments,
  stgTtLeaveTypes,
  stgTtAbsences,
  syncRuns,
} from '../../db/schema.js';
import {
  extractTtUsers,
  extractTtDepartments,
  extractTtLeaveTypes,
  extractTtAbsences,
} from './extract.js';

// Characterization tests for the Timetastic extract pipeline.
//
// All network I/O is stubbed via vi.stubGlobal('fetch', …).
// The DB harness provides a live Postgres; assertions check real staging rows.
//
// DOCUMENTED GOTCHAS (from sync.md and confirmed by client.ts):
//
//   1. The absences endpoint returns an OBJECT, not an array:
//        { holidays: [...], totalRecords: N, nextPageLink: ""|null }
//      The client reads `.holidays` from the response.
//
//   2. Pagination is non-functional — page 2 returns same data as page 1.
//      The client works around this by fetching in 31-day windows and
//      de-duplicating via a Map (keyed on absence id).
//
//   3. nextPageLink is "" (empty string, falsy) even when there's only one page —
//      NOT used for loop control. The window loop controls termination instead.
//
//   4. Half-day absences have deductionDays=0.5 — tracked in rawData as-is.

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await truncateAll();
  process.env.TIMETASTIC_API_TOKEN = 'test-tt-token';
  // DATABASE_URL is already set by test/setup-db.ts

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.TIMETASTIC_API_TOKEN;
});

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null } as unknown as Headers,
    json: async () => data,
    text: async () => '',
  } as unknown as Response;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple entity extracts: users / departments / leave types
// These return plain arrays (unlike absences which returns an object).
// ─────────────────────────────────────────────────────────────────────────────

describe('extractTtUsers', () => {
  it('writes fetched users to stg_tt_users and returns the count', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { id: 10, firstName: 'Elena', lastName: 'Marsh', email: 'elena@acme.io' },
        { id: 11, firstName: 'James', lastName: 'Oakley', email: 'james@acme.io' },
      ]),
    );

    const count = await extractTtUsers();

    expect(count).toBe(2);
    const rows = await db.select().from(stgTtUsers);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId).sort()).toEqual(['10', '11']);

    const elena = rows.find((r) => r.externalId === '10');
    expect((elena!.rawData as Record<string, unknown>).email).toBe('elena@acme.io');
  });

  it('records a completed sync_run', async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ id: 1, firstName: 'X', email: 'x@x.io' }]));

    await extractTtUsers();

    const runs = await db.select().from(syncRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.source).toBe('timetastic');
    expect(runs[0]!.entity).toBe('users');
    expect(runs[0]!.status).toBe('completed');
    expect(runs[0]!.recordCount).toBe(1);
  });

  it('full-replace on re-run: old rows wiped, new rows inserted', async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ id: 1, firstName: 'Old' }]));
    await extractTtUsers();

    fetchMock.mockResolvedValueOnce(
      okJson([{ id: 99, firstName: 'New' }]),
    );
    await extractTtUsers();

    const rows = await db.select().from(stgTtUsers);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalId).toBe('99');
  });

  it('marks the run as failed when fetch throws, and rethrows', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    await expect(extractTtUsers()).rejects.toThrow('network error');

    const runs = await db.select().from(syncRuns);
    expect(runs[0]!.status).toBe('failed');
    expect(runs[0]!.errorMessage).toContain('network error');
  });
});

describe('extractTtDepartments', () => {
  it('writes fetched departments to stg_tt_departments', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { id: 20, name: 'Engineering' },
        { id: 21, name: 'Marketing' },
      ]),
    );

    const count = await extractTtDepartments();

    expect(count).toBe(2);
    const rows = await db.select().from(stgTtDepartments);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId).sort()).toEqual(['20', '21']);
  });
});

describe('extractTtLeaveTypes', () => {
  it('writes fetched leave types to stg_tt_leave_types', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { id: 30, name: 'Annual Leave', color: '#00D4AA' },
        { id: 31, name: 'Sick Leave', color: '#FF0000' },
      ]),
    );

    const count = await extractTtLeaveTypes();

    expect(count).toBe(2);
    const rows = await db.select().from(stgTtLeaveTypes);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId).sort()).toEqual(['30', '31']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Absences extract — the complex case with the documented gotchas
// ─────────────────────────────────────────────────────────────────────────────

describe('extractTtAbsences', () => {
  // GOTCHA #1: response is an OBJECT, not an array — must read `.holidays`
  it('reads the .holidays field from the response object (not the object itself)', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        // This is the actual shape Timetastic returns
        holidays: [
          { id: 100, userId: 10, startDate: '2024-01-15', deductionDays: 1 },
          { id: 101, userId: 11, startDate: '2024-01-16', deductionDays: 0.5 },
        ],
        totalRecords: 2,
        nextPageLink: '', // GOTCHA #3: empty string, not null
      }),
    );

    const count = await extractTtAbsences('2024-01-01', '2024-01-31');

    expect(count).toBe(2);
    const rows = await db.select().from(stgTtAbsences);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId).sort()).toEqual(['100', '101']);
  });

  // GOTCHA #3: nextPageLink="" (falsy) must NOT be used to trigger further fetches.
  // Termination is controlled by the 31-day window loop, not nextPageLink.
  it('does not make extra fetches when nextPageLink is empty string (falsy)', async () => {
    // Single window (2024-01-01 → 2024-01-31): exactly 1 API call expected
    fetchMock.mockResolvedValueOnce(
      okJson({
        holidays: [{ id: 200, userId: 10, startDate: '2024-01-05', deductionDays: 1 }],
        totalRecords: 1,
        nextPageLink: '', // The documented falsy-trap
      }),
    );

    await extractTtAbsences('2024-01-01', '2024-01-31');

    // Only 1 fetch call for the single 31-day window
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // GOTCHA #2: pagination is non-functional; the client fetches in 31-day windows
  // and deduplicates across windows using a Map keyed on absence id.
  it('deduplicates absences that appear in overlapping windows (Map keyed on id)', async () => {
    // Simulate two 31-day windows (2024-01-01→31, 2024-02-01→28) each returning
    // the same absence id (e.g. a multi-day absence spanning the window boundary)
    const sharedAbsence = { id: 300, userId: 10, startDate: '2024-01-28', deductionDays: 5 };

    fetchMock
      .mockResolvedValueOnce(
        okJson({ holidays: [sharedAbsence], totalRecords: 1, nextPageLink: '' }),
      )
      .mockResolvedValueOnce(
        okJson({ holidays: [sharedAbsence], totalRecords: 1, nextPageLink: '' }),
      );

    const count = await extractTtAbsences('2024-01-01', '2024-02-28');

    // The Map deduplication in client.ts means only 1 unique absence stored
    expect(count).toBe(1);
    const rows = await db.select().from(stgTtAbsences);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalId).toBe('300');
  });

  // GOTCHA (half-day): deductionDays can be 0.5 — stored as-is in rawData
  it('preserves half-day absence (deductionDays=0.5) in rawData', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        holidays: [{ id: 400, userId: 10, startDate: '2024-03-15', deductionDays: 0.5 }],
        totalRecords: 1,
        nextPageLink: '',
      }),
    );

    await extractTtAbsences('2024-03-01', '2024-03-31');

    const rows = await db.select().from(stgTtAbsences);
    expect(rows).toHaveLength(1);
    const raw = rows[0]!.rawData as Record<string, unknown>;
    expect(raw.deductionDays).toBe(0.5);
  });

  it('full-replace on re-run: old absence rows wiped, new rows inserted', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ holidays: [{ id: 500, userId: 10, deductionDays: 1 }], totalRecords: 1, nextPageLink: '' }),
    );
    await extractTtAbsences('2024-04-01', '2024-04-30');

    // Second run (different date range) — entity-level delete clears ALL stg_tt_absences
    fetchMock.mockResolvedValueOnce(
      okJson({ holidays: [{ id: 600, userId: 11, deductionDays: 1 }], totalRecords: 1, nextPageLink: '' }),
    );
    await extractTtAbsences('2024-05-01', '2024-05-31');

    const rows = await db.select().from(stgTtAbsences);
    // Full replace: only the new run's rows survive
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalId).toBe('600');
  });

  it('marks the run as failed when fetch throws, and rethrows', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Timetastic API 500: error'));

    await expect(extractTtAbsences('2024-06-01', '2024-06-30')).rejects.toThrow();

    const runs = await db.select().from(syncRuns);
    expect(runs[0]!.status).toBe('failed');
  });

  it('handles an empty holidays array without errors', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ holidays: [], totalRecords: 0, nextPageLink: '' }),
    );

    const count = await extractTtAbsences('2024-07-01', '2024-07-31');

    expect(count).toBe(0);
    expect(await db.select().from(stgTtAbsences)).toHaveLength(0);
    const runs = await db.select().from(syncRuns);
    expect(runs[0]!.status).toBe('completed');
    expect(runs[0]!.recordCount).toBe(0);
  });

  it('fetches multiple 31-day windows for a multi-month range', async () => {
    // 2024-01-01 → 2024-03-31 spans ~90 days → 3 windows (Jan, Feb, Mar)
    fetchMock.mockResolvedValue(
      okJson({ holidays: [], totalRecords: 0, nextPageLink: '' }),
    );

    await extractTtAbsences('2024-01-01', '2024-03-31');

    // The 31-day window loop should make 3 fetch calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
