import { db } from '../../db/index.js';
import {
  stgTtUsers,
  stgTtDepartments,
  stgTtLeaveTypes,
  stgTtAbsences,
} from '../../db/schema.js';
import { log } from '../logger.js';
import { startRun, completeRun, failRun } from '../run-tracker.js';
import {
  fetchTtUsers,
  fetchTtDepartments,
  fetchTtLeaveTypes,
  fetchTtAbsences,
} from './client.js';

type StagingTable =
  | typeof stgTtUsers
  | typeof stgTtDepartments
  | typeof stgTtLeaveTypes
  | typeof stgTtAbsences;

function getId(row: unknown): string {
  const obj = row as Record<string, unknown>;
  return String(obj.id ?? obj.Id ?? obj.ID);
}

async function extractEntity(
  entity: string,
  table: StagingTable,
  fetcher: () => Promise<unknown[]>,
) {
  const run = await startRun('timetastic', entity);
  const runId = run!.id;
  try {
    log.info(`Extracting timetastic/${entity}...`);
    const rows = await fetcher();

    await db.delete(table);

    if (rows.length > 0) {
      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await db.insert(table).values(
          batch.map((row) => ({
            externalId: getId(row),
            rawData: row,
            syncRunId: runId,
          })),
        );
      }
    }

    await completeRun(runId, rows.length);
    log.info(`  ✓ timetastic/${entity}: ${rows.length} records`);
    return rows.length;
  } catch (err) {
    await failRun(runId, err instanceof Error ? err.message : String(err));
    log.error(`  ✗ timetastic/${entity}: ${err}`);
    throw err;
  }
}

export async function extractTtUsers() {
  return extractEntity('users', stgTtUsers, fetchTtUsers);
}

export async function extractTtDepartments() {
  return extractEntity('departments', stgTtDepartments, fetchTtDepartments);
}

export async function extractTtLeaveTypes() {
  return extractEntity('leave_types', stgTtLeaveTypes, fetchTtLeaveTypes);
}

export async function extractTtAbsences(from?: string, to?: string) {
  const startDate = from ?? '2020-01-01';
  const endDate = to ?? new Date().toISOString().split('T')[0]!;
  return extractEntity('absences', stgTtAbsences, () => fetchTtAbsences(startDate, endDate));
}

export async function extractAllTimetastic(from?: string, to?: string) {
  const counts: Record<string, number> = {};
  counts.users = await extractTtUsers();
  counts.departments = await extractTtDepartments();
  counts.leave_types = await extractTtLeaveTypes();
  counts.absences = await extractTtAbsences(from, to);
  return counts;
}
