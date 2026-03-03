import { useState, useRef, useMemo } from 'react';
import { formatDuration } from '@/lib/format';
import { scaled } from '@/lib/scaled';
import { useTimelineFocus } from './timeline-focus-context';
import type { Entry } from '@ternity/shared';

interface Props {
  /** YYYY-MM-DD — which day to render the timeline for */
  date: string;
  entries: Entry[];
}

/** Default working-hours window: 7 AM – 19 PM */
const DEFAULT_HOUR_START = 7;
const DEFAULT_HOUR_END = 19;

/**
 * Compute the visible hour window by expanding the default 7–19 range
 * to include any entry segments that fall outside it.
 */
function getVisibleWindow(entries: Entry[], date: string): { hourStart: number; hourEnd: number } {
  let earliest = DEFAULT_HOUR_START;
  let latest = DEFAULT_HOUR_END;

  const { dayStartMs, dayEndMs } = getDayBounds(date);

  for (const entry of entries) {
    for (const seg of entry.segments) {
      if (!seg.startedAt) continue;

      const segStartMs = new Date(seg.startedAt).getTime();
      const segEndMs = seg.stoppedAt ? new Date(seg.stoppedAt).getTime() : Date.now();

      // Clamp to day boundaries
      const clampedStartMs = Math.max(segStartMs, dayStartMs);
      const clampedEndMs = Math.min(segEndMs, dayEndMs);
      if (clampedEndMs <= clampedStartMs) continue;

      const startOfDay = new Date(date + 'T00:00:00').getTime();
      const startHour = (clampedStartMs - startOfDay) / 3600000;
      const endHour = (clampedEndMs - startOfDay) / 3600000;

      earliest = Math.min(earliest, Math.floor(startHour));
      latest = Math.max(latest, Math.ceil(endHour));
    }
  }

  // Clamp to valid range
  earliest = Math.max(0, earliest);
  latest = Math.min(24, latest);

  return { hourStart: earliest, hourEnd: latest };
}

