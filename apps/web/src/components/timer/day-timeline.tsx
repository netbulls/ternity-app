import { useMemo } from 'react';
import { formatDuration } from '@/lib/format';
import { scaled } from '@/lib/scaled';
import type { Entry } from '@ternity/shared';

interface Props {
  /** YYYY-MM-DD — which day to render the timeline for */
  date: string;
  entries: Entry[];
}

/** Working-hours window: 7 AM – 19 PM (12 hours) */
const HOUR_START = 7;
const HOUR_END = 19;
const TOTAL_HOURS = HOUR_END - HOUR_START;

/** Default project colors (matching --t-project-* tokens) */
const PROJECT_COLORS = [
  'hsl(var(--t-project-1))',
  'hsl(var(--t-project-2))',
  'hsl(var(--t-project-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface TimeBlock {
  /** 0–1 position within the strip */
  left: number;
  /** 0–1 width within the strip */
  width: number;
  /** Display color */
  color: string;
  /** Entry description (for tooltip) */
  label: string;
  /** Whether this block is still running */
  running: boolean;
  /** Duration of this block in seconds (clamped to today) */
  durationSeconds: number;
}

/**
 * Build the day boundaries for a YYYY-MM-DD string.
 * Returns midnight-to-midnight timestamps for that date in the local timezone.
 */
function getDayBounds(date: string): { dayStartMs: number; dayEndMs: number } {
  const d = new Date(date + 'T00:00:00');
  const dayStartMs = d.getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  return { dayStartMs, dayEndMs };
}

/**
 * Convert entries + their segments into positioned blocks on a day timeline.
 * Only includes the portion of each segment that overlaps with the given date.
 * Returns { blocks, todaySeconds } where todaySeconds counts only time within this day.
 */
function buildTimeline(
  entries: Entry[],
  date: string,
): { blocks: TimeBlock[]; todaySeconds: number } {
  const projectColorMap = new Map<string, string>();
  let colorIdx = 0;

  function getColor(projectId: string | null, projectColor: string | null | undefined): string {
    if (projectColor) return projectColor;
    if (!projectId) return 'hsl(var(--muted-foreground))';
    if (!projectColorMap.has(projectId)) {
      projectColorMap.set(projectId, PROJECT_COLORS[colorIdx % PROJECT_COLORS.length]!);
      colorIdx++;
    }
    return projectColorMap.get(projectId)!;
  }

  const { dayStartMs, dayEndMs } = getDayBounds(date);
  const windowStartMin = HOUR_START * 60; // minutes from midnight for display window
  const windowEndMin = HOUR_END * 60;
  const windowSpan = windowEndMin - windowStartMin;

  const blocks: TimeBlock[] = [];
  let todaySeconds = 0;

  for (const entry of entries) {
    const color = getColor(entry.projectId, entry.projectColor);

    for (const seg of entry.segments) {
      if (!seg.startedAt) continue; // skip pure adjustments

      const segStartMs = new Date(seg.startedAt).getTime();
      const segEndMs = seg.stoppedAt ? new Date(seg.stoppedAt).getTime() : Date.now();

      // Clamp segment to this day's boundaries
      const clampedStartMs = Math.max(segStartMs, dayStartMs);
      const clampedEndMs = Math.min(segEndMs, dayEndMs);

      if (clampedEndMs <= clampedStartMs) continue; // no overlap with this day

      // Count this segment's today-only duration
      const segDuration = Math.round((clampedEndMs - clampedStartMs) / 1000);
      todaySeconds += segDuration;

      // Convert to minutes-from-midnight for timeline positioning
      const startOfDay = new Date(date + 'T00:00:00');
      const startMin = (clampedStartMs - startOfDay.getTime()) / 60000;
      const endMin = (clampedEndMs - startOfDay.getTime()) / 60000;

      // Clamp to the visible display window
      const visStart = Math.max(startMin, windowStartMin);
      const visEnd = Math.min(endMin, windowEndMin);

      if (visEnd <= visStart) continue; // outside display window

      blocks.push({
        left: (visStart - windowStartMin) / windowSpan,
        width: (visEnd - visStart) / windowSpan,
        color,
        label: entry.description || '(no description)',
        running: !seg.stoppedAt,
        durationSeconds: segDuration,
      });
    }

    // Also count adjustment segments (no startedAt, just durationSeconds)
    for (const seg of entry.segments) {
      if (seg.startedAt) continue; // already handled above
      if (seg.durationSeconds == null) continue;

      // Adjustment segments are timestamped by createdAt — check if it belongs to this day
      const createdMs = new Date(seg.createdAt).getTime();
      if (createdMs >= dayStartMs && createdMs < dayEndMs) {
        todaySeconds += seg.durationSeconds;
      }
    }
  }

  return { blocks, todaySeconds };
}

