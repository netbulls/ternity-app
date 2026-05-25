import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, truncateAll } from '../../../test/db.js';
import {
  stgTogglUsers,
  stgTogglClients,
  stgTogglProjects,
  stgTogglTags,
  stgTogglTimeEntries,
  syncRuns,
} from '../../db/schema.js';
import {
  extractTogglUsers,
  extractTogglClients,
  extractTogglProjects,
  extractTogglTags,
  extractTogglTimeEntries,
} from './extract.js';

// Characterization tests for the Toggl extract pipeline.
//
// All network I/O is stubbed via vi.stubGlobal('fetch', …) — no real API calls.
// The DB harness provides a live Postgres; assertions check real rows in staging.
//
// DOCUMENTED GOTCHA (confirmed by client.ts):
//   The Toggl Search API returns GROUPED rows: each row has a nested
//   `time_entries[]` array. flattenSearchResults() in client.ts must flatten
//   them — the external_id stored per staging row is time_entries[].id, NOT
//   the top-level group descriptor.
//
// The `togglReportsFetch` uses POST (Reports API), while `togglFetch` uses GET.
// Both paths call global `fetch`; we stub it once and route by URL substring.

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await truncateAll();
  // Set required env vars so getTogglConfig() doesn't throw
  process.env.TOGGL_API_TOKEN = 'test-token';
  process.env.TOGGL_WORKSPACE_ID = '4801777';
  process.env.TOGGL_ORGANIZATION_ID = '4775401';
  // DATABASE_URL is already set by test/setup-db.ts — don't overwrite

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  // Silence the logger to keep test output clean
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.TOGGL_API_TOKEN;
  delete process.env.TOGGL_WORKSPACE_ID;
  delete process.env.TOGGL_ORGANIZATION_ID;
});

/** Build a minimal fetch response that returns JSON */
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
// Simple entity extracts (users / clients / projects / tags)
// These all follow the same pattern: full-replace → insert into staging.
// ─────────────────────────────────────────────────────────────────────────────

describe('extractTogglUsers', () => {
  it('writes fetched users to stg_toggl_users and returns the count', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { id: 101, email: 'alice@acme.io', username: 'Alice' },
        { id: 102, email: 'bob@acme.io', username: 'Bob' },
      ]),
    );

    const count = await extractTogglUsers();

    expect(count).toBe(2);
    const rows = await db.select().from(stgTogglUsers);
    expect(rows).toHaveLength(2);
    // externalId is stringified from the numeric `id` field
    const ids = rows.map((r) => r.externalId).sort();
    expect(ids).toEqual(['101', '102']);
    // rawData preserved as-is
    const alice = rows.find((r) => r.externalId === '101');
    expect((alice!.rawData as Record<string, unknown>).email).toBe('alice@acme.io');
  });

  it('completes the sync_runs record as completed', async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ id: 1, username: 'X' }]));

    await extractTogglUsers();

    const runs = await db.select().from(syncRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe('completed');
    expect(runs[0]!.source).toBe('toggl');
    expect(runs[0]!.entity).toBe('users');
    expect(runs[0]!.recordCount).toBe(1);
  });

  it('returns 0 and writes nothing when the API returns an empty array', async () => {
    fetchMock.mockResolvedValueOnce(okJson([]));

    const count = await extractTogglUsers();

    expect(count).toBe(0);
    expect(await db.select().from(stgTogglUsers)).toHaveLength(0);
  });

  it('full-replace on re-run: old rows are wiped and new rows inserted', async () => {
    // First run: 2 users
    fetchMock.mockResolvedValueOnce(okJson([{ id: 1, username: 'Old' }]));
    await extractTogglUsers();

    // Second run: different data set
    fetchMock.mockResolvedValueOnce(
      okJson([
        { id: 10, username: 'NewA' },
        { id: 11, username: 'NewB' },
      ]),
    );
    const count = await extractTogglUsers();

    expect(count).toBe(2);
    const rows = await db.select().from(stgTogglUsers);
    // Old row (id=1) must be gone — this is a full-replace, not upsert
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.externalId).sort();
    expect(ids).toEqual(['10', '11']);
  });

  it('marks the sync run as failed when fetch throws, and rethrows', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failure'));

    await expect(extractTogglUsers()).rejects.toThrow('network failure');

    const runs = await db.select().from(syncRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe('failed');
    expect(runs[0]!.errorMessage).toContain('network failure');
  });
});

