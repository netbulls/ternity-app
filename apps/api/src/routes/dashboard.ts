import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { ORG_TIMEZONE } from '@ternity/shared';
import type { DashboardData } from '@ternity/shared';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_TARGET_SECONDS = 144_000; // 40h
// SQL-safe timezone literal for use in raw SQL (single-quoted for AT TIME ZONE)
const TZ_LITERAL = sql.raw(`'${ORG_TIMEZONE}'`);

// ── Timezone helpers ───────────────────────────────────────────────────────

/** Get YYYY-MM-DD of a Date in the org timezone */
function orgDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ORG_TIMEZONE }); // en-CA → YYYY-MM-DD
}

/** Get year/month/day-of-week in the org timezone */
function orgDateParts(date: Date): { year: number; month: number; day: number; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(date);

  const year = parseInt(parts.find((p) => p.type === 'year')!.value);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value); // 1-based
  const day = parseInt(parts.find((p) => p.type === 'day')!.value);
  const wd = parts.find((p) => p.type === 'weekday')!.value;
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { year, month, day, dow: dowMap[wd]! };
}

/**
 * Convert a YYYY-MM-DD midnight in org timezone to a UTC Date.
 * Used to create DB query boundaries that represent org-timezone day boundaries.
 */
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

/** Get day-of-week (0=Sun) for a YYYY-MM-DD string */
function dateDow(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay();
}

