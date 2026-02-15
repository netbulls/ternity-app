import { inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  stgTogglUsers,
  stgTogglClients,
  stgTogglProjects,
  stgTogglTags,
  stgTogglTimeEntries,
} from '../../db/schema.js';
import { log } from '../logger.js';
import { startRun, completeRun, failRun } from '../run-tracker.js';
import {
  fetchTogglUsers,
  fetchTogglClients,
  fetchTogglProjects,
  fetchTogglTags,
  fetchTimeEntriesWindow,
} from './client.js';

type StagingTable =
  | typeof stgTogglUsers
  | typeof stgTogglClients
  | typeof stgTogglProjects
  | typeof stgTogglTags
  | typeof stgTogglTimeEntries;

function getId(row: unknown): string {
  const obj = row as Record<string, unknown>;
  return String(obj.id ?? obj.Id ?? obj.ID);
}

/** Insert rows into staging, replacing any with matching external_ids */
async function upsertBatch(table: StagingTable, rows: unknown[], runId: string) {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const ids = batch.map(getId);
    // Delete existing rows with these external_ids, then insert fresh
    await db.delete(table).where(inArray(table.externalId, ids));
    await db.insert(table).values(
      batch.map((row) => ({
        externalId: getId(row),
        rawData: row,
        syncRunId: runId,
      })),
    );
  }
}

/** Extract a simple entity (full replace — safe for small datasets) */
async function extractEntity(
  entity: string,
  table: StagingTable,
  fetcher: () => Promise<unknown[]>,
) {
  const run = await startRun('toggl', entity);
  const runId = run!.id;
  try {
    log.info(`Extracting toggl/${entity}...`);
    const rows = await fetcher();

    // Full replace for small reference data
    await db.delete(table);

    if (rows.length > 0) {
      await upsertBatch(table, rows, runId);
    }

    await completeRun(runId, rows.length);
    log.info(`  ✓ toggl/${entity}: ${rows.length} records`);
    return rows.length;
  } catch (err) {
    await failRun(runId, err instanceof Error ? err.message : String(err));
    log.error(`  ✗ toggl/${entity}: ${err}`);
    throw err;
  }
}

export async function extractTogglUsers() {
  return extractEntity('users', stgTogglUsers, fetchTogglUsers);
}

export async function extractTogglClients() {
  return extractEntity('clients', stgTogglClients, fetchTogglClients);
}

export async function extractTogglProjects() {
  return extractEntity('projects', stgTogglProjects, fetchTogglProjects);
}

export async function extractTogglTags() {
  return extractEntity('tags', stgTogglTags, fetchTogglTags);
}

/**
 * Incremental time entries extract — resumes from where the last run left off.
 * Queries staging for the max entry date and starts 1 day before it (overlap
 * for deduplication). The upsertBatch handles dedup via externalId.
 * If rate-limited mid-way, already-saved windows are preserved.
 */
