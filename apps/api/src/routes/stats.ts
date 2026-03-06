import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { timeEntries, entrySegments } from '../db/schema.js';
import { ORG_TIMEZONE } from '@ternity/shared';

/** Convert a YYYY-MM-DD midnight in org timezone to a UTC Date */
function orgMidnightToUTC(dateStr: string): Date {
  // Find the UTC offset for the org timezone on the given date
  const noon = new Date(dateStr + 'T12:00:00Z');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    hour12: false,
    timeZoneName: 'longOffset',
  }).formatToParts(noon);
  const tzPart = parts.find((p) => p.type === 'timeZoneName');
  const match = tzPart?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) throw new Error('Cannot parse timezone offset for ' + ORG_TIMEZONE);
  const sign = match[1] === '+' ? 1 : -1;
  const offsetMs = sign * (parseInt(match[2]!, 10) * 3600000 + parseInt(match[3]!, 10) * 60000);
  // Midnight in org timezone = midnight UTC minus the UTC offset
  return new Date(new Date(dateStr + 'T00:00:00Z').getTime() - offsetMs);
}

/** Advance a YYYY-MM-DD string by n days */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function statsRoutes(fastify: FastifyInstance) {
  /** GET /api/stats — today + this week totals */
  fastify.get('/api/stats', async (request) => {
    const userId = request.auth.userId;
    const now = new Date();

    // Today in org timezone
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: ORG_TIMEZONE });
    const todayStart = orgMidnightToUTC(todayStr);
    const todayEnd = new Date(orgMidnightToUTC(addDays(todayStr, 1)).getTime() - 1);

    // Week boundaries (Monday-Sunday, org timezone)
    const orgDow = new Intl.DateTimeFormat('en-US', {
      timeZone: ORG_TIMEZONE,
      weekday: 'short',
    }).format(now);
    const dowMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayOfWeek = dowMap[orgDow]!;
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStartStr = addDays(todayStr, mondayOffset);
    const weekEndStr = addDays(weekStartStr, 6);

    const weekStart = orgMidnightToUTC(weekStartStr);
    const weekEnd = new Date(orgMidnightToUTC(addDays(weekEndStr, 1)).getTime() - 1);

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
          eq(timeEntries.isActive, true),
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
          eq(timeEntries.isActive, true),
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