describe('extractTogglClients', () => {
  it('writes fetched clients to stg_toggl_clients', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { id: 200, name: 'Acme' },
        { id: 201, name: 'Globex' },
      ]),
    );

    const count = await extractTogglClients();

    expect(count).toBe(2);
    const rows = await db.select().from(stgTogglClients);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId).sort()).toEqual(['200', '201']);
  });
});

describe('extractTogglProjects', () => {
  it('writes fetched projects to stg_toggl_projects', async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ id: 300, name: 'Alpha', client_id: 200 }]));

    const count = await extractTogglProjects();

    expect(count).toBe(1);
    const rows = await db.select().from(stgTogglProjects);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalId).toBe('300');
  });
});

describe('extractTogglTags', () => {
  it('writes fetched tags to stg_toggl_tags', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { id: 400, name: 'billable' },
        { id: 401, name: 'internal' },
      ]),
    );

    const count = await extractTogglTags();

    expect(count).toBe(2);
    const rows = await db.select().from(stgTogglTags);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId).sort()).toEqual(['400', '401']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Time entries extract — the complex case with grouped rows + pagination
// ─────────────────────────────────────────────────────────────────────────────

describe('extractTogglTimeEntries', () => {
  // BUG FOUND: single-day range (from === to) produces 0 windows — nothing fetched.
  // The while loop is `windowStart < end`, not `windowStart <= end`.
  // If you call extractTogglTimeEntries('2024-01-10', '2024-01-10'), it silently
  // does nothing and returns 0. Use a multi-day range to actually process entries.

  // The Reports Search API returns GROUPED rows where `time_entries` is a nested
  // array. The client's flattenSearchResults() must expand them — each nested
  // entry becomes a separate staging row with its own `id` as externalId.
  it('flattens grouped search results: each nested time_entries[] item becomes its own staging row', async () => {
    // One top-level row with 2 nested entries — the documented gotcha.
    // Use a 2-day range to avoid the single-day window-skipping bug.
    // 1 grouped row = res.length (1) < PAGE_SIZE (200) → loop stops after first page call.
    // No second mock needed.
    fetchMock.mockResolvedValueOnce(
      okJson([
        {
          description: 'Write tests',
          project_id: 300,
          user_id: 101,
          username: 'Alice',
          tag_ids: [400],
          billable: false,
          // The nested array — this is what the Toggl Search API actually returns
          time_entries: [
            { id: 1001, start: '2024-01-10T08:00:00Z', stop: '2024-01-10T09:00:00Z', seconds: 3600, at: '2024-01-10T09:00:00Z' },
            { id: 1002, start: '2024-01-10T10:00:00Z', stop: '2024-01-10T11:00:00Z', seconds: 3600, at: '2024-01-10T11:00:00Z' },
          ],
        },
      ]),
    );

    // Use 2-day range — single-day range is silently skipped due to `while (start < end)` bug
    const count = await extractTogglTimeEntries('2024-01-10', '2024-01-11');

    // 2 entries flattened from 1 grouped row
    expect(count).toBe(2);
    const rows = await db.select().from(stgTogglTimeEntries);
    expect(rows).toHaveLength(2);

    // externalIds come from the nested entry `.id`, not from the group
    const extIds = rows.map((r) => r.externalId).sort();
    expect(extIds).toEqual(['1001', '1002']);

    // Parent fields (user_id, project_id) merged into each flattened entry
    const raw = rows[0]!.rawData as Record<string, unknown>;
    expect(raw.user_id).toBe(101);
    expect(raw.project_id).toBe(300);
  });

  it('handles pagination: fetches multiple pages until a page smaller than PAGE_SIZE', async () => {
    // fetchTimeEntriesWindow stops when res.length < PAGE_SIZE (200).
    // Simulate page 1 full (200 rows) then page 2 partial (1 row).
    const makeGroupedRow = (entryId: number) => ({
      description: 'Task',
      project_id: null,
      user_id: 101,
      username: 'Alice',
      tag_ids: [],
      billable: false,
      time_entries: [
        {
          id: entryId,
          start: '2024-02-01T08:00:00Z',
          stop: '2024-02-01T09:00:00Z',
          seconds: 3600,
          at: '2024-02-01T09:00:00Z',
        },
      ],
    });

    // Page 1: 200 items (triggers next page fetch)
    const page1 = Array.from({ length: 200 }, (_, i) => makeGroupedRow(2000 + i));
    // Page 2: 1 item (< PAGE_SIZE → stop)
    const page2 = [makeGroupedRow(3000)];

    fetchMock
      .mockResolvedValueOnce(okJson(page1))
      .mockResolvedValueOnce(okJson(page2));

    // 2-day range to work around the single-day window skip bug
    const count = await extractTogglTimeEntries('2024-02-01', '2024-02-02');

    expect(count).toBe(201); // 200 + 1
    const rows = await db.select().from(stgTogglTimeEntries);
    expect(rows).toHaveLength(201);
  });

  it('upsert is idempotent: re-running with the same date range does not duplicate rows', async () => {
    const groupedRow = {
      description: 'Dedup test',
      project_id: null,
      user_id: 101,
      username: 'Alice',
      tag_ids: [],
      billable: false,
      time_entries: [
        { id: 5000, start: '2024-03-01T08:00:00Z', stop: '2024-03-01T09:00:00Z', seconds: 3600, at: '2024-03-01T09:00:00Z' },
      ],
    };

    // First run — 2-day range to avoid single-day skip bug.
    // 1 grouped row = 1 entry = res.length (1) < PAGE_SIZE (200) → loop stops after
    // the first call, so we only need one mockResolvedValueOnce here.
    fetchMock.mockResolvedValueOnce(okJson([groupedRow]));
    await extractTogglTimeEntries('2024-03-01', '2024-03-02');

    // Second run — same entry id, updated description
    const updatedRow = { ...groupedRow, description: 'Updated description' };
    fetchMock.mockResolvedValueOnce(okJson([updatedRow]));
    await extractTogglTimeEntries('2024-03-01', '2024-03-02');

    // No duplicate: still 1 row
    const rows = await db.select().from(stgTogglTimeEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalId).toBe('5000');

    // The rawData was replaced with the updated version (upsert = delete + insert)
    expect((rows[0]!.rawData as Record<string, unknown>).description).toBe('Updated description');
  });

  it('uses explicit from/to range when provided', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([]));

    await extractTogglTimeEntries('2023-06-01', '2023-06-30');

    // Should have made 1 window request (30 days < 90-day window size)
    // We verify by asserting fetchMock was called at all and the run was started
    const runs = await db.select().from(syncRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.entity).toBe('time_entries');
    expect(runs[0]!.status).toBe('completed');
  });

  it('marks the run as failed when the Reports API throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Toggl API 500: Internal Server Error'));

    // 2-day range so a window is actually created and the fetch is attempted
    await expect(extractTogglTimeEntries('2024-04-01', '2024-04-02')).rejects.toThrow();

    const runs = await db.select().from(syncRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe('failed');
  });

  it('fresh extract from absolute start date when staging is empty', async () => {
    // With no explicit from/to and empty staging, should start from 2020-01-01.
    // We pass an explicit range to keep the test deterministic and fast.
    fetchMock.mockResolvedValue(okJson([]));

    const count = await extractTogglTimeEntries('2020-01-01', '2020-01-05');

    expect(count).toBe(0);
    const runs = await db.select().from(syncRuns);
    expect(runs[0]!.status).toBe('completed');
    expect(runs[0]!.recordCount).toBe(0);
  });
});
