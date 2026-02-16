import { getTimetasticConfig } from '../config.js';
import { log } from '../logger.js';
import { withRetry } from '../retry-with-backoff.js';

const TT_API_BASE = 'https://app.timetastic.co.uk/api';
const DEFAULT_GAP_MS = 200;
const ABSENCES_GAP_MS = 1000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);

let lastRequestAt = 0;

async function rateLimit(gapMs: number) {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < gapMs) {
    await new Promise((r) => setTimeout(r, gapMs - elapsed));
  }
  lastRequestAt = Date.now();
}

class TimetasticApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TimetasticApiError';
  }
}

function isRetryableTtError(err: unknown): boolean {
  return err instanceof TimetasticApiError && RETRYABLE_STATUSES.has(err.status);
}

function authHeaders(): Record<string, string> {
  const { timetasticApiToken } = getTimetasticConfig();
  return {
    Authorization: `Bearer ${timetasticApiToken}`,
    'Content-Type': 'application/json',
  };
}

async function ttFetch<T>(path: string, gapMs = DEFAULT_GAP_MS): Promise<T> {
  return withRetry(
    async () => {
      await rateLimit(gapMs);
      const url = `${TT_API_BASE}${path}`;
      log.info(`GET ${url}`);
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) return res.json() as Promise<T>;
      const body = await res.text();
      throw new TimetasticApiError(`Timetastic API ${res.status}: ${body}`, res.status);
    },
    isRetryableTtError,
    { baseDelayMs: 2000 },
  );
}

export async function fetchTtUsers(): Promise<unknown[]> {
  return ttFetch<unknown[]>('/users');
}

export async function fetchTtDepartments(): Promise<unknown[]> {
  return ttFetch<unknown[]>('/departments');
}

export async function fetchTtLeaveTypes(): Promise<unknown[]> {
  return ttFetch<unknown[]>('/leavetypes');
}

interface TtHolidaysResponse {
  holidays: unknown[];
  totalRecords: number;
  nextPageLink: string | null;
}

/** Add days to a YYYY-MM-DD string using pure UTC arithmetic (timezone-independent) */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const dt = new Date(ms);
  return dt.toISOString().split('T')[0]!;
}

/** Fetch absences in 31-day windows between from and to */
export async function fetchTtAbsences(from: string, to: string): Promise<unknown[]> {
  const seen = new Map<string, unknown>();

  let windowStart = from;

  while (windowStart < to) {
    let windowEnd = addDays(windowStart, 30); // 31-day window (inclusive)
    if (windowEnd > to) windowEnd = to;

    const res = await ttFetch<TtHolidaysResponse>(
      `/holidays?Start=${windowStart}&End=${windowEnd}`,
      ABSENCES_GAP_MS,
    );
    const holidays = res.holidays ?? [];
    for (const h of holidays) {
      const obj = h as Record<string, unknown>;
      const id = String(obj.id ?? obj.Id ?? obj.ID);
      seen.set(id, h);
    }

    log.info(`  Fetched absences for ${windowStart} → ${windowEnd} (unique so far: ${seen.size})`);

    windowStart = addDays(windowEnd, 1);
  }

  return [...seen.values()];
}
