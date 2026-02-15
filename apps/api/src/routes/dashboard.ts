import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import type { DashboardData } from '@ternity/shared';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_TARGET_SECONDS = 144_000; // 40h

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/api/dashboard', async (request) => {
    const userId = request.auth.userId;
    const now = new Date();

    // ── Week boundaries (Mon–Sun, UTC) ─────────────────────────────
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    // ── Month boundaries ───────────────────────────────────────────
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    // ── ISO week number ────────────────────────────────────────────
    const weekNumber = getISOWeekNumber(weekStart);

    // ── Query 1: Week entries grouped by date + project ────────────
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
        DATE(te.started_at AT TIME ZONE 'UTC') AS entry_date,
        te.project_id,
        p.name AS project_name,
        p.color AS project_color,
        c.name AS client_name,
        COUNT(*)::text AS entry_count,
        COALESCE(SUM(
          CASE
            WHEN te.stopped_at IS NULL
            THEN EXTRACT(EPOCH FROM NOW() - te.started_at)
            ELSE te.duration_seconds
          END
        ), 0)::text AS total_seconds
      FROM time_entries te
      LEFT JOIN projects p ON p.id = te.project_id
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE te.user_id = ${userId}
        AND te.started_at >= ${weekStart}
        AND te.started_at <= ${weekEnd}
      GROUP BY DATE(te.started_at AT TIME ZONE 'UTC'), te.project_id, p.name, p.color, c.name
      ORDER BY entry_date
    `);

    // ── Query 2: Month entries grouped by date ─────────────────────
    const monthResult = await db.execute<{
      entry_date: string;
      total_seconds: string;
    }>(sql`
      SELECT
        DATE(started_at AT TIME ZONE 'UTC') AS entry_date,
        COALESCE(SUM(
          CASE
            WHEN stopped_at IS NULL
            THEN EXTRACT(EPOCH FROM NOW() - started_at)
            ELSE duration_seconds
          END
        ), 0)::text AS total_seconds
      FROM time_entries
      WHERE user_id = ${userId}
        AND started_at >= ${monthStart}
        AND started_at <= ${monthEnd}
      GROUP BY DATE(started_at AT TIME ZONE 'UTC')
      ORDER BY entry_date
    `);

    // ── Derive weekDays (7 items, Mon–Sun) ─────────────────────────
    const weekRows = weekResult.rows;
    const monthRows = monthResult.rows;
    const weekDayTotals = new Map<string, number>();
    let noProjectCount = 0;

    for (const row of weekRows) {
      const dateStr = typeof row.entry_date === 'string'
        ? row.entry_date.slice(0, 10)
        : new Date(row.entry_date).toISOString().slice(0, 10);
      const seconds = Math.round(Number(row.total_seconds));
      weekDayTotals.set(dateStr, (weekDayTotals.get(dateStr) ?? 0) + seconds);

      if (row.project_id === null) {
        noProjectCount += Number(row.entry_count);
      }
    }

    const todayStr = now.toISOString().slice(0, 10);
    const weekDays: DashboardData['weekDays'] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setUTCDate(weekStart.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
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
    const elapsedWeekdays = weekDays.filter(
      (d) => d.dayOfWeek <= 5 && d.date <= todayStr,
    );
    let lowDay: DashboardData['attention']['lowDay'] = null;
    if (elapsedWeekdays.length > 0) {
      const min = elapsedWeekdays.reduce((a, b) =>
        a.totalSeconds <= b.totalSeconds ? a : b,
      );
      lowDay = { dayLabel: min.dayLabel, totalSeconds: min.totalSeconds };
    }

    // ── Week avg per day ───────────────────────────────────────────
    const weekdayTotal = elapsedWeekdays.reduce((s, d) => s + d.totalSeconds, 0);
    const weekAvgPerDaySeconds =
      elapsedWeekdays.length > 0
        ? Math.round(weekdayTotal / elapsedWeekdays.length)
        : 0;

    // ── Heatmap days (full month calendar grid) ────────────────────
    const monthTotalsMap = new Map<string, number>();
    for (const row of monthRows) {
      const dateStr = typeof row.entry_date === 'string'
        ? row.entry_date.slice(0, 10)
        : new Date(row.entry_date).toISOString().slice(0, 10);
      monthTotalsMap.set(dateStr, Math.round(Number(row.total_seconds)));
    }

    const heatmapDays: DashboardData['heatmapDays'] = [];
    const daysInMonth = monthEnd.getUTCDate();
    // Determine the weekIndex of the first day
    const firstDayDow = monthStart.getUTCDay(); // 0=Sun
    const firstDayIso = firstDayDow === 0 ? 7 : firstDayDow; // 1=Mon, 7=Sun
    let currentWeekIndex = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
      const dateStr = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay();
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
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    for (let d = new Date(tomorrow); d <= monthEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay();
      if (dow >= 1 && dow <= 5) workingDaysLeft++;
    }

    // ── Month label ────────────────────────────────────────────────
    const monthLabel = monthStart.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    // ── Project breakdown (week, sorted desc) ──────────────────────
    const projectMap = new Map<
      string,
      { projectId: string | null; projectName: string; projectColor: string; clientName: string | null; totalSeconds: number }
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
          weekTotalSeconds > 0
            ? Math.round((p.totalSeconds / weekTotalSeconds) * 100)
            : 0,
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