export async function extractTogglTimeEntries(from?: string, to?: string) {
  const absoluteStart = '2020-01-01';
  const endDate = to ?? new Date().toISOString().split('T')[0]!;

  const run = await startRun('toggl', 'time_entries');
  const runId = run!.id;
  let totalSaved = 0;

  try {
    // Check what we already have in staging
    const [existing] = await db
      .select({ count: sql<number>`count(*)` })
      .from(stgTogglTimeEntries);
    const existingCount = Number(existing?.count ?? 0);

    // Determine resume point: use explicit --from, or auto-detect from staging
    let startDate: string;
    if (from) {
      startDate = from;
      log.info(`Extracting toggl/time_entries (${startDate} → ${endDate}) [explicit --from]`);
    } else if (existingCount > 0) {
      // Find the max start date in staging to resume from
      const [maxRow] = await db
        .select({
          maxStart: sql<string>`max((raw_data->>'start')::date)`,
        })
        .from(stgTogglTimeEntries);
      const maxDate = maxRow?.maxStart;

      if (maxDate) {
        // Start 1 day before the max date (overlap for dedup safety)
        const resumeFrom = new Date(maxDate);
        resumeFrom.setDate(resumeFrom.getDate() - 1);
        startDate = resumeFrom.toISOString().split('T')[0]!;
        log.info(`Extracting toggl/time_entries (${startDate} → ${endDate}) [resuming — ${existingCount} entries in staging, max date: ${maxDate}]`);
      } else {
        startDate = absoluteStart;
        log.info(`Extracting toggl/time_entries (${startDate} → ${endDate}) [${existingCount} entries in staging but no dates found — full extract]`);
      }
    } else {
      startDate = absoluteStart;
      log.info(`Extracting toggl/time_entries (${startDate} → ${endDate}) [fresh — no entries in staging]`);
    }

    // Build 90-day windows (smaller = less data per request, avoids Toggl 500s)
    const WINDOW_DAYS = 90;
    const windows: { from: string; to: string }[] = [];
    let windowStart = new Date(startDate);
    const end = new Date(endDate);

    while (windowStart < end) {
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS - 1);
      if (windowEnd > end) windowEnd.setTime(end.getTime());

      windows.push({
        from: windowStart.toISOString().split('T')[0]!,
        to: windowEnd.toISOString().split('T')[0]!,
      });

      windowStart = new Date(windowEnd);
      windowStart.setDate(windowStart.getDate() + 1);
    }

    log.info(`  ${windows.length} windows to process (${WINDOW_DAYS}-day chunks)`);

    // Process each window, saving entries per-page for crash resilience
    for (const win of windows) {
      log.info(`  Window: ${win.from} → ${win.to}`);
      let windowSaved = 0;

      await fetchTimeEntriesWindow(win.from, win.to, async (pageEntries) => {
        await upsertBatch(stgTogglTimeEntries, pageEntries, runId);
        windowSaved += pageEntries.length;
        totalSaved += pageEntries.length;
      });

      if (windowSaved > 0) {
        log.info(`    Saved ${windowSaved} entries (running total: ${totalSaved})`);
      } else {
        log.info(`    No entries in this window`);
      }
    }

    // Get final count from DB (includes entries from previous runs)
    const [final] = await db
      .select({ count: sql<number>`count(*)` })
      .from(stgTogglTimeEntries);
    const finalCount = Number(final?.count ?? 0);

    await completeRun(runId, totalSaved);
    log.info(`  ✓ toggl/time_entries: ${totalSaved} fetched this run, ${finalCount} total in staging`);
    return totalSaved;
  } catch (err) {
    // On failure, report what was saved so far
    const [partial] = await db
      .select({ count: sql<number>`count(*)` })
      .from(stgTogglTimeEntries);
    const partialCount = Number(partial?.count ?? 0);

    await failRun(runId, err instanceof Error ? err.message : String(err));
    log.error(`  ✗ toggl/time_entries: ${err}`);
    log.info(`    ${totalSaved} entries saved this run before failure, ${partialCount} total in staging`);
    throw err;
  }
}

export type TogglEntity = 'users' | 'clients' | 'projects' | 'tags' | 'time_entries';

const ENTITY_EXTRACTORS: Record<TogglEntity, (from?: string, to?: string) => Promise<number>> = {
  users: () => extractTogglUsers(),
  clients: () => extractTogglClients(),
  projects: () => extractTogglProjects(),
  tags: () => extractTogglTags(),
  time_entries: (from, to) => extractTogglTimeEntries(from, to),
};

export async function extractAllToggl(from?: string, to?: string, entities?: TogglEntity[]) {
  const toRun = entities ?? (['users', 'clients', 'projects', 'tags', 'time_entries'] as TogglEntity[]);
  const counts: Record<string, number> = {};
  const failures: string[] = [];
  for (const entity of toRun) {
    try {
      counts[entity] = await ENTITY_EXTRACTORS[entity](from, to);
    } catch (err) {
      failures.push(entity);
      // Error already logged by extractEntity — continue with remaining entities
    }
  }
  if (failures.length > 0) {
    log.warn(`Toggl extract: ${failures.length}/${toRun.length} entities failed: ${failures.join(', ')}`);
  }
  return counts;
}
