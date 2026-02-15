import { z } from 'zod';

// ── Attention cards ───────────────────────────────────────────────────────

const AttentionDataSchema = z.object({
  noProjectCount: z.number(),
  weekTotalSeconds: z.number(),
  weekTargetSeconds: z.number(),
  weekPercentage: z.number(),
  lowDay: z
    .object({
      dayLabel: z.string(),
      totalSeconds: z.number(),
    })
    .nullable(),
});

// ── Week histogram ────────────────────────────────────────────────────────

const WeekDaySchema = z.object({
  date: z.string(),
  dayOfWeek: z.number(),
  dayLabel: z.string(),
  totalSeconds: z.number(),
});

// ── Month heatmap ─────────────────────────────────────────────────────────

const HeatmapDaySchema = z.object({
  date: z.string(),
  dayOfMonth: z.number(),
  dayOfWeek: z.number(),
  weekIndex: z.number(),
  totalSeconds: z.number(),
});

// ── Project breakdown ─────────────────────────────────────────────────────

const ProjectBreakdownItemSchema = z.object({
  projectId: z.string().nullable(),
  projectName: z.string(),
  projectColor: z.string(),
  clientName: z.string().nullable(),
  totalSeconds: z.number(),
  percentage: z.number(),
});

// ── Dashboard response ────────────────────────────────────────────────────

export const DashboardDataSchema = z.object({
  weekNumber: z.number(),
  weekStart: z.string(),
  weekEnd: z.string(),

  attention: AttentionDataSchema,

  weekDays: z.array(WeekDaySchema),

  monthLabel: z.string(),
  heatmapDays: z.array(HeatmapDaySchema),
  monthTotalSeconds: z.number(),
  workingDaysLeft: z.number(),

  weekAvgPerDaySeconds: z.number(),

  projectBreakdown: z.array(ProjectBreakdownItemSchema),
});

export type DashboardData = z.infer<typeof DashboardDataSchema>;
