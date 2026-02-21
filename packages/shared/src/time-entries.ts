import { z } from 'zod';

/* ── Label nested in an entry ───────────────────────────────────── */

export const EntryLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export type EntryLabel = z.infer<typeof EntryLabelSchema>;

/* ── Entry (returned from API) ──────────────────────────────────── */

export const EntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  projectColor: z.string().nullable(),
  clientName: z.string().nullable(),
  labels: z.array(EntryLabelSchema),
  startedAt: z.string(), // ISO 8601
  stoppedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(), // null when running
  createdAt: z.string(), // ISO 8601
  userId: z.string(),
});

export type Entry = z.infer<typeof EntrySchema>;

/* ── Timer state ────────────────────────────────────────────────── */

export const TimerStateSchema = z.object({
  running: z.boolean(),
  entry: EntrySchema.nullable(),
});

export type TimerState = z.infer<typeof TimerStateSchema>;

/* ── Day group (entries grouped by date) ────────────────────────── */

export const DayGroupSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  totalSeconds: z.number(),
  entries: z.array(EntrySchema),
});

export type DayGroup = z.infer<typeof DayGroupSchema>;

/* ── Create / Update payloads ───────────────────────────────────── */

export const CreateEntrySchema = z.object({
  description: z.string().default(''),
  projectId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).default([]),
  startedAt: z.string(), // ISO 8601
  stoppedAt: z.string(), // ISO 8601
});

export type CreateEntry = z.infer<typeof CreateEntrySchema>;

export const UpdateEntrySchema = z.object({
  description: z.string().optional(),
  projectId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  startedAt: z.string().optional(),
  stoppedAt: z.string().nullable().optional(),
});

export type UpdateEntry = z.infer<typeof UpdateEntrySchema>;

/* ── Start timer payload ────────────────────────────────────────── */

export const StartTimerSchema = z.object({
  description: z.string().default(''),
  projectId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).default([]),
});

export type StartTimer = z.infer<typeof StartTimerSchema>;

/* ── Audit event (returned from API) ───────────────────────────── */

export const AuditEventSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  action: z.enum([
    'created',
    'updated',
    'deleted',
    'timer_started',
    'timer_stopped',
    'timer_resumed',
  ]),
  actorId: z.string(),
  actorName: z.string(),
  changes: z
    .record(
      z.string(),
      z.object({
        old: z.unknown().optional(),
        new: z.unknown().optional(),
      }),
    )
    .nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(), // ISO 8601
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

/* ── Stats ──────────────────────────────────────────────────────── */

export const StatsSchema = z.object({
  todaySeconds: z.number(),
  weekSeconds: z.number(),
});

export type Stats = z.infer<typeof StatsSchema>;
