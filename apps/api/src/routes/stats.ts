import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { timeEntries, entrySegments } from '../db/schema.js';

export async function statsRoutes(fastify: FastifyInstance) {
  /** GET /api/stats — today + this week totals */
  fastify.get('/api/stats', async (request) => {
    const userId = request.auth.userId;
    const now = new Date();

    // Today boundaries (UTC)
    const todayStart = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const todayEnd = new Date(now.toISOString().slice(0, 10) + 'T23:59:59.999Z');

    // Week boundaries (Monday-Sunday, UTC)
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    // Query today's total (sum segments, handle running segments)
    const [todayResult] = await db
      .select({
        total: sql<number>`
          COALESCE(SUM(
            CASE
              WHEN ${entrySegments.stoppedAt} IS NULL AND ${entrySegments.type} = 'clocked'
              THEN EXTRACT(EPOCH FROM NOW() - ${entrySegments.startedAt})
              ELSE ${entrySegments.durationSeconds}
            END
          ), 0)
        `.as('total'),
      })
      .from(timeEntries)
      .innerJoin(entrySegments, eq(entrySegments.entryId, timeEntries.id))
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.createdAt, todayStart),
          lte(timeEntries.createdAt, todayEnd),
        ),
      );

    // Query this week's total
    const [weekResult] = await db
      .select({
        total: sql<number>`
          COALESCE(SUM(
            CASE
              WHEN ${entrySegments.stoppedAt} IS NULL AND ${entrySegments.type} = 'clocked'
              THEN EXTRACT(EPOCH FROM NOW() - ${entrySegments.startedAt})
              ELSE ${entrySegments.durationSeconds}
            END
          ), 0)
        `.as('total'),
      })
      .from(timeEntries)
      .innerJoin(entrySegments, eq(entrySegments.entryId, timeEntries.id))
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.createdAt, weekStart),
          lte(timeEntries.createdAt, weekEnd),
        ),
      );

    return {
      todaySeconds: Math.round(Number(todayResult?.total ?? 0)),
      weekSeconds: Math.round(Number(weekResult?.total ?? 0)),
    };
  });
}