/** Get the "now" position as a 0–1 fraction within the timeline, or null if outside window */
function getNowPosition(): number | null {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const dayStart = HOUR_START * 60;
  const dayEnd = HOUR_END * 60;
  if (min < dayStart || min > dayEnd) return null;
  return (min - dayStart) / (dayEnd - dayStart);
}

function getTimelineLabel(date: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (date === today) return 'Today\u2019s Timeline';
  const d = new Date(date + 'T12:00:00');
  const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
  return `${dayName}\u2019s Timeline`;
}

export function DayTimeline({ date, entries }: Props) {
  const { blocks, todaySeconds } = useMemo(() => buildTimeline(entries, date), [entries, date]);

  const isToday = date === new Date().toISOString().slice(0, 10);
  const nowPos = isToday ? getNowPosition() : null;

  const timelineLabel = getTimelineLabel(date);

  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i);

  return (
    <div
      className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))]"
      style={{ padding: `${scaled(16)} ${scaled(20)}` }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-brand font-semibold uppercase text-muted-foreground"
          style={{ fontSize: scaled(10), letterSpacing: '2px' }}
        >
          {timelineLabel}
        </span>
        <span
          className="font-brand font-bold tabular-nums text-primary"
          style={{ fontSize: scaled(13) }}
        >
          {formatDuration(todaySeconds)} tracked
        </span>
      </div>

      {/* Timeline strip */}
      <div
        className="relative overflow-hidden rounded-md bg-[hsl(var(--muted))]"
        style={{ height: scaled(40) }}
      >
        {/* Hour grid lines */}
        <div className="absolute inset-0 flex">
          {hours.slice(0, -1).map((h) => (
            <div key={h} className="flex-1 border-r border-[hsl(var(--border)/0.3)]" />
          ))}
        </div>

        {/* Work blocks */}
        {blocks.map((block, i) => (
          <div
            key={i}
            className="absolute top-[3px] rounded transition-opacity hover:opacity-100"
            style={{
              left: `${block.left * 100}%`,
              width: `${Math.max(block.width * 100, 0.5)}%`,
              height: 'calc(100% - 16px)',
              background: block.color,
              opacity: block.running ? 0.6 : 0.85,
              borderStyle: block.running ? 'dashed' : 'solid',
              borderWidth: block.running ? '1px' : '0',
              borderColor: block.color,
            }}
            title={block.label}
          >
            {block.width > 0.06 && (
              <span
                className="block truncate px-1.5 font-semibold text-[hsl(var(--background))]"
                style={{ fontSize: scaled(8), lineHeight: `${scaled(24)}` }}
              >
                {block.label}
              </span>
            )}
          </div>
        ))}

        {/* NOW marker */}
        {nowPos !== null && (
          <div
            className="absolute top-0 bottom-0 z-10 w-[2px] bg-primary"
            style={{ left: `${nowPos * 100}%` }}
          >
            <span
              className="absolute font-brand font-bold text-primary"
              style={{
                fontSize: scaled(7),
                letterSpacing: '1px',
                top: '-13px',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              NOW
            </span>
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
              style={{
                width: '6px',
                height: '6px',
                boxShadow: '0 0 6px hsl(var(--primary) / 0.5)',
              }}
            />
          </div>
        )}
      </div>

      {/* Hour labels */}
      <div className="mt-1 flex justify-between px-0.5">
        {hours.map((h) => (
          <span
            key={h}
            className="font-brand tabular-nums text-muted-foreground opacity-50"
            style={{ fontSize: scaled(8) }}
          >
            {h}:00
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Utility: calculate today-only seconds for a set of entries.
 * Exported so the My Day page can use the same logic for its day group total.
 */
export function calcTodaySeconds(entries: Entry[], date: string): number {
  const { dayStartMs, dayEndMs } = getDayBounds(date);
  let total = 0;

  for (const entry of entries) {
    for (const seg of entry.segments) {
      if (seg.startedAt) {
        const segStartMs = new Date(seg.startedAt).getTime();
        const segEndMs = seg.stoppedAt ? new Date(seg.stoppedAt).getTime() : Date.now();
        const clampedStart = Math.max(segStartMs, dayStartMs);
        const clampedEnd = Math.min(segEndMs, dayEndMs);
        if (clampedEnd > clampedStart) {
          total += Math.round((clampedEnd - clampedStart) / 1000);
        }
      } else if (seg.durationSeconds != null) {
        // Adjustment segments — check createdAt
        const createdMs = new Date(seg.createdAt).getTime();
        if (createdMs >= dayStartMs && createdMs < dayEndMs) {
          total += seg.durationSeconds;
        }
      }
    }
  }

  return total;
}
