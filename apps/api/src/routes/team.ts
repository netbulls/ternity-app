import { FastifyInstance } from 'fastify';
import { eq, and, isNull, gte, lte, sql } from 'drizzle-orm';
import {
  DEFAULT_WEEKLY_WORKING_HOURS,
  ORG_TIMEZONE,
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

/** Get hour/minute/weekday of a Date in the org timezone */
function orgTimeParts(date: Date): { hours: number; minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);

  const h = parseInt(parts.find((p) => p.type === 'hour')!.value);
  const m = parseInt(parts.find((p) => p.type === 'minute')!.value);
  const wd = parts.find((p) => p.type === 'weekday')!.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { hours: h, minutes: m, weekday: weekdayMap[wd]! };
}

/** Get YYYY-MM-DD of a Date in the org timezone */
function orgDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ORG_TIMEZONE }); // en-CA → YYYY-MM-DD
}

/** Get the WorkingDayKey for a given date in the org timezone */
function dayKeyForDate(date: Date): WorkingDayKey {
  const keys: WorkingDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return keys[orgTimeParts(date).weekday]!;
}

/** Parse "HH:mm" into fractional hours (e.g. "09:30" → 9.5) */
function timeToHour(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! + m! / 60;
}

/** Get the current fractional hour in the org timezone */
function orgCurrentHour(date: Date): number {
  const { hours, minutes } = orgTimeParts(date);
  return hours + minutes / 60;
}

/** Determine the presence status for a user based on their schedule and running timer */
function deriveStatus(
  schedule: { enabled: boolean; start: string; end: string } | null,
  hasRunningTimer: boolean,
  now: Date,
): 'active' | 'overtime' | 'idle' | 'off' {
  if (!schedule || !schedule.enabled) {
    // Day off or no schedule
    return hasRunningTimer ? 'overtime' : 'off';
  }

  const currentHour = orgCurrentHour(now);
  const schedStart = timeToHour(schedule.start);
  const schedEnd = timeToHour(schedule.end);
  const withinSchedule = currentHour >= schedStart && currentHour < schedEnd;

  if (withinSchedule) {
    return hasRunningTimer ? 'active' : 'idle';
  } else {
    return hasRunningTimer ? 'overtime' : 'off';
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
    const query = request.query as Record<string, string | undefined>;
    const now = new Date();
    const todayStr = orgDateStr(now); // YYYY-MM-DD in org timezone

    // Determine target date — defaults to today (org timezone)
    let targetDateStr = todayStr;
    if (query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
      targetDateStr = query.date;
    }
    const isToday = targetDateStr === todayStr;

    // Build a Date for the target day (used for dayKey lookup)
    const targetDate = new Date(targetDateStr + 'T12:00:00'); // noon avoids DST edge
    const todayKey = dayKeyForDate(isToday ? now : targetDate);

    // Start/end of target date in org timezone, converted to UTC for DB queries.
    // Compute how far org timezone is from UTC at target day midnight.
    const refUTC = new Date(targetDateStr + 'T00:00:00Z');
    const refOrg = new Date(refUTC.toLocaleString('en-US', { timeZone: ORG_TIMEZONE }));
    const offsetMs = refUTC.getTime() - refOrg.getTime();
    // dayStart/dayEnd in UTC representing org timezone midnight-to-midnight
    const dayStart = new Date(refUTC.getTime() + offsetMs);
    const dayEnd = new Date(new Date(targetDateStr + 'T23:59:59.999Z').getTime() + offsetMs);

    // 1. Fetch all active users with their working schedules + team (defaultProject)
    const allUsers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        schedule: workingSchedules.schedule,
        teamId: users.defaultProjectId,
        teamName: projects.name,
        teamColor: projects.color,
      })
      .from(users)
      .leftJoin(workingSchedules, eq(users.id, workingSchedules.userId))
      .leftJoin(projects, eq(users.defaultProjectId, projects.id))
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
      .where(
        and(
          eq(timeEntries.isActive, true),
          gte(entrySegments.startedAt, dayStart),
          lte(entrySegments.startedAt, dayEnd),
        ),
      )
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

    // Also check for running timers started before target day (overnight timers) — only for today
    if (isToday) {
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
            sql`${entrySegments.startedAt} < ${dayStart}`,
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
      // For past days, don't compute live presence — just check if they had entries
      const hasEntries = (entriesByUser.get(user.id)?.length ?? 0) > 0;
      const status = isToday
        ? deriveStatus(todaySchedule, running !== null, now)
        : hasEntries
          ? 'active'
          : 'off';

      return {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        teamId: user.teamId,
        teamName: user.teamName,
        teamColor: user.teamColor,
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
