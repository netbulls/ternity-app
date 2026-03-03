import { FastifyInstance } from 'fastify';
import { eq, and, isNull, gte, sql } from 'drizzle-orm';
import {
  DEFAULT_WEEKLY_WORKING_HOURS,
  type WeeklyWorkingHours,
  type WorkingDayKey,
} from '@ternity/shared';
import { db } from '../db/index.js';
import {
  users,
  workingSchedules,
  timeEntries,
  entrySegments,
  projects,
  clients,
} from '../db/schema.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Get the WorkingDayKey for a given date */
function dayKeyForDate(date: Date): WorkingDayKey {
  const keys: WorkingDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return keys[date.getDay()]!;
}

/** Parse "HH:mm" into fractional hours (e.g. "09:30" → 9.5) */
function timeToHour(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! + m! / 60;
}

/** Determine the presence status for a user based on their schedule and running timer */
function deriveStatus(
  schedule: { enabled: boolean; start: string; end: string } | null,
  hasRunningTimer: boolean,
  now: Date,
): 'available' | 'working-off-hours' | 'idle' | 'off-schedule' {
  if (!schedule || !schedule.enabled) {
    // Day off or no schedule
    return hasRunningTimer ? 'working-off-hours' : 'off-schedule';
  }

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const schedStart = timeToHour(schedule.start);
  const schedEnd = timeToHour(schedule.end);
  const withinSchedule = currentHour >= schedStart && currentHour < schedEnd;

  if (withinSchedule) {
    return hasRunningTimer ? 'available' : 'idle';
  } else {
    return hasRunningTimer ? 'working-off-hours' : 'off-schedule';
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

export async function teamRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/team/board
   *
   * Returns the team presence board data: all active users with their
   * today's schedule, running timer, and today's time entries.
   * Available to all authenticated users (not admin-only).
   */
  fastify.get('/api/team/board', async (request) => {
    const now = new Date();
    const todayKey = dayKeyForDate(now);

    // Start of today (midnight) for filtering entries
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 1. Fetch all active users with their working schedules
    const allUsers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        schedule: workingSchedules.schedule,
      })
      .from(users)
      .leftJoin(workingSchedules, eq(users.id, workingSchedules.userId))
      .where(eq(users.active, true))
      .orderBy(users.displayName);

    // 2. Fetch today's entries for all active users (segments started today)
    //    Join with projects + clients for name/color
    const todayEntries = await db
      .select({
        entryId: timeEntries.id,
        userId: timeEntries.userId,
        description: timeEntries.description,
        projectName: projects.name,
        projectColor: projects.color,
        clientName: clients.name,
        segmentId: entrySegments.id,
        segmentType: entrySegments.type,
        startedAt: entrySegments.startedAt,
        stoppedAt: entrySegments.stoppedAt,
        durationSeconds: entrySegments.durationSeconds,
      })
      .from(entrySegments)
      .innerJoin(timeEntries, eq(entrySegments.entryId, timeEntries.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(eq(timeEntries.isActive, true), gte(entrySegments.startedAt, todayStart)))
      .orderBy(entrySegments.startedAt);

    // 3. Find running timers (segments with no stoppedAt and type = clocked)
    //    We already have this data in todayEntries, just need to identify them
    const runningByUser = new Map<
      string,
      {
        entryId: string;
        description: string;
        projectName: string | null;
        projectColor: string | null;
        startedAt: Date | null;
      }
    >();

    for (const row of todayEntries) {
      if (row.segmentType === 'clocked' && row.stoppedAt === null) {
        runningByUser.set(row.userId, {
          entryId: row.entryId,
          description: row.description,
          projectName: row.projectName,
          projectColor: row.projectColor,
          startedAt: row.startedAt,
        });
      }
    }

    // Also check for running timers started before today (user left timer running overnight)
    const overnightRunning = await db
      .select({
        userId: timeEntries.userId,
        entryId: timeEntries.id,
        description: timeEntries.description,
        projectName: projects.name,
        projectColor: projects.color,
        startedAt: entrySegments.startedAt,
      })
      .from(entrySegments)
      .innerJoin(timeEntries, eq(entrySegments.entryId, timeEntries.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(
        and(
          eq(timeEntries.isActive, true),
          eq(entrySegments.type, sql`'clocked'`),
          isNull(entrySegments.stoppedAt),
          sql`${entrySegments.startedAt} < ${todayStart}`,
        ),
      );

    for (const row of overnightRunning) {
      if (!runningByUser.has(row.userId)) {
        runningByUser.set(row.userId, {
          entryId: row.entryId,
          description: row.description,
          projectName: row.projectName,
          projectColor: row.projectColor,
          startedAt: row.startedAt,
        });
      }
    }

    // 4. Group entries by user
    const entriesByUser = new Map<
      string,
      {
        id: string;
        projectName: string;
        projectColor: string;
        description: string;
        startedAt: string;
        stoppedAt: string | null;
        durationSeconds: number;
      }[]
    >();

    for (const row of todayEntries) {
      if (!entriesByUser.has(row.userId)) {
        entriesByUser.set(row.userId, []);
      }
      entriesByUser.get(row.userId)!.push({
        id: row.segmentId,
        projectName: row.projectName ?? 'No Project',
        projectColor: row.projectColor ?? '#00D4AA',
        description: row.description,
        startedAt: row.startedAt?.toISOString() ?? now.toISOString(),
        stoppedAt: row.stoppedAt?.toISOString() ?? null,
        durationSeconds: row.durationSeconds ?? 0,
      });
    }

    // 5. Assemble response
    const board = allUsers.map((user) => {
      const weeklySchedule: WeeklyWorkingHours = user.schedule
        ? (user.schedule as WeeklyWorkingHours)
        : DEFAULT_WEEKLY_WORKING_HOURS;

      const todaySchedule = weeklySchedule[todayKey];
      const running = runningByUser.get(user.id) ?? null;
      const status = deriveStatus(todaySchedule, running !== null, now);

      return {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status,
        schedule: todaySchedule.enabled
          ? { start: todaySchedule.start, end: todaySchedule.end }
          : null,
        runningEntry: running
          ? {
              projectName: running.projectName ?? 'No Project',
              projectColor: running.projectColor ?? '#00D4AA',
              description: running.description,
              startedAt: running.startedAt?.toISOString() ?? now.toISOString(),
            }
          : null,
        entries: entriesByUser.get(user.id) ?? [],
      };
    });

    return board;
  });
}
