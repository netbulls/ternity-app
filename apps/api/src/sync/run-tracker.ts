import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { syncRuns } from '../db/schema.js';

type SyncSource = 'toggl' | 'timetastic';

export async function startRun(source: SyncSource, entity: string) {
  const [run] = await db
    .insert(syncRuns)
    .values({ source, entity })
    .returning({ id: syncRuns.id });
  return run;
}

export async function completeRun(runId: string, recordCount: number) {
  await db
    .update(syncRuns)
    .set({
      status: 'completed',
      recordCount,
      completedAt: new Date(),
    })
    .where(eq(syncRuns.id, runId));
}

export async function failRun(runId: string, error: string) {
  await db
    .update(syncRuns)
    .set({
      status: 'failed',
      errorMessage: error,
      completedAt: new Date(),
    })
    .where(eq(syncRuns.id, runId));
}
