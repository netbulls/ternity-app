import { FastifyInstance } from 'fastify';
import { desc, eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { syncRuns, syncScheduleState } from '../db/schema.js';

const HEARTBEAT_STALE_MS = 5 * 60_000; // 5 minutes

export async function syncStatusRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/sync/status
   * Scheduler alive/dead, next scheduled runs, last run per entity
   */
  fastify.get('/api/sync/status', async () => {
    // Scheduler state
    const [state] = await db.select().from(syncScheduleState).limit(1);

    const schedulerAlive = state
      ? Date.now() - new Date(state.schedulerHeartbeatAt).getTime() < HEARTBEAT_STALE_MS
      : false;

    // Last completed run per source+entity
    const lastRuns = await db
      .select({
        source: syncRuns.source,
        entity: syncRuns.entity,
        status: syncRuns.status,
        recordCount: syncRuns.recordCount,
        scheduleTrigger: syncRuns.scheduleTrigger,
        startedAt: syncRuns.startedAt,
        completedAt: syncRuns.completedAt,
      })
      .from(syncRuns)
      .where(
        sql`(${syncRuns.source}, ${syncRuns.entity}, ${syncRuns.startedAt}) IN (
          SELECT source, entity, MAX(started_at)
          FROM sync_runs
          WHERE status != 'running'
          GROUP BY source, entity
        )`,
      )
      .orderBy(syncRuns.source, syncRuns.entity);

    return {
      scheduler: {
        alive: schedulerAlive,
        startedAt: state?.schedulerStartedAt ?? null,
        heartbeatAt: state?.schedulerHeartbeatAt ?? null,
        nextFrequentRunAt: state?.nextFrequentRunAt ?? null,
        nextDailyRunAt: state?.nextDailyRunAt ?? null,
        lastFrequentRunAt: state?.lastFrequentRunAt ?? null,
        lastDailyRunAt: state?.lastDailyRunAt ?? null,
      },
      lastRuns,
    };
  });

  /**
   * GET /api/sync/runs
   * Paginated run history with optional source/status filters
   * Query params: source, status, limit (default 50), offset (default 0)
   */
  fastify.get('/api/sync/runs', async (request) => {
    const query = request.query as {
      source?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Number(query.limit ?? 50), 200);
    const offset = Number(query.offset ?? 0);

    const conditions = [];
    if (query.source) {
      conditions.push(eq(syncRuns.source, query.source as 'toggl' | 'timetastic'));
    }
    if (query.status) {
      conditions.push(eq(syncRuns.status, query.status as 'running' | 'completed' | 'failed'));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [runs, countResult] = await Promise.all([
      db
        .select()
        .from(syncRuns)
        .where(where)
        .orderBy(desc(syncRuns.startedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(syncRuns)
        .where(where),
    ]);

    return {
      runs,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    };
  });
}
