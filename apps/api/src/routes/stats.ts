import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { timeEntries } from '../db/schema.js';

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

    // Query today's total (completed + running entries)
    const [todayResult] = await db
      .select({
        total: sql<number>`
          COALESCE(SUM(
            CASE
              WHEN ${timeEntries.stoppedAt} IS NULL
              THEN EXTRACT(EPOCH FROM NOW() - ${timeEntries.startedAt})
              ELSE ${timeEntries.durationSeconds}
            END
          ), 0)
        `.as('total'),
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.startedAt, todayStart),
          lte(timeEntries.startedAt, todayEnd),
        ),
      );

    // Query this week's total
    const [weekResult] = await db
      .select({
        total: sql<number>`
          COALESCE(SUM(
            CASE
              WHEN ${timeEntries.stoppedAt} IS NULL
              THEN EXTRACT(EPOCH FROM NOW() - ${timeEntries.startedAt})
              ELSE ${timeEntries.durationSeconds}
            END
          ), 0)
        `.as('total'),
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.startedAt, weekStart),
          lte(timeEntries.startedAt, weekEnd),
        ),
      );

    return {
      todaySeconds: Math.round(Number(todayResult?.total ?? 0)),
      weekSeconds: Math.round(Number(weekResult?.total ?? 0)),
    };
  });
}
