import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Characterization tests for apps/api/src/sync/toggl/client.ts
//
// Key behaviors pinned:
//  - togglFetch: basic GET with Basic auth header (token:api_token)
//  - togglFetch: HTTP 402 (not 429!) is in RETRYABLE_STATUSES — throws TogglApiError
//  - togglFetch: non-retryable errors (e.g. 404) are thrown immediately without retry
//  - togglReportsFetch: POST with correct workspace URL and JSON body
//  - fetchTimeEntriesWindow: flattens grouped search rows (time_entries[] nested per row)
//  - fetchTimeEntriesWindow: paginates via first_row_number when page is full (200 rows)
//  - fetchTimeEntriesWindow: stops when page count < 200 (no terminator needed)
//  - fetchTogglTimeEntries: chunks into 365-day windows (364-day step internally)
//  - parseRateLimitWait: body parsing "reset in N seconds", Retry-After header fallback, cap at 3600
//
// Rate-limit retry tests: withRetry uses real setTimeout internally. Since we don't
// want to wait minutes, we mock withRetry at the module level for those tests, and
// test parseRateLimitWait behavior via direct 402 errors on a patched single-attempt path.
//
// Module-level `lastRequestAt` state means we vi.resetModules() per describe block
// to avoid cross-test MIN_REQUEST_GAP_MS cross-contamination.

// Silence the logger
vi.spyOn(console, 'log').mockReturnValue(undefined);
vi.spyOn(console, 'warn').mockReturnValue(undefined);

// `vi.mock` is hoisted regardless of where it appears, so a call in `beforeEach`
// looks scoped but applies globally for the file. Vitest 4 will start erroring on
// the misleading placement — keep it at the top so the actual order is honest.
vi.mock('./../../sync/retry-with-backoff.js', () => ({
  withRetry: async (fn: () => Promise<unknown>) => fn(),
}));

const WORKSPACE_ID = '4801777';
const ORG_ID = '4775401';
const API_TOKEN = 'test-token-abc';

function setEnv() {
  process.env.TOGGL_API_TOKEN = API_TOKEN;
  process.env.TOGGL_WORKSPACE_ID = WORKSPACE_ID;
  process.env.TOGGL_ORGANIZATION_ID = ORG_ID;
  process.env.DATABASE_URL = 'postgres://localhost/test';
}

function clearEnv() {
  delete process.env.TOGGL_API_TOKEN;
  delete process.env.TOGGL_WORKSPACE_ID;
  delete process.env.TOGGL_ORGANIZATION_ID;
  delete process.env.DATABASE_URL;
}

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
  };
}

function errResponse(status: number, body: string, extraHeaders: Record<string, string> = {}) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
    headers: new Headers(extraHeaders),
  };
}