// ── Routes ─────────────────────────────────────────────────────────────────

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/api/dashboard', async (request) => {
    const userId = request.auth.userId;
    const now = new Date();

    // ── Today in org timezone ────────────────────────────────────────
    const todayStr = orgDateStr(now);
    const { year: orgYear, month: orgMonth, dow: orgDow } = orgDateParts(now);

    // ── Week boundaries (Mon–Sun, org timezone) ─────────────────────
    // orgDow: 0=Sun, 1=Mon, ...
    const mondayOffset = orgDow === 0 ? -6 : 1 - orgDow;
    const weekStartStr = addDays(todayStr, mondayOffset);
    const weekEndStr = addDays(weekStartStr, 6);

    // UTC timestamps for DB queries (represent org timezone midnight boundaries)
    const weekStartUTC = orgMidnightToUTC(weekStartStr);
    const weekEndUTC = new Date(orgMidnightToUTC(addDays(weekEndStr, 1)).getTime() - 1); // end of Sunday

    // ── Month boundaries (org timezone) ─────────────────────────────
    const monthStartStr = `${orgYear}-${String(orgMonth).padStart(2, '0')}-01`;
    // Last day of month: day 0 of next month
    const lastDay = new Date(orgYear, orgMonth, 0).getDate(); // orgMonth is 1-based, works as 0-indexed next month
    const monthEndStr = `${orgYear}-${String(orgMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const monthStartUTC = orgMidnightToUTC(monthStartStr);
    const monthEndUTC = new Date(orgMidnightToUTC(addDays(monthEndStr, 1)).getTime() - 1);

    // ── ISO week number ────────────────────────────────────────────
    const weekNumber = getISOWeekNumber(new Date(weekStartStr + 'T12:00:00Z'));

    // ── Query 1: Week entries grouped by date + project ────────────
    // Group by date in org timezone so segments are attributed to the correct local day
    const weekResult = await db.execute<{
      entry_date: string;
      project_id: string | null;
      project_name: string | null;
      project_color: string | null;
      client_name: string | null;
      entry_count: string;
      total_seconds: string;
    }>(sql`
      SELECT
        DATE(COALESCE(es.started_at, es.created_at) AT TIME ZONE ${TZ_LITERAL}) AS entry_date,
        te.project_id,
        p.name AS project_name,
        p.color AS project_color,
        c.name AS client_name,
        COUNT(DISTINCT te.id)::text AS entry_count,
        COALESCE(SUM(
          CASE
            WHEN es.stopped_at IS NULL AND es.type = 'clocked'
            THEN EXTRACT(EPOCH FROM NOW() - es.started_at)
            ELSE es.duration_seconds
          END
        ), 0)::text AS total_seconds
      FROM time_entries te
      INNER JOIN entry_segments es ON es.entry_id = te.id
      LEFT JOIN projects p ON p.id = te.project_id
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE te.user_id = ${userId}
        AND te.is_active = true
        AND COALESCE(es.started_at, es.created_at) >= ${weekStartUTC}
        AND COALESCE(es.started_at, es.created_at) <= ${weekEndUTC}
      GROUP BY DATE(COALESCE(es.started_at, es.created_at) AT TIME ZONE ${TZ_LITERAL}), te.project_id, p.name, p.color, c.name
      ORDER BY entry_date
    `);

    // ── Query 2: Month entries grouped by date ─────────────────────
    const monthResult = await db.execute<{
      entry_date: string;
      total_seconds: string;
    }>(sql`
      SELECT
        DATE(COALESCE(es.started_at, es.created_at) AT TIME ZONE ${TZ_LITERAL}) AS entry_date,
        COALESCE(SUM(
          CASE
            WHEN es.stopped_at IS NULL AND es.type = 'clocked'
            THEN EXTRACT(EPOCH FROM NOW() - es.started_at)
            ELSE es.duration_seconds
          END
        ), 0)::text AS total_seconds
      FROM time_entries te
      INNER JOIN entry_segments es ON es.entry_id = te.id
      WHERE te.user_id = ${userId}
        AND te.is_active = true
        AND COALESCE(es.started_at, es.created_at) >= ${monthStartUTC}
        AND COALESCE(es.started_at, es.created_at) <= ${monthEndUTC}
      GROUP BY DATE(COALESCE(es.started_at, es.created_at) AT TIME ZONE ${TZ_LITERAL})
      ORDER BY entry_date
    `);

    // ── Derive weekDays (7 items, Mon–Sun) ─────────────────────────
    const weekRows = weekResult.rows;
    const monthRows = monthResult.rows;
    const weekDayTotals = new Map<string, number>();
    let noProjectCount = 0;

    for (const row of weekRows) {
      const dateStr =
        typeof row.entry_date === 'string'
          ? row.entry_date.slice(0, 10)
          : new Date(row.entry_date).toISOString().slice(0, 10);
      const seconds = Math.round(Number(row.total_seconds));
      weekDayTotals.set(dateStr, (weekDayTotals.get(dateStr) ?? 0) + seconds);

      if (row.project_id === null) {
        noProjectCount += Number(row.entry_count);
      }
    }

    const weekDays: DashboardData['weekDays'] = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = addDays(weekStartStr, i);
      weekDays.push({
        date: dateStr,
        dayOfWeek: i + 1, // 1=Mon, 7=Sun
        dayLabel: DAY_LABELS[i]!,
        totalSeconds: weekDayTotals.get(dateStr) ?? 0,
      });
    }

    // ── Attention: week total + percentage ──────────────────────────
    const weekTotalSeconds = weekDays.reduce((s, d) => s + d.totalSeconds, 0);
    const weekPercentage = Math.round((weekTotalSeconds / WEEK_TARGET_SECONDS) * 100);

    // ── Attention: low day (among elapsed Mon-Fri, up to today) ────
    const elapsedWeekdays = weekDays.filter((d) => d.dayOfWeek <= 5 && d.date <= todayStr);
    let lowDay: DashboardData['attention']['lowDay'] = null;
    if (elapsedWeekdays.length > 0) {
      const min = elapsedWeekdays.reduce((a, b) => (a.totalSeconds <= b.totalSeconds ? a : b));
      lowDay = { dayLabel: min.dayLabel, totalSeconds: min.totalSeconds };
    }

    // ── Week avg per day ───────────────────────────────────────────
    const weekdayTotal = elapsedWeekdays.reduce((s, d) => s + d.totalSeconds, 0);
    const weekAvgPerDaySeconds =
      elapsedWeekdays.length > 0 ? Math.round(weekdayTotal / elapsedWeekdays.length) : 0;

    // ── Heatmap days (full month calendar grid) ────────────────────
    const monthTotalsMap = new Map<string, number>();
    for (const row of monthRows) {
      const dateStr =
        typeof row.entry_date === 'string'
          ? row.entry_date.slice(0, 10)
          : new Date(row.entry_date).toISOString().slice(0, 10);
      monthTotalsMap.set(dateStr, Math.round(Number(row.total_seconds)));
    }

    const heatmapDays: DashboardData['heatmapDays'] = [];
    const firstDayDow = dateDow(monthStartStr); // 0=Sun
    const firstDayIso = firstDayDow === 0 ? 7 : firstDayDow; // 1=Mon, 7=Sun
    let currentWeekIndex = 0;

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${orgYear}-${String(orgMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dow = dateDow(dateStr);
      const isoDow = dow === 0 ? 7 : dow; // 1=Mon, 7=Sun

      if (day > 1 && isoDow === 1) {
        currentWeekIndex++;
      }

      heatmapDays.push({
        date: dateStr,
        dayOfMonth: day,
        dayOfWeek: isoDow,
        weekIndex: currentWeekIndex,
        totalSeconds: monthTotalsMap.get(dateStr) ?? 0,
      });
    }

    const monthTotalSeconds = heatmapDays.reduce((s, d) => s + d.totalSeconds, 0);

    // ── Working days left (Mon-Fri from tomorrow to end of month) ──
    let workingDaysLeft = 0;
    let cursor = addDays(todayStr, 1);
    while (cursor <= monthEndStr) {
      const dow = dateDow(cursor);
      if (dow >= 1 && dow <= 5) workingDaysLeft++;
      cursor = addDays(cursor, 1);
    }

    // ── Month label ────────────────────────────────────────────────
    const monthLabel = new Date(monthStartStr + 'T12:00:00Z').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    // ── Project breakdown (week, sorted desc) ──────────────────────
    const projectMap = new Map<
      string,
      {
        projectId: string | null;
        projectName: string;
        projectColor: string;
        clientName: string | null;
        totalSeconds: number;
      }
    >();

    for (const row of weekRows) {
      const key = row.project_id ?? '__none__';
      const existing = projectMap.get(key);
      const seconds = Math.round(Number(row.total_seconds));
      if (existing) {
        existing.totalSeconds += seconds;
      } else {
        projectMap.set(key, {
          projectId: row.project_id,
          projectName: row.project_name ?? 'No project',
          projectColor: row.project_color ?? '#F59E0B', // amber for no-project
          clientName: row.client_name,
          totalSeconds: seconds,
        });
      }
    }

    const projectBreakdown: DashboardData['projectBreakdown'] = Array.from(projectMap.values())
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .map((p) => ({
        ...p,
        percentage:
          weekTotalSeconds > 0 ? Math.round((p.totalSeconds / weekTotalSeconds) * 100) : 0,
      }));

    // ── Response ───────────────────────────────────────────────────
    const data: DashboardData = {
      weekNumber,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,

      attention: {
        noProjectCount,
        weekTotalSeconds,
        weekTargetSeconds: WEEK_TARGET_SECONDS,
        weekPercentage,
        lowDay,
      },

      weekDays,

      monthLabel,
      heatmapDays,
      monthTotalSeconds,
      workingDaysLeft,

      weekAvgPerDaySeconds,

      projectBreakdown,
    };

    return data;
  });
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
