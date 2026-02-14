import { getTogglConfig } from '../config.js';
import { log } from '../logger.js';

const TOGGL_API_BASE = 'https://api.track.toggl.com/api/v9';
const TOGGL_REPORTS_BASE = 'https://api.track.toggl.com/reports/api/v3';
const MIN_REQUEST_GAP_MS = 250;
const MAX_RATE_LIMIT_WAIT_SECS = 3600; // max 1 hour wait

let lastRequestAt = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_REQUEST_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

/**
 * Handle Toggl rate limit (402/429). Parses "reset in XXXX seconds" from
 * the response body. Waits for the full quota reset on the first attempt.
 * Returns { retry: true } if we should retry, or { retry: false, body } to throw.
 */
async function handleRateLimitWithBody(res: Response, attempt: number): Promise<{ retry: boolean; body?: string }> {
  if (res.status !== 429 && res.status !== 402) return { retry: false };
  if (attempt >= 1) {
    // Already retried once — return body for error message
    const body = await res.text();
    return { retry: false, body };
  }

  const body = await res.text();
  const match = body.match(/reset in (\d+) seconds/i);
  let waitSecs: number;
  if (match) {
    waitSecs = Math.min(parseInt(match[1]!, 10) + 10, MAX_RATE_LIMIT_WAIT_SECS);
  } else {
    const retryAfter = res.headers.get('retry-after');
    waitSecs = retryAfter ? parseInt(retryAfter, 10) : 60;
  }

  const waitMins = Math.ceil(waitSecs / 60);
  log.warn(`Rate limited (${res.status}). Quota resets in ${waitSecs}s (~${waitMins} min). Waiting...`);
  await new Promise((r) => setTimeout(r, waitSecs * 1000));
  return { retry: true };
}

function authHeader(): string {
  const { togglApiToken } = getTogglConfig();
  return 'Basic ' + Buffer.from(togglApiToken + ':api_token').toString('base64');
}

export async function togglFetch<T>(path: string): Promise<T> {
  const url = `${TOGGL_API_BASE}${path}`;
  for (let attempt = 0; attempt <= 1; attempt++) {
    await rateLimit();
    log.info(`GET ${url}`);
    const res = await fetch(url, {
      headers: { Authorization: authHeader() },
    });
    if (res.ok) return res.json() as Promise<T>;
    const rl = await handleRateLimitWithBody(res, attempt);
    if (rl.retry) continue;
    const errBody = rl.body ?? await res.text();
    throw new Error(`Toggl API ${res.status}: ${errBody}`);
  }
  throw new Error(`Toggl API: max retries exceeded for ${url}`);
}

export async function togglReportsFetch<T>(path: string, body: unknown): Promise<T> {
  const { togglWorkspaceId } = getTogglConfig();
  const url = `${TOGGL_REPORTS_BASE}/workspace/${togglWorkspaceId}${path}`;
  for (let attempt = 0; attempt <= 1; attempt++) {
    await rateLimit();
    log.info(`POST ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json() as Promise<T>;
    const rl = await handleRateLimitWithBody(res, attempt);
    if (rl.retry) continue;
    const errBody = rl.body ?? await res.text();
    throw new Error(`Toggl Reports API ${res.status}: ${errBody}`);
  }
  throw new Error(`Toggl Reports API: max retries exceeded for ${url}`);
}

export async function fetchTogglUsers(): Promise<unknown[]> {
  const { togglWorkspaceId } = getTogglConfig();
  return togglFetch<unknown[]>(`/workspaces/${togglWorkspaceId}/users`);
}

export async function fetchTogglClients(): Promise<unknown[]> {
  const { togglWorkspaceId } = getTogglConfig();
  return togglFetch<unknown[]>(`/workspaces/${togglWorkspaceId}/clients`);
}

export async function fetchTogglProjects(): Promise<unknown[]> {
  const { togglWorkspaceId } = getTogglConfig();
  return togglFetch<unknown[]>(`/workspaces/${togglWorkspaceId}/projects`);
}

export async function fetchTogglTags(): Promise<unknown[]> {
  const { togglWorkspaceId } = getTogglConfig();
  return togglFetch<unknown[]>(`/workspaces/${togglWorkspaceId}/tags`);
}

interface TogglSearchRow {
  description: string;
  project_id: number | null;
  user_id: number;
  username: string;
  tag_ids: number[];
  billable: boolean;
  time_entries: Array<{
    id: number;
    start: string;
    stop: string;
    seconds: number;
    at: string;
  }>;
  [key: string]: unknown;
}

/** Flatten grouped search results into one object per actual time entry */
function flattenSearchResults(rows: TogglSearchRow[]): Record<string, unknown>[] {
  const flat: Record<string, unknown>[] = [];
  for (const row of rows) {
    const { time_entries, ...parent } = row;
    for (const entry of time_entries ?? []) {
      flat.push({
        ...parent,
        id: entry.id,
        start: entry.start,
        stop: entry.stop,
        seconds: entry.seconds,
        entry_at: entry.at,
      });
    }
  }
  return flat;
}

/** Callback invoked after each page is fetched, allowing incremental persistence */
export type PageCallback = (entries: Record<string, unknown>[]) => Promise<void>;

/** Fetch time entries for a single date window (max 366 days), handling pagination */
export async function fetchTimeEntriesWindow(
  startDate: string,
  endDate: string,
  onPage?: PageCallback,
): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 200;
  const entries: Record<string, unknown>[] = [];
  let firstRowNumber: number | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const body: Record<string, unknown> = {
      start_date: startDate,
      end_date: endDate,
      page_size: PAGE_SIZE,
    };
    if (firstRowNumber !== undefined) {
      body.first_row_number = firstRowNumber;
    }

    const res = await togglReportsFetch<TogglSearchRow[]>('/search/time_entries', body);
    if (!res || res.length === 0) break;

    const flattened = flattenSearchResults(res);
    entries.push(...flattened);
    log.info(`  Fetched ${res.length} rows → ${flattened.length} entries (total: ${entries.length})`);

    // Save each page incrementally if callback provided
    if (onPage && flattened.length > 0) {
      await onPage(flattened);
    }

    if (res.length < PAGE_SIZE) break;
    firstRowNumber = (firstRowNumber ?? 1) + PAGE_SIZE;
  }

  return entries;
}

/** Fetch all time entries, chunking into 365-day windows */
export async function fetchTogglTimeEntries(
  startDate: string,
  endDate: string,
): Promise<unknown[]> {
  const allEntries: unknown[] = [];
  let windowStart = new Date(startDate);
  const end = new Date(endDate);

  while (windowStart < end) {
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 364); // 365-day window
    if (windowEnd > end) windowEnd.setTime(end.getTime());

    const fromStr = windowStart.toISOString().split('T')[0]!;
    const toStr = windowEnd.toISOString().split('T')[0]!;
    log.info(`  Time entries window: ${fromStr} → ${toStr}`);

    const entries = await fetchTimeEntriesWindow(fromStr, toStr);
    allEntries.push(...entries);

    windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() + 1);
  }

  return allEntries;
}
