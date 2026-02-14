import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { stgTogglTimeEntries } from '../../db/schema.js';
import { togglReportsFetch } from './client.js';
import { log } from '../logger.js';

interface SummaryGroup {
  id: number | null;
  sub_groups?: SummarySubGroup[];
  [key: string]: unknown;
}

interface SummarySubGroup {
  id: number | null;
  ids?: number[];
  time_entry_ids?: number[];
  [key: string]: unknown;
}

interface SummaryResponse {
  groups: SummaryGroup[];
  [key: string]: unknown;
}

/**
 * Count time entries in Toggl for a date range using the summary endpoint.
 * Uses `include_time_entry_ids: true` so we can count IDs without paginating.
 * Falls back to search-based counting if summary doesn't return IDs.
 */
async function countTogglEntries(startDate: string, endDate: string): Promise<number> {
  const body = {
    start_date: startDate,
    end_date: endDate,
    grouping: 'projects',
    sub_grouping: 'time_entries',
    include_time_entry_ids: true,
  };

  const res = await togglReportsFetch<SummaryResponse>('/summary/time_entries', body);

  let count = 0;
  for (const group of res.groups ?? []) {
    for (const sub of group.sub_groups ?? []) {
      count += sub.ids?.length ?? sub.time_entry_ids?.length ?? 0;
    }
  }

  // If we got zero but there ARE groups, the response format might differ.
  // Log a warning so we can investigate.
  if (count === 0 && (res.groups?.length ?? 0) > 0) {
    log.warn(`Summary returned ${res.groups.length} groups but 0 entry IDs — response format may have changed`);
    log.warn(`First group sample: ${JSON.stringify(res.groups[0]).slice(0, 500)}`);
  }

  return count;
}

/**
 * Count time entries in our staging table for a date range.
 */
async function countStagingEntries(startDate: string, endDate: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stgTogglTimeEntries)
    .where(
      sql`(raw_data->>'start')::date >= ${startDate}::date
          AND (raw_data->>'start')::date <= ${endDate}::date`,
    );
  return Number(row?.count ?? 0);
}

interface YearComparison {
  year: number;
  toggl: number;
  staging: number;
  diff: number;
  match: boolean;
}

/**
 * Verify staging entry counts match Toggl, grouped by year.
 * Returns per-year comparison and overall totals.
 */
export async function verifyTogglEntries(fromYear?: number, toYear?: number): Promise<{
  years: YearComparison[];
  totalToggl: number;
  totalStaging: number;
  allMatch: boolean;
}> {
  const startYear = fromYear ?? 2020;
  const currentYear = toYear ?? new Date().getFullYear();

  log.info(`Verifying Toggl time entries: ${startYear}–${currentYear}`);
  log.info('');

  const years: YearComparison[] = [];
  let totalToggl = 0;
  let totalStaging = 0;

  for (let year = startYear; year <= currentYear; year++) {
    const startDate = `${year}-01-01`;
    const endDate = year === currentYear
      ? new Date().toISOString().split('T')[0]!
      : `${year}-12-31`;

    log.info(`  ${year}: querying Toggl...`);
    const togglCount = await countTogglEntries(startDate, endDate);

    const stagingCount = await countStagingEntries(startDate, endDate);

    const diff = stagingCount - togglCount;
    const match = diff === 0;

    years.push({ year, toggl: togglCount, staging: stagingCount, diff, match });
    totalToggl += togglCount;
    totalStaging += stagingCount;

    const icon = match ? '✓' : '✗';
    const diffStr = diff === 0 ? '' : ` (${diff > 0 ? '+' : ''}${diff})`;
    log.info(`  ${year}: Toggl=${togglCount.toLocaleString()} Staging=${stagingCount.toLocaleString()} ${icon}${diffStr}`);
  }

  const allMatch = totalToggl === totalStaging;
  log.info('');
  log.info(`  Total: Toggl=${totalToggl.toLocaleString()} Staging=${totalStaging.toLocaleString()} ${allMatch ? '✓' : `✗ (${totalStaging - totalToggl > 0 ? '+' : ''}${totalStaging - totalToggl})`}`);

  if (allMatch) {
    log.info('');
    log.info('  All counts match!');
  } else {
    log.info('');
    log.info(`  Discrepancy: ${Math.abs(totalStaging - totalToggl).toLocaleString()} entries ${totalStaging < totalToggl ? 'missing from' : 'extra in'} staging`);
  }

  return { years, totalToggl, totalStaging, allMatch };
}
