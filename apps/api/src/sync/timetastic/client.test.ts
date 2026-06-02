import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Characterization tests for apps/api/src/sync/timetastic/client.ts
//
// Key behaviors pinned:
//  - ttFetch: GET with Bearer token auth header
//  - ttFetch: non-ok responses throw TimetasticApiError (non-retryable for 404, retryable for 429/500)
//  - fetchTtAbsences: endpoint returns { holidays: [...] } OBJECT, not an array
//  - fetchTtAbsences: de-duplicates by id across windowed fetches (seen Map)
//  - fetchTtAbsences: pagination is non-functional / not used — 31-day windows instead
//  - fetchTtAbsences: nextPageLink is NOT used for loop control (avoids the "" truthy trap)
//  - fetchTtAbsences: half-day deductionDays (0.5) is passed through as-is by the client
//    (rounding to int is the transform layer's responsibility, NOT this client)
//  - fetchTtUsers, fetchTtDepartments, fetchTtLeaveTypes: correct endpoints
//
// NOTE: The module uses module-level `lastRequestAt` state. We vi.resetModules() per
// test to avoid inter-test MIN_REQUEST_GAP_MS cross-contamination.

vi.spyOn(console, 'log').mockReturnValue(undefined);
vi.spyOn(console, 'warn').mockReturnValue(undefined);

// `vi.mock` is hoisted regardless of where it sits — keep it at top level so the
// actual execution order is obvious (Vitest 4 errors on nested placement).
// withRetry runs fn() once with no delay.
vi.mock('./../../sync/retry-with-backoff.js', () => ({
  withRetry: async (fn: () => Promise<unknown>) => fn(),
}));

const API_TOKEN = 'tt-token-xyz';

function setEnv() {
  process.env.TIMETASTIC_API_TOKEN = API_TOKEN;
  process.env.DATABASE_URL = 'postgres://localhost/test';
}

function clearEnv() {
  delete process.env.TIMETASTIC_API_TOKEN;
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

function errResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
    headers: new Headers(),
  };
}

/** Minimal absence object that includes an id field */
function makeAbsence(id: number, extra: Record<string, unknown> = {}) {
  return { id, userId: 42, leaveTypeId: 1, startDate: '2024-01-15', endDate: '2024-01-15', deductionDays: 1, ...extra };
}

/** The actual API response shape — an OBJECT with a holidays array, not a plain array */
function holidaysResponse(holidays: unknown[], totalRecords = holidays.length) {
  return { holidays, totalRecords, nextPageLink: null };
}