/** Build a grouped Toggl search row (the actual API shape — time_entries[] is nested) */
function makeSearchRow(
  overrides: Partial<{
    description: string;
    project_id: number | null;
    user_id: number;
    username: string;
    tag_ids: number[];
    billable: boolean;
    entries: Array<{ id: number; start: string; stop: string; seconds: number; at: string }>;
  }> = {},
) {
  return {
    description: overrides.description ?? 'Stand-up',
    project_id: overrides.project_id ?? 42,
    user_id: overrides.user_id ?? 1001,
    username: overrides.username ?? 'Elena Marsh',
    tag_ids: overrides.tag_ids ?? [10, 20],
    billable: overrides.billable ?? false,
    time_entries: overrides.entries ?? [
      { id: 9001, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T09:30:00Z', seconds: 1800, at: '2024-01-01T09:30:00Z' },
    ],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// togglFetch — basic HTTP and auth behavior
// ──────────────────────────────────────────────────────────────────────────────

describe('togglFetch — basic HTTP', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
  });

  it('issues a GET to the v9 API with Basic auth (token:api_token)', async () => {
    const { togglFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([{ id: 1 }]));

    const result = await togglFetch('/workspaces/4801777/users');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.track.toggl.com/api/v9/workspaces/4801777/users');
    expect(opts.method).toBeUndefined(); // GET (no explicit method)
    const expectedAuth = 'Basic ' + Buffer.from(`${API_TOKEN}:api_token`).toString('base64');
    expect((opts.headers as Record<string, string>).Authorization).toBe(expectedAuth);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('returns parsed JSON on a successful response', async () => {
    const { togglFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson({ workspace_id: 42, name: 'Acme' }));

    const result = await togglFetch<{ workspace_id: number; name: string }>('/workspaces/42');
    expect(result).toEqual({ workspace_id: 42, name: 'Acme' });
  });

  it('throws immediately (non-retryable) on a 404 — only 1 fetch call', async () => {
    const { togglFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(errResponse(404, 'not found'));

    // 404 is NOT in RETRYABLE_STATUSES — thrown immediately
    await expect(togglFetch('/bad-path')).rejects.toMatchObject({
      name: 'TogglApiError',
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws TogglApiError with the HTTP status embedded in the message', async () => {
    const { togglFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(errResponse(403, 'forbidden'));

    await expect(togglFetch('/forbidden')).rejects.toThrow('403');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Rate-limit behavior — 402 is Toggl's special rate-limit status (not 429)
// We test this via togglReportsFetch with withRetry mocked to no-wait
// ──────────────────────────────────────────────────────────────────────────────

describe('togglFetch — rate-limit (402) and Retry-After header', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    // `vi.mock('../../sync/retry-with-backoff.js')` is at the top of the file —
    // hoisted, applies to all tests in this file. withRetry runs fn() once, no
    // delay; lets us inspect the TogglApiError without waiting minutes.
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    clearEnv();
  });

  it('402 is Toggl rate-limit status — throws TogglApiError with status=402', async () => {
    const { togglFetch } = await import('./client.js');
    // Toggl uses 402 (not 429) for rate limiting
    fetchMock.mockResolvedValueOnce(errResponse(402, 'Your quota will reset in 120 seconds'));

    await expect(togglFetch('/workspaces/4801777/clients')).rejects.toMatchObject({
      name: 'TogglApiError',
      status: 402,
    });
  });

  it('parses "reset in N seconds" from response body → rateLimitWaitSecs = N + 10', async () => {
    const { togglFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(errResponse(402, 'Your quota will reset in 300 seconds'));

    const err = await togglFetch('/workspaces/4801777/clients').catch((e) => e) as Record<string, unknown>;
    // 300 + 10 = 310
    expect(err).toMatchObject({ status: 402, rateLimitWaitSecs: 310 });
  });

  it('caps rateLimitWaitSecs at MAX_RATE_LIMIT_WAIT_SECS (3600)', async () => {
    const { togglFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(errResponse(402, 'Your quota will reset in 9999 seconds'));

    const err = await togglFetch('/workspaces/4801777/clients').catch((e) => e) as Record<string, unknown>;
    expect(err.rateLimitWaitSecs).toBe(3600);
  });

  it('falls back to Retry-After header when body has no "reset in" message', async () => {
    const { togglFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(errResponse(429, 'too many requests', { 'retry-after': '60' }));

    const err = await togglFetch('/workspaces/4801777/clients').catch((e) => e) as Record<string, unknown>;
    expect(err).toMatchObject({ status: 429, rateLimitWaitSecs: 60 });
  });

  it('rateLimitWaitSecs is undefined when there is no body match and no Retry-After header', async () => {
    const { togglFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(errResponse(500, 'internal server error'));

    const err = await togglFetch('/workspaces/4801777/clients').catch((e) => e) as Record<string, unknown>;
    expect(err).toMatchObject({ status: 500 });
    expect(err.rateLimitWaitSecs).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// togglReportsFetch — POST to Reports API
// ──────────────────────────────────────────────────────────────────────────────

describe('togglReportsFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
  });

  it('issues a POST to /reports/api/v3/workspace/{id}{path} with JSON body and auth', async () => {
    const { togglReportsFetch } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([]));

    const reqBody = { start_date: '2024-01-01', end_date: '2024-01-31', page_size: 200 };
    await togglReportsFetch('/search/time_entries', reqBody);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.track.toggl.com/reports/api/v3/workspace/${WORKSPACE_ID}/search/time_entries`,
    );
    expect(opts.method).toBe('POST');
    const headers = opts.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    const expectedAuth = 'Basic ' + Buffer.from(`${API_TOKEN}:api_token`).toString('base64');
    expect(headers.Authorization).toBe(expectedAuth);
    expect(JSON.parse(opts.body as string)).toEqual(reqBody);
  });

  it('returns the parsed JSON on success', async () => {
    const { togglReportsFetch } = await import('./client.js');
    const payload = [makeSearchRow()];
    fetchMock.mockResolvedValueOnce(okJson(payload));

    const result = await togglReportsFetch('/search/time_entries', {});
    expect(result).toEqual(payload);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// fetchTimeEntriesWindow — grouped row flattening
// ──────────────────────────────────────────────────────────────────────────────

describe('fetchTimeEntriesWindow — flattening grouped search results', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
  });

  it('flattens a single grouped row with one time_entry into one flat record', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    const row = makeSearchRow({
      description: 'Code review',
      project_id: 99,
      user_id: 55,
      username: 'Alex Morgan',
      tag_ids: [10, 20],
      billable: true,
      entries: [
        { id: 7001, start: '2024-03-01T10:00:00Z', stop: '2024-03-01T11:00:00Z', seconds: 3600, at: '2024-03-01T11:00:00Z' },
      ],
    });
    // Single page with 1 row (< 200) → no second fetch
    fetchMock.mockResolvedValueOnce(okJson([row]));

    const entries = await fetchTimeEntriesWindow('2024-03-01', '2024-03-31');

    expect(entries).toHaveLength(1);
    const e = entries[0]!;
    // Parent fields merged in
    expect(e.description).toBe('Code review');
    expect(e.project_id).toBe(99);
    expect(e.user_id).toBe(55);
    expect(e.tag_ids).toEqual([10, 20]);
    expect(e.billable).toBe(true);
    // time_entries fields hoisted to top level with remapping
    expect(e.id).toBe(7001);
    expect(e.start).toBe('2024-03-01T10:00:00Z');
    expect(e.stop).toBe('2024-03-01T11:00:00Z');
    expect(e.seconds).toBe(3600);
    expect(e.entry_at).toBe('2024-03-01T11:00:00Z'); // `at` field → `entry_at`
    // time_entries array itself is NOT present in the flat record
    expect((e as Record<string, unknown>).time_entries).toBeUndefined();
  });

  it('flattens a grouped row with multiple time_entries into multiple flat records', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    const row = makeSearchRow({
      description: 'Multi-entry',
      entries: [
        { id: 8001, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T09:30:00Z', seconds: 1800, at: '2024-01-01T09:30:00Z' },
        { id: 8002, start: '2024-01-01T10:00:00Z', stop: '2024-01-01T10:45:00Z', seconds: 2700, at: '2024-01-01T10:45:00Z' },
      ],
    });
    fetchMock.mockResolvedValueOnce(okJson([row]));

    const entries = await fetchTimeEntriesWindow('2024-01-01', '2024-01-31');

    // One grouped row with 2 time_entries → 2 flat entries
    expect(entries).toHaveLength(2);
    expect(entries[0]!.id).toBe(8001);
    expect(entries[1]!.id).toBe(8002);
    // Both inherit parent description
    expect(entries[0]!.description).toBe('Multi-entry');
    expect(entries[1]!.description).toBe('Multi-entry');
  });

  it('flattens multiple grouped rows, each with their own entries', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    const row1 = makeSearchRow({ description: 'Task A', entries: [
      { id: 1, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T10:00:00Z', seconds: 3600, at: '2024-01-01T10:00:00Z' },
    ]});
    const row2 = makeSearchRow({ description: 'Task B', entries: [
      { id: 2, start: '2024-01-01T11:00:00Z', stop: '2024-01-01T12:00:00Z', seconds: 3600, at: '2024-01-01T12:00:00Z' },
      { id: 3, start: '2024-01-01T13:00:00Z', stop: '2024-01-01T14:00:00Z', seconds: 3600, at: '2024-01-01T14:00:00Z' },
    ]});
    // 2 rows < 200 → single page
    fetchMock.mockResolvedValueOnce(okJson([row1, row2]));

    const entries = await fetchTimeEntriesWindow('2024-01-01', '2024-01-31');

    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(entries[0]!.description).toBe('Task A');
    expect(entries[1]!.description).toBe('Task B');
    expect(entries[2]!.description).toBe('Task B');
  });

  it('tag_ids are numeric ids (not resolved to tag names) — passthrough as-is', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    const row = makeSearchRow({ tag_ids: [101, 202, 303] });
    fetchMock.mockResolvedValueOnce(okJson([row]));

    const entries = await fetchTimeEntriesWindow('2024-01-01', '2024-01-31');
    // Tags are numeric IDs from the API — not resolved to names by the client layer
    expect(entries[0]!.tag_ids).toEqual([101, 202, 303]);
  });

  it('handles rows with null project_id', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    // Manually construct a row with null project_id (overrides.project_id default is 42)
    const row = {
      description: 'No project',
      project_id: null,
      user_id: 1001,
      username: 'Elena Marsh',
      tag_ids: [],
      billable: false,
      time_entries: [
        { id: 5001, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T10:00:00Z', seconds: 3600, at: '2024-01-01T10:00:00Z' },
      ],
    };
    fetchMock.mockResolvedValueOnce(okJson([row]));

    const entries = await fetchTimeEntriesWindow('2024-01-01', '2024-01-31');
    expect(entries[0]!.project_id).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// fetchTimeEntriesWindow — pagination via first_row_number
// ──────────────────────────────────────────────────────────────────────────────

describe('fetchTimeEntriesWindow — pagination', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
  });

  it('stops after first page when it returns fewer than 200 rows (no second fetch)', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    // 3 rows < page size 200 → code breaks because res.length < PAGE_SIZE
    const rows = Array.from({ length: 3 }, (_, i) =>
      makeSearchRow({ description: `entry-${i}`, entries: [
        { id: i + 1, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T10:00:00Z', seconds: 3600, at: '2024-01-01T10:00:00Z' },
      ]}),
    );
    fetchMock.mockResolvedValueOnce(okJson(rows));

    const entries = await fetchTimeEntriesWindow('2024-01-01', '2024-01-31');
    expect(entries).toHaveLength(3);
    // Only 1 fetch — the code breaks on res.length < PAGE_SIZE, no terminator needed
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses first_row_number for the second fetch when a full page (200 rows) is returned', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    const PAGE_SIZE = 200;

    // Page 1: exactly 200 rows → triggers page 2 (first_row_number = 201)
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeSearchRow({ description: `p1-entry-${i}`, entries: [
        { id: i + 1, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T10:00:00Z', seconds: 3600, at: '2024-01-01T10:00:00Z' },
      ]}),
    );
    // Page 2: 5 rows → stop
    const page2 = Array.from({ length: 5 }, (_, i) =>
      makeSearchRow({ description: `p2-entry-${i}`, entries: [
        { id: PAGE_SIZE + i + 1, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T10:00:00Z', seconds: 3600, at: '2024-01-01T10:00:00Z' },
      ]}),
    );
    fetchMock.mockResolvedValueOnce(okJson(page1));
    fetchMock.mockResolvedValueOnce(okJson(page2));

    const entries = await fetchTimeEntriesWindow('2024-01-01', '2024-01-31');
    expect(entries).toHaveLength(PAGE_SIZE + 5);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second call must include first_row_number = PAGE_SIZE + 1 = 201
    const [, opts2] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body2 = JSON.parse(opts2.body as string) as Record<string, unknown>;
    expect(body2.first_row_number).toBe(PAGE_SIZE + 1);
    expect(body2.page_size).toBe(PAGE_SIZE);
  });

  it('stops immediately when the first page is empty', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([]));

    const entries = await fetchTimeEntriesWindow('2024-01-01', '2024-01-31');
    expect(entries).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('first page request has no first_row_number in the body', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([]));

    await fetchTimeEntriesWindow('2024-01-01', '2024-01-31');

    const [, opts1] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body1 = JSON.parse(opts1.body as string) as Record<string, unknown>;
    expect(body1.first_row_number).toBeUndefined();
    expect(body1.start_date).toBe('2024-01-01');
    expect(body1.end_date).toBe('2024-01-31');
    expect(body1.page_size).toBe(200);
  });

  it('invokes the onPage callback with each flattened page', async () => {
    const { fetchTimeEntriesWindow } = await import('./client.js');
    const row = makeSearchRow({ entries: [
      { id: 42, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T10:00:00Z', seconds: 3600, at: '2024-01-01T10:00:00Z' },
    ]});
    fetchMock.mockResolvedValueOnce(okJson([row]));

    const pages: Record<string, unknown>[][] = [];
    await fetchTimeEntriesWindow('2024-01-01', '2024-01-31', async (entries) => {
      pages.push(entries);
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]![0]!.id).toBe(42);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// fetchTogglTimeEntries — yearly window chunking (364-day steps)
// ──────────────────────────────────────────────────────────────────────────────

describe('fetchTogglTimeEntries — yearly window chunking', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
  });

  it('makes a single window fetch for a range shorter than 365 days', async () => {
    const { fetchTogglTimeEntries } = await import('./client.js');
    const row = makeSearchRow({ entries: [
      { id: 1, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T10:00:00Z', seconds: 3600, at: '2024-01-01T10:00:00Z' },
    ]});
    // Single page with 1 row → stops immediately (< 200 rows)
    fetchMock.mockResolvedValueOnce(okJson([row]));

    const result = await fetchTogglTimeEntries('2024-01-01', '2024-06-30');
    expect(result).toHaveLength(1);
    // 1 row < 200 page size → single fetch, no paginator
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('first window uses start_date as-is and clamps end_date to min(start+364, range_end)', async () => {
    const { fetchTogglTimeEntries } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([])); // empty → stop

    await fetchTogglTimeEntries('2024-01-01', '2024-06-30');

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    // Range is shorter than 364 days so the window end = range end
    expect(body.start_date).toBe('2024-01-01');
    expect(body.end_date).toBe('2024-06-30');
  });

  it('uses 364-day steps: a 2-year range makes 2 windows with the correct start_dates', async () => {
    const { fetchTogglTimeEntries } = await import('./client.js');
    // Window 1: one entry (< 200 → single page)
    // Window 2: one entry (< 200 → single page)
    fetchMock
      .mockResolvedValueOnce(okJson([makeSearchRow({ entries: [{ id: 1, start: '2024-01-01T09:00:00Z', stop: '2024-01-01T10:00:00Z', seconds: 3600, at: '2024-01-01T10:00:00Z' }] })]))
      .mockResolvedValueOnce(okJson([makeSearchRow({ entries: [{ id: 2, start: '2025-01-01T09:00:00Z', stop: '2025-01-01T10:00:00Z', seconds: 3600, at: '2025-01-01T10:00:00Z' }] })]));

    const result = await fetchTogglTimeEntries('2024-01-01', '2025-12-31');
    expect(result).toHaveLength(2);
    // 2 windows × 1 fetch each (both have < 200 rows) = 2 total
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // First window: 2024-01-01 to 2024-12-30 (start + 364 days)
    const body1 = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
    expect(body1.start_date).toBe('2024-01-01');
    expect(body1.end_date).toBe('2024-12-30'); // +364 days from 2024-01-01

    // Second window starts from 2024-12-31 (day after window 1's end)
    const body2 = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
    expect(body2.start_date).toBe('2024-12-31');
    // window end = 2024-12-31 + 364 days = 2025-12-30, which is < 2025-12-31 so NOT capped
    expect(body2.end_date).toBe('2025-12-30');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Convenience fetch functions — fetchTogglUsers, Clients, Projects, Tags
// ──────────────────────────────────────────────────────────────────────────────

describe('fetchTogglUsers, fetchTogglClients, fetchTogglProjects, fetchTogglTags', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
  });

  it('fetchTogglUsers GETs /workspaces/{id}/users', async () => {
    const { fetchTogglUsers } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([{ id: 1001 }]));

    const result = await fetchTogglUsers();
    expect(result).toEqual([{ id: 1001 }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(`/workspaces/${WORKSPACE_ID}/users`);
  });

  it('fetchTogglClients GETs /workspaces/{id}/clients', async () => {
    const { fetchTogglClients } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([{ id: 2001, name: 'Acme' }]));

    const result = await fetchTogglClients();
    expect(result).toEqual([{ id: 2001, name: 'Acme' }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(`/workspaces/${WORKSPACE_ID}/clients`);
  });

  it('fetchTogglProjects GETs /workspaces/{id}/projects', async () => {
    const { fetchTogglProjects } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([{ id: 3001 }]));

    await fetchTogglProjects();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(`/workspaces/${WORKSPACE_ID}/projects`);
  });

  it('fetchTogglTags GETs /workspaces/{id}/tags', async () => {
    const { fetchTogglTags } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([{ id: 101, name: 'billing' }]));

    const result = await fetchTogglTags();
    expect(result).toEqual([{ id: 101, name: 'billing' }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(`/workspaces/${WORKSPACE_ID}/tags`);
  });
});
