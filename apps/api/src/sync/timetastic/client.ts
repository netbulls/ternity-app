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

/** Fetch absences in 31-day windows between from and to */
export async function fetchTtAbsences(from: string, to: string): Promise<unknown[]> {
  const allAbsences: unknown[] = [];
  const startDate = new Date(from);
  const endDate = new Date(to);

  let windowStart = new Date(startDate);

  while (windowStart < endDate) {
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 30); // 31-day window (inclusive)
    if (windowEnd > endDate) {
      windowEnd.setTime(endDate.getTime());
    }

    const fromStr = windowStart.toISOString().split('T')[0]!;
    const toStr = windowEnd.toISOString().split('T')[0]!;

    const res = await ttFetch<TtHolidaysResponse>(
      `/holidays?Start=${fromStr}&End=${toStr}`,
      ABSENCES_GAP_MS,
    );
    const holidays = res.holidays ?? [];
    allAbsences.push(...holidays);

    log.info(`  Fetched absences for ${fromStr} → ${toStr} (running total: ${allAbsences.length})`);

    windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() + 1);
  }

  return allAbsences;
}