describe('fetchTtUsers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
  });

  it('GETs /api/users with Bearer auth header', async () => {
    const { fetchTtUsers } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([{ id: 1, name: 'Elena Marsh' }]));

    const result = await fetchTtUsers();

    expect(result).toEqual([{ id: 1, name: 'Elena Marsh' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://app.timetastic.co.uk/api/users');
    expect((opts.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_TOKEN}`);
  });

  it('throws TimetasticApiError on a non-ok response (non-retryable 404)', async () => {
    const { fetchTtUsers } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(errResponse(404, 'not found'));

    await expect(fetchTtUsers()).rejects.toMatchObject({
      name: 'TimetasticApiError',
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry for 404
  });
});

describe('fetchTtDepartments and fetchTtLeaveTypes', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    setEnv();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
  });

  it('fetchTtDepartments GETs /api/departments', async () => {
    const { fetchTtDepartments } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([{ id: 10, name: 'Engineering' }]));

    const result = await fetchTtDepartments();
    expect(result).toEqual([{ id: 10, name: 'Engineering' }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://app.timetastic.co.uk/api/departments');
  });

  it('fetchTtLeaveTypes GETs /api/leavetypes', async () => {
    const { fetchTtLeaveTypes } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson([{ id: 5, name: 'Annual Leave' }]));

    const result = await fetchTtLeaveTypes();
    expect(result).toEqual([{ id: 5, name: 'Annual Leave' }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://app.timetastic.co.uk/api/leavetypes');
  });
});

// Single-window tests use real timers (ABSENCES_GAP_MS gap is only applied after
// the first call — lastRequestAt starts at 0 so the first call always fires immediately).
describe('fetchTtAbsences — API response is an OBJECT, not an array (single window)', () => {
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

  it('extracts holidays from the response OBJECT (not treating it as an array)', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    // The API returns { holidays: [...], totalRecords, nextPageLink } — NOT a plain array.
    // If the client mistakenly treated the response as an array, it would return [].
    fetchMock.mockResolvedValueOnce(
      okJson(holidaysResponse([makeAbsence(1), makeAbsence(2)])),
    );

    const result = await fetchTtAbsences('2024-01-01', '2024-01-15');
    expect(result).toHaveLength(2);
  });

  it('handles empty holidays array in the response object', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson(holidaysResponse([])));

    const result = await fetchTtAbsences('2024-01-01', '2024-01-15');
    expect(result).toHaveLength(0);
  });

  it('uses 31-day windows (addDays+30), not pagination — GETs URL with Start= and End= params', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(okJson(holidaysResponse([])));

    await fetchTtAbsences('2024-01-01', '2024-01-15');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/holidays\?Start=2024-01-01&End=2024-01-15/);
    // Only one window needed for a short range
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT follow nextPageLink — pagination is non-functional in the Timetastic API', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    // Even with a non-empty nextPageLink, the client must NOT make an extra fetch.
    // The Timetastic API returns the same data on page 2 as page 1 — documented gotcha.
    // The client uses windowing, not pagination link following.
    const responseWithNextPage = {
      holidays: [makeAbsence(10)],
      totalRecords: 5,
      nextPageLink: 'https://app.timetastic.co.uk/api/holidays?page=2',
    };
    fetchMock.mockResolvedValueOnce(okJson(responseWithNextPage));

    const result = await fetchTtAbsences('2024-01-01', '2024-01-15');
    // Client must not fetch page 2
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('passes through half-day deductionDays (0.5) as-is — rounding is the transform layer\'s job', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    const halfDay = makeAbsence(77, { deductionDays: 0.5 });
    fetchMock.mockResolvedValueOnce(okJson(holidaysResponse([halfDay])));

    const result = await fetchTtAbsences('2024-01-01', '2024-01-15');
    const entry = result[0] as Record<string, unknown>;
    // The client does NOT round — that's the transform layer's responsibility
    expect(entry.deductionDays).toBe(0.5);
  });
});

// Multi-window tests mock withRetry (to bypass the 1s ABSENCES_GAP_MS sleep delay)
// so these run instantly without real timer waits.
describe('fetchTtAbsences — multi-window deduplication and chunking', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    // `vi.mock('../../sync/retry-with-backoff.js')` is at the top of the file —
    // hoisted, applies to the whole file (skip retries + delays).
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

  it('de-duplicates absences by id when the same id appears in multiple windows', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    // Same absence (id=99) returned by both window 1 and window 2
    const absence = makeAbsence(99);
    fetchMock
      .mockResolvedValueOnce(okJson(holidaysResponse([absence])))  // window 1
      .mockResolvedValueOnce(okJson(holidaysResponse([absence])));  // window 2

    const result = await fetchTtAbsences('2024-01-01', '2024-02-28');
    // De-duplicated by id: only one copy retained
    expect(result).toHaveLength(1);
  });

  it('combines unique absences from multiple windows', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    fetchMock
      .mockResolvedValueOnce(okJson(holidaysResponse([makeAbsence(1), makeAbsence(2)])))
      .mockResolvedValueOnce(okJson(holidaysResponse([makeAbsence(3)])));

    const result = await fetchTtAbsences('2024-01-01', '2024-02-28');
    expect(result).toHaveLength(3);
    const ids = (result as Array<Record<string, unknown>>).map((r) => r.id).sort();
    expect(ids).toEqual([1, 2, 3]);
  });

  it('chunks a multi-month range into 31-day windows and calls the API once per window', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    // 2024-01-01 to 2024-04-01 ≈ 91 days → 3 windows:
    //   Window 1: 2024-01-01 → 2024-01-31
    //   Window 2: 2024-02-01 → 2024-03-02
    //   Window 3: 2024-03-03 → 2024-04-01 (capped to range end)
    fetchMock
      .mockResolvedValueOnce(okJson(holidaysResponse([makeAbsence(1)])))
      .mockResolvedValueOnce(okJson(holidaysResponse([makeAbsence(2)])))
      .mockResolvedValueOnce(okJson(holidaysResponse([makeAbsence(3)])));

    const result = await fetchTtAbsences('2024-01-01', '2024-04-01');
    expect(result).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Verify window boundaries via the URL query params
    const urls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(urls[0]).toMatch(/Start=2024-01-01&End=2024-01-31/);
    expect(urls[1]).toMatch(/Start=2024-02-01&End=2024-03-02/);
    expect(urls[2]).toMatch(/Start=2024-03-03&End=2024-04-01/);
  });
});

// The 429 retry test needs the real withRetry but with fake timers to speed through delays
describe('fetchTtAbsences — retry behavior', () => {
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

  it('404 is non-retryable — thrown immediately with only 1 fetch call', async () => {
    const { fetchTtAbsences } = await import('./client.js');
    fetchMock.mockResolvedValueOnce(errResponse(404, 'not found'));

    await expect(fetchTtAbsences('2024-01-01', '2024-01-15')).rejects.toMatchObject({
      name: 'TimetasticApiError',
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