/** Default project colors (matching --t-project-* tokens) */
const PROJECT_COLORS = [
  'hsl(var(--t-project-1))',
  'hsl(var(--t-project-2))',
  'hsl(var(--t-project-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

/** A single segment's time range within the day */
interface SegmentSlice {
  /** Clamped start time (HH:MM) */
  startTime: string;
  /** Clamped end time (HH:MM) or "now" */
  endTime: string;
  /** Duration in seconds */
  durationSeconds: number;
  /** Whether this segment is still running */
  running: boolean;
}

interface TimeBlock {
  /** 0–1 position within the strip */
  left: number;
  /** 0–1 width within the strip */
  width: number;
  /** Display color */
  color: string;
  /** Entry description */
  label: string;
  /** Whether this block is still running */
  running: boolean;
  /** Duration of this block in seconds (clamped to today) */
  durationSeconds: number;
  /** Entry ID this block belongs to */
  entryId: string;
  /** Project name (for tooltip) */
  projectName: string | null;
  /** Project color (for tooltip dot) */
  projectColor: string | null;
  /** Index of this segment within the entry's today-segments */
  segmentIndex: number;
  /** All of this entry's segments that fall on this day */
  allDaySegments: SegmentSlice[];
  /** Total duration across all today-segments for this entry */
  entryTotalSeconds: number;
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

/** Format millisecond timestamp as HH:MM */
function formatMs(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Convert entries + their segments into positioned blocks on a day timeline.
 * Only includes the portion of each segment that overlaps with the given date.
 * Returns { blocks, todaySeconds } where todaySeconds counts only time within this day.
 */
function buildTimeline(
  entries: Entry[],
  date: string,
  hourStart: number,
  hourEnd: number,
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
  const windowStartMin = hourStart * 60;
  const windowEndMin = hourEnd * 60;
  const windowSpan = windowEndMin - windowStartMin;

  const blocks: TimeBlock[] = [];
  let todaySeconds = 0;

  for (const entry of entries) {
    const color = getColor(entry.projectId, entry.projectColor);

    // First pass: collect all day-segments for this entry (for tooltip)
    const allDaySegments: SegmentSlice[] = [];
    let entryTotalSeconds = 0;

    for (const seg of entry.segments) {
      if (!seg.startedAt) continue;

      const segStartMs = new Date(seg.startedAt).getTime();
      const segEndMs = seg.stoppedAt ? new Date(seg.stoppedAt).getTime() : Date.now();

      const clampedStartMs = Math.max(segStartMs, dayStartMs);
      const clampedEndMs = Math.min(segEndMs, dayEndMs);

      if (clampedEndMs <= clampedStartMs) continue;

      const dur = Math.round((clampedEndMs - clampedStartMs) / 1000);
      entryTotalSeconds += dur;

      allDaySegments.push({
        startTime: formatMs(clampedStartMs),
        endTime: seg.stoppedAt ? formatMs(clampedEndMs) : 'now',
        durationSeconds: dur,
        running: !seg.stoppedAt,
      });
    }

    // Also count adjustment-only durations towards entry total
    for (const seg of entry.segments) {
      if (seg.startedAt) continue;
      if (seg.durationSeconds == null) continue;
      const createdMs = new Date(seg.createdAt).getTime();
      if (createdMs >= dayStartMs && createdMs < dayEndMs) {
        entryTotalSeconds += seg.durationSeconds;
      }
    }

    // Second pass: build positioned blocks
    let segIdx = 0;
    for (const seg of entry.segments) {
      if (!seg.startedAt) continue;

      const segStartMs = new Date(seg.startedAt).getTime();
      const segEndMs = seg.stoppedAt ? new Date(seg.stoppedAt).getTime() : Date.now();

      const clampedStartMs = Math.max(segStartMs, dayStartMs);
      const clampedEndMs = Math.min(segEndMs, dayEndMs);

      if (clampedEndMs <= clampedStartMs) continue;

      const segDuration = Math.round((clampedEndMs - clampedStartMs) / 1000);
      todaySeconds += segDuration;

      const startOfDay = new Date(date + 'T00:00:00');
      const startMin = (clampedStartMs - startOfDay.getTime()) / 60000;
      const endMin = (clampedEndMs - startOfDay.getTime()) / 60000;

      const visStart = Math.max(startMin, windowStartMin);
      const visEnd = Math.min(endMin, windowEndMin);

      if (visEnd <= visStart) {
        segIdx++;
        continue;
      }

      blocks.push({
        left: (visStart - windowStartMin) / windowSpan,
        width: (visEnd - visStart) / windowSpan,
        color,
        label: entry.description || '(no description)',
        running: !seg.stoppedAt,
        durationSeconds: segDuration,
        entryId: entry.id,
        projectName: entry.projectName,
        projectColor: entry.projectColor,
        segmentIndex: segIdx,
        allDaySegments,
        entryTotalSeconds,
      });
      segIdx++;
    }

    // Count adjustment segments towards todaySeconds
    for (const seg of entry.segments) {
      if (seg.startedAt) continue;
      if (seg.durationSeconds == null) continue;
      const createdMs = new Date(seg.createdAt).getTime();
      if (createdMs >= dayStartMs && createdMs < dayEndMs) {
        todaySeconds += seg.durationSeconds;
      }
    }
  }

  return { blocks, todaySeconds };
}

/** Get the "now" position as a 0–1 fraction within the timeline, or null if outside window */
function getNowPosition(hourStart: number, hourEnd: number): number | null {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const dayStart = hourStart * 60;
  const dayEnd = hourEnd * 60;
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

/* ── Tooltip ──────────────────────────────────────────────────────── */

function BlockTooltip({ block, tooltipX }: { block: TimeBlock; tooltipX: number }) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hasMultiple = block.allDaySegments.length > 1;

  return (
    <div
      ref={tooltipRef}
      className="absolute z-30 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-2 shadow-lg"
      style={{
        left: `${tooltipX}px`,
        transform: 'translateX(-50%)',
        bottom: `calc(100% + 8px)`,
        maxWidth: '280px',
      }}
    >
      {/* Arrow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-popover"
        style={{ top: '100%' }}
      />

      {/* Project + description header */}
      <div className="mb-1.5">
        {block.projectName && (
          <div className="flex items-center gap-1.5" style={{ fontSize: scaled(10) }}>
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: block.projectColor ?? '#00D4AA' }}
            />
            <span className="text-muted-foreground">{block.projectName}</span>
          </div>
        )}
        <div
          className="truncate font-semibold text-foreground"
          style={{ fontSize: scaled(12), maxWidth: '250px' }}
        >
          {block.label}
        </div>
      </div>

      {/* Segment list */}
      <div className="flex flex-col gap-0.5">
        {block.allDaySegments.map((seg, i) => {
          const isActive = i === block.segmentIndex;
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded px-1.5 py-0.5"
              style={{
                fontSize: scaled(11),
                background: isActive ? 'hsl(var(--primary) / 0.1)' : 'transparent',
              }}
            >
              {/* Active indicator */}
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: isActive ? block.color : 'transparent',
                  boxShadow: isActive ? `0 0 4px ${block.color}` : 'none',
                }}
              />
              <span
                className={
                  isActive
                    ? 'font-semibold tabular-nums text-foreground'
                    : 'tabular-nums text-muted-foreground'
                }
              >
                {seg.startTime}
                <span className="mx-1 text-muted-foreground/50">&rarr;</span>
                {seg.running ? <span className="text-primary">now</span> : seg.endTime}
              </span>
              <span
                className={
                  isActive
                    ? 'ml-auto font-semibold text-foreground'
                    : 'ml-auto text-muted-foreground/70'
                }
              >
                {formatDuration(seg.durationSeconds)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total — only when multiple segments */}
      {hasMultiple && (
        <div
          className="mt-1.5 flex items-center justify-between border-t border-border/50 pt-1.5"
          style={{ fontSize: scaled(10) }}
        >
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold text-foreground">
            {formatDuration(block.entryTotalSeconds)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────── */

export function DayTimeline({ date, entries }: Props) {
  const { hourStart, hourEnd } = useMemo(() => getVisibleWindow(entries, date), [entries, date]);
  const totalHours = hourEnd - hourStart;

  const { blocks, todaySeconds } = useMemo(
    () => buildTimeline(entries, date, hourStart, hourEnd),
    [entries, date, hourStart, hourEnd],
  );

  const isToday = date === new Date().toISOString().slice(0, 10);
  const nowPos = isToday ? getNowPosition(hourStart, hourEnd) : null;

  const timelineLabel = getTimelineLabel(date);

  const hours = Array.from({ length: totalHours + 1 }, (_, i) => hourStart + i);

  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const { setHovered, select } = useTimelineFocus();

  const handleBlockHover = (index: number | null) => {
    setHoveredBlock(index);
    setHovered(index !== null ? (blocks[index]?.entryId ?? null) : null);
  };

  const handleBlockClick = (index: number) => {
    select(blocks[index]!.entryId);
  };

  return (
    <div
      className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))]"
      style={{ padding: `${scaled(10)} ${scaled(14)} ${scaled(14)}` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: scaled(4), minHeight: scaled(24) }}
      >
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

      {/* Timeline strip wrapper — relative so tooltip can overflow above */}
      <div ref={wrapperRef} className="relative">
        {/* Tooltip — rendered outside the strip to avoid clipping */}
        {hoveredBlock !== null && blocks[hoveredBlock] && (
          <BlockTooltip block={blocks[hoveredBlock]} tooltipX={tooltipX} />
        )}

        <div
          ref={stripRef}
          className="relative rounded-md bg-[hsl(var(--muted))]"
          style={{ height: scaled(32) }}
          onMouseLeave={() => handleBlockHover(null)}
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
              className="absolute top-[3px] flex items-center rounded cursor-pointer"
              style={{
                left: `${block.left * 100}%`,
                width: `${Math.max(block.width * 100, 0.5)}%`,
                height: 'calc(100% - 6px)',
                background: block.color,
                opacity: hoveredBlock === i ? 1 : block.running ? 0.6 : 0.85,
                borderStyle: block.running ? 'dashed' : 'solid',
                borderWidth: block.running ? '1px' : '0',
                borderColor: block.color,
                transition: 'opacity 0.15s',
                zIndex: hoveredBlock === i ? 5 : 1,
              }}
              onMouseEnter={(e) => {
                handleBlockHover(i);
                const rect = wrapperRef.current?.getBoundingClientRect();
                if (rect) setTooltipX(e.clientX - rect.left);
              }}
              onMouseMove={(e) => {
                const rect = wrapperRef.current?.getBoundingClientRect();
                if (rect) setTooltipX(e.clientX - rect.left);
              }}
              onClick={() => handleBlockClick(i)}
            >
              {block.width > 0.06 && (
                <span
                  className="block truncate px-1.5 font-semibold text-[hsl(var(--background))]"
                  style={{ fontSize: scaled(10) }}
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
 * Utility: calculate day-only seconds for a single entry.
 * Segments are clamped to the day boundaries so only time within the given day counts.
 * Running segments use Date.now() as the end time.
 */
export function calcEntryDaySeconds(entry: Entry, date: string): number {
  const { dayStartMs, dayEndMs } = getDayBounds(date);
  let total = 0;

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

  return total;
}

/**
 * Utility: calculate today-only seconds for a set of entries.
 * Exported so the My Day page can use the same logic for its day group total.
 */
export function calcTodaySeconds(entries: Entry[], date: string): number {
  let total = 0;
  for (const entry of entries) {
    total += calcEntryDaySeconds(entry, date);
  }
  return total;
}
