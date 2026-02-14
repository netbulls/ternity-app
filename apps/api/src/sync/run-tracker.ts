import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { syncRuns } from '../db/schema.js';

type SyncSource = 'toggl' | 'timetastic';
type ScheduleTrigger = 'frequent' | 'daily' | 'manual';

export async function startRun(
  source: SyncSource,
  entity: string,
  scheduleTrigger: ScheduleTrigger = 'manual',
) {
  const [run] = await db
    .insert(syncRuns)
    .values({ source, entity, scheduleTrigger })
    .returning({ id: syncRuns.id });
  return run;
}

export async function completeRun(runId: string, recordCount: number, retryCount = 0) {
  await db
    .update(syncRuns)
    .set({
      status: 'completed',
      recordCount,
      retryCount,
      completedAt: new Date(),
    })
    .where(eq(syncRuns.id, runId));
}

export async function failRun(runId: string, error: string, retryCount = 0) {
  await db
    .update(syncRuns)
    .set({
      status: 'failed',
      errorMessage: error,
      retryCount,
      completedAt: new Date(),
    })
    .where(eq(syncRuns.id, runId));
}
