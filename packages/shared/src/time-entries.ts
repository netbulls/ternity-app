import { z } from 'zod';

/* ── Label nested in an entry ───────────────────────────────────── */

export const EntryLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export type EntryLabel = z.infer<typeof EntryLabelSchema>;

/* ── Segment (immutable timer record) ───────────────────────────── */

export const SegmentSchema = z.object({
  id: z.string(),
  type: z.enum(['clocked', 'manual']),
  startedAt: z.string().nullable(), // null for pure adjustments; set for clocked and manual entries
  stoppedAt: z.string().nullable(), // null while running (clocked) or for adjustments
  durationSeconds: z.number().nullable(), // null while running
  note: z.string().nullable(), // null for clocked; set for manual entries and adjustments
  createdAt: z.string(),
});

export type Segment = z.infer<typeof SegmentSchema>;

/* ── Entry (returned from API) ──────────────────────────────────── */

export const EntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  projectColor: z.string().nullable(),
  clientName: z.string().nullable(),
  labels: z.array(EntryLabelSchema),
  segments: z.array(SegmentSchema),
  totalDurationSeconds: z.number(), // sum of all segment durations
  isRunning: z.boolean(), // any clocked segment with stoppedAt=null
  isActive: z.boolean(), // false = soft-deleted
  createdAt: z.string(), // ISO 8601
  lastSegmentAt: z.string(), // ISO 8601 — most recent segment startedAt (or createdAt for adjustments)
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
  note: z.string().min(1), // required justification for manually entered time
});

export type CreateEntry = z.infer<typeof CreateEntrySchema>;

export const UpdateEntrySchema = z.object({
  description: z.string().optional(),
  projectId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
});

export type UpdateEntry = z.infer<typeof UpdateEntrySchema>;

/* ── Adjust entry payload (manual segment) ──────────────────────── */

export const AdjustEntrySchema = z.object({
  durationSeconds: z.number(),
  note: z.string().min(1),
});

export type AdjustEntry = z.infer<typeof AdjustEntrySchema>;

/* ── Move block payload ────────────────────────────────────────── */

export const MoveBlockSchema = z.object({
  segmentId: z.string(),
  description: z.string().optional(),
  projectId: z.string().nullable().optional(),
});

export type MoveBlock = z.infer<typeof MoveBlockSchema>;

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
    'adjustment_added',
    'block_moved',
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
