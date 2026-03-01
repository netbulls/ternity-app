import { useState, useMemo } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Loader2,
  Timer,
  Play,
  Square,
  Pencil,
  Plus,
  Minus,
  Trash2,
  ArrowRightLeft,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatDuration, formatTime, formatDateLabel } from '@/lib/format';
import { ORG_TIMEZONE } from '@ternity/shared';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useEntryAudit } from '@/hooks/use-entries';
import { useElapsedSeconds } from '@/hooks/use-timer';
import type { Entry, Segment, AuditEvent } from '@ternity/shared';

interface Props {
  entry: Entry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AuditAction = AuditEvent['action'];

const actionConfig: Record<
  AuditAction,
  {
    label: string;
    icon: typeof Plus;
    iconColor: string;
  }
> = {
  created: { label: 'Created entry', icon: Plus, iconColor: 'text-primary' },
  updated: { label: 'Updated entry', icon: Pencil, iconColor: 'text-chart-3' },
  deleted: { label: 'Deleted entry', icon: Trash2, iconColor: 'text-destructive' },
  timer_started: { label: 'Started timer', icon: Play, iconColor: 'text-primary' },
  timer_stopped: { label: 'Stopped timer', icon: Square, iconColor: 'text-blue-500' },
  timer_resumed: { label: 'Resumed timer', icon: Timer, iconColor: 'text-blue-500' },
  adjustment_added: { label: 'Added adjustment', icon: Plus, iconColor: 'text-chart-3' },
  block_moved: { label: 'Moved time block', icon: ArrowRightLeft, iconColor: 'text-chart-3' },
  entry_split: { label: 'Split time', icon: ArrowUpRight, iconColor: 'text-chart-3' },
};

const fieldLabels: Record<string, string> = {
  description: 'Description',
  project: 'Project',
  startedAt: 'Start time',
  stoppedAt: 'End time',
  durationSeconds: 'Duration',
  tagIds: 'Tags',
  segmentId: 'Time block',
  movedToEntryId: 'Moved to entry',
  movedFromEntryId: 'Moved from entry',
  splitToEntryId: 'Split to entry',
  splitFromEntryId: 'Split from entry',
};

function formatSignedDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${h > 0 ? String(m).padStart(2, '0') : String(m)}m`);
  if (s > 0 && h === 0) parts.push(`${m > 0 ? String(s).padStart(2, '0') : String(s)}s`);
  const sign = seconds >= 0 ? '+' : '\u2212';
  return `${sign}${parts.join(' ') || '0s'}`;
}

/** Like formatDuration but shows seconds when under 1 minute */
function formatBlockDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 60) return `${abs}s`;
  return formatDuration(abs);
}

/** Always includes seconds — used for running segments */
function formatLiveDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (field === 'durationSeconds' && typeof value === 'number') {
    return formatDuration(value);
  }
  if ((field === 'startedAt' || field === 'stoppedAt') && typeof value === 'string') {
    return formatTime(value);
  }
  if (typeof value === 'string' && value === '') return '(empty)';
  if (Array.isArray(value)) return value.length === 0 ? '(none)' : `${value.length} tags`;
  return String(value);
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/** Get the YYYY-MM-DD date of an ISO timestamp in the org timezone */
function getOrgDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

/* ── Day-grouped segment timeline ────────────────────────────────── */

interface SegmentDayGroup {
  date: string; // YYYY-MM-DD
  totalSeconds: number;
  segments: Segment[];
  auditEvents: AuditEvent[]; // non-timer audit events that belong to this day
}

/** Parse move-adjustment notes: "moved:{segmentId}:{description}" */
function parseMoveNote(note: string | null): { segmentId: string; targetName: string } | null {
  if (!note) return null;
  const match = note.match(/^moved:([^:]+)(?::(.*))?$/);
  if (!match) return null;
  return { segmentId: match[1]!, targetName: match[2] ?? '' };
}

/** Group segments by day (org timezone), newest day first, segments chronological within day */
function buildSegmentDayGroups(segments: Segment[], auditEvents: AuditEvent[]): SegmentDayGroup[] {
  // Filter out move-adjustment segments
  const visibleSegments = segments.filter((s) => !parseMoveNote(s.note));

  const dayMap = new Map<
    string,
    { totalSeconds: number; segments: Segment[]; auditEvents: AuditEvent[] }
  >();

  for (const seg of visibleSegments) {
    const date = getOrgDate(seg.startedAt ?? seg.createdAt);
    if (!dayMap.has(date)) {
      dayMap.set(date, { totalSeconds: 0, segments: [], auditEvents: [] });
    }
    const group = dayMap.get(date)!;
    group.segments.push(seg);
    group.totalSeconds += seg.durationSeconds ?? 0;
  }

  // Place non-timer audit events into their respective days
  const timerActions = new Set<string>(['timer_started', 'timer_stopped', 'timer_resumed']);
  for (const event of auditEvents) {
    if (timerActions.has(event.action)) continue;
    const date = getOrgDate(event.createdAt);
    if (!dayMap.has(date)) {
      dayMap.set(date, { totalSeconds: 0, segments: [], auditEvents: [] });
    }
    dayMap.get(date)!.auditEvents.push(event);
  }

  // Sort days newest first
  const sortedDates = Array.from(dayMap.keys()).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((date) => {
    const group = dayMap.get(date)!;
    // Segments are already in chronological order from the API
    return {
      date,
      totalSeconds: group.totalSeconds,
      segments: group.segments,
      auditEvents: group.auditEvents,
    };
  });
}

/* ── Segment row (timeline item within a day) ────────────────────── */

function SegmentRow({
  segment,
  isLast,
  isMoved,
  movedToName,
}: {
  segment: Segment;
  isLast: boolean;
  isMoved: boolean;
  movedToName?: string;
}) {
  const isAdjustment = !segment.startedAt;
  const isRunning = segment.type === 'clocked' && !segment.stoppedAt;
  const liveElapsed = useElapsedSeconds(segment.startedAt, isRunning);
  const displayDuration = segment.durationSeconds ?? (isRunning ? liveElapsed : null);
  const isNegative = (displayDuration ?? 0) < 0;
  const isClocked = segment.type === 'clocked';

  return (
    <div
      className={cn('group/block relative grid items-center gap-2', isMoved && 'opacity-50')}
      style={{
        gridTemplateColumns: '16px 1fr auto',
        padding: '6px 0',
      }}
    >
      {/* Timeline connector line */}
      {!isLast && (
        <div className="absolute left-[7px] top-[24px] bottom-[-6px] w-px bg-border/50" />
      )}

      {/* Timeline dot */}
      <div className="flex justify-center">
        {isAdjustment ? (
          <div className="relative z-[1] flex h-2 w-2 items-center justify-center">
            {isNegative ? (
              <Minus className="h-2.5 w-2.5 text-muted-foreground/40" />
            ) : (
              <Plus className="h-2.5 w-2.5 text-muted-foreground/40" />
            )}
          </div>
        ) : isRunning ? (
          <span className="relative z-[1] flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        ) : (
          <div
            className={cn(
              'relative z-[1] h-2 w-2 rounded-full border-2 bg-background',
              isMoved
                ? 'border-muted-foreground/30 border-dashed'
                : isClocked
                  ? 'border-primary'
                  : 'border-muted-foreground/40 border-dashed',
            )}
          />
        )}
      </div>

      {/* Time info */}
      <div style={{ fontSize: scaled(11) }}>
        {isAdjustment ? (
          <span className="text-muted-foreground">{segment.note || 'Adjustment'}</span>
        ) : (
          <span className="text-muted-foreground">
            <span
              className={cn(
                'font-medium',
                isMoved ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {formatTime(segment.startedAt!)}
            </span>
            <span className="mx-1 opacity-40">&ndash;</span>
            <span
              className={cn(
                'font-medium',
                isMoved ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {segment.stoppedAt ? formatTime(segment.stoppedAt) : 'now'}
            </span>
            {isMoved ? (
              <span
                className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-border/50 px-1 py-px text-muted-foreground/60"
                style={{ fontSize: scaled(9) }}
              >
                <ArrowUpRight className="h-2 w-2" />
                {movedToName || 'Moved'}
              </span>
            ) : isClocked ? (
              <Timer className="ml-1.5 inline h-2.5 w-2.5 text-primary/50" />
            ) : (
              <Pencil className="ml-1.5 inline h-2.5 w-2.5 text-muted-foreground/40" />
            )}
          </span>
        )}
      </div>

      {/* Duration */}
      <span
        className={cn(
          'font-brand text-right font-semibold tabular-nums',
          isMoved
            ? 'text-muted-foreground/40 line-through'
            : isNegative
              ? 'text-destructive/70'
              : 'text-foreground',
        )}
        style={{ fontSize: scaled(11), minWidth: '44px' }}
      >
        {displayDuration != null
          ? (isNegative ? '\u2212' : '') +
            (isRunning ? formatLiveDuration(displayDuration) : formatBlockDuration(displayDuration))
          : '\u2014'}
      </span>
    </div>
  );
}

/* ── Audit event card (for non-timer events shown within day groups) */

function AuditEventCard({ event }: { event: AuditEvent }) {
  const source =
    event.metadata && typeof (event.metadata as Record<string, unknown>).source === 'string'
      ? ((event.metadata as Record<string, unknown>).source as string).replace(/_/g, ' ')
      : null;
  const hasChanges = event.changes && Object.keys(event.changes).length > 0;
  const [expanded, setExpanded] = useState(false);

  // For adjustments, derive sign-aware label, icon, and color from the durationSeconds
  const isAdjustment = event.action === 'adjustment_added';
  const adjDuration =
    isAdjustment && event.changes?.durationSeconds?.new != null
      ? (event.changes.durationSeconds.new as number)
      : null;
  const isPositiveAdj = adjDuration !== null && adjDuration >= 0;

  const config = isAdjustment
    ? {
        label: isPositiveAdj ? 'Added time' : 'Removed time',
        icon: isPositiveAdj ? Plus : Minus,
        iconColor: isPositiveAdj ? 'text-primary' : 'text-destructive',
      }
    : actionConfig[event.action];
  const Icon = config.icon;

  const barContent = (
    <>
      {/* Chevron or spacer */}
      {hasChanges ? (
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200',
            expanded && 'rotate-90',
          )}
        />
      ) : (
        <span className="w-3 shrink-0" />
      )}

      {/* Icon */}
      <Icon className={cn('h-3.5 w-3.5 shrink-0', config.iconColor)} />

      {/* Action label */}
      <span style={{ fontSize: scaled(12) }} className="font-medium text-foreground">
        {config.label}
      </span>

      {/* Adjustment duration — shown inline on the bar */}
      {adjDuration !== null && (
        <span
          className={cn(
            'font-brand font-semibold tabular-nums',
            isPositiveAdj ? 'text-primary' : 'text-destructive',
          )}
          style={{ fontSize: scaled(12) }}
        >
          {formatSignedDuration(adjDuration)}
        </span>
      )}

      {/* Source */}
      {source && (
        <span className="text-muted-foreground/40" style={{ fontSize: scaled(10) }}>
          {source}
        </span>
      )}

      {/* Timestamp */}
      <span
        className="ml-auto shrink-0 tabular-nums text-muted-foreground/60"
        style={{ fontSize: scaled(11) }}
      >
        {formatRelativeTime(event.createdAt)}
      </span>
    </>
  );

  return (
    <div>
      {/* Bar — same visual style as session bars */}
      {hasChanges ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors"
          style={{ background: 'hsl(var(--muted) / 0.3)' }}
        >
          {barContent}
        </button>
      ) : (
        <div
          className="flex items-center gap-2.5 rounded-md px-3 py-2"
          style={{ background: 'hsl(var(--muted) / 0.3)' }}
        >
          {barContent}
        </div>
      )}

      {/* Expanded: actor + change details */}
      {hasChanges && expanded && (
        <div className="ml-5 mt-1 space-y-1.5 border-l border-border/50 pl-3 pb-1">
          {/* Actor */}
          <div
            className="flex items-center gap-1.5 py-1 text-muted-foreground"
            style={{ fontSize: scaled(11) }}
          >
            <span>{event.actorName}</span>
          </div>

          {/* Changes */}
          {Object.entries(event.changes!).map(([field, change]) => {
            // For adjustment durationSeconds, show with sign instead of formatDuration
            const isAdjDuration = isAdjustment && field === 'durationSeconds';
            return (
              <div
                key={field}
                className="rounded-md px-2.5 py-1.5"
                style={{ background: 'hsl(var(--muted) / 0.2)' }}
              >
                <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  {fieldLabels[field] ?? field}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5" style={{ fontSize: scaled(12) }}>
                  {change.old !== undefined && (
                    <span className="text-muted-foreground/50 line-through">
                      {formatFieldValue(field, change.old)}
                    </span>
                  )}
                  {change.old !== undefined && change.new !== undefined && (
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                  )}
                  {change.new !== undefined && (
                    <span
                      className={cn(
                        'font-medium',
                        isAdjDuration && (change.new as number) >= 0 && 'text-primary',
                        isAdjDuration && (change.new as number) < 0 && 'text-destructive',
                        !isAdjDuration && 'text-foreground',
                      )}
                    >
                      {isAdjDuration
                        ? formatSignedDuration(change.new as number)
                        : formatFieldValue(field, change.new)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Day group in the timeline ───────────────────────────────────── */

function DayTimelineGroup({
  group,
  movedSegmentIds,
  movedToNames,
}: {
  group: SegmentDayGroup;
  movedSegmentIds: Set<string>;
  movedToNames: Map<string, string>;
}) {
  const runningSegment = group.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);
  const liveElapsed = useElapsedSeconds(runningSegment?.startedAt ?? null, !!runningSegment);
  const dayTotal = group.totalSeconds + (runningSegment ? liveElapsed : 0);

  return (
    <div className="mb-3">
      {/* Day header */}
      <div
        className="flex items-center justify-between rounded-md px-3 py-1.5"
        style={{ background: 'hsl(var(--muted) / 0.4)' }}
      >
        <span
          className="font-brand font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ fontSize: scaled(10) }}
        >
          {formatDateLabel(group.date)}
        </span>
        <span
          className="font-brand font-semibold tabular-nums text-foreground"
          style={{ fontSize: scaled(11) }}
        >
          {runningSegment ? formatLiveDuration(dayTotal) : formatDuration(group.totalSeconds)}
        </span>
      </div>

      {/* Segments timeline within this day */}
      <div className="mt-1 px-2">
        {group.segments.map((segment, i) => (
          <SegmentRow
            key={segment.id}
            segment={segment}
            isLast={i === group.segments.length - 1 && group.auditEvents.length === 0}
            isMoved={movedSegmentIds.has(segment.id)}
            movedToName={movedToNames.get(segment.id)}
          />
        ))}
      </div>

      {/* Non-timer audit events for this day */}
      {group.auditEvents.length > 0 && (
        <div className="mt-1 space-y-1">
          {group.auditEvents.map((event) => (
            <AuditEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Live duration ───────────────────────────────────────────────── */

function LiveDuration({ startedAt, offset = 0 }: { startedAt: string; offset?: number }) {
  const elapsed = useElapsedSeconds(startedAt, true, offset);
  return <span className="font-brand font-semibold text-primary">{formatDuration(elapsed)}</span>;
}

/* ── Panel ────────────────────────────────────────────────────────── */

export function AuditPanel({ entry, open, onOpenChange }: Props) {
  const { data: events, isLoading } = useEntryAudit(open && entry ? entry.id : null);

  if (!entry) return null;

  const isRunning = entry.isRunning;
  const completedDuration = entry.segments
    .filter((s) => s.durationSeconds != null)
    .reduce((sum, s) => sum + s.durationSeconds!, 0);
  const runningSegment = entry.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);

  // Build moved segment tracking
  const movedSegmentIds = new Set<string>();
  const movedToNames = new Map<string, string>();
  for (const seg of entry.segments) {
    const move = parseMoveNote(seg.note);
    if (move) {
      movedSegmentIds.add(move.segmentId);
      movedToNames.set(move.segmentId, move.targetName);
    }
  }

  // Build day-grouped segment timeline
  const dayGroups = useMemo(
    () => buildSegmentDayGroups(entry.segments, events ?? []),
    [entry.segments, events],
  );

  // Find the creation event (oldest = last in our DESC-sorted array)
  const creationEvent = events
    ? [...events].reverse().find((e) => e.action === 'created' || e.action === 'timer_started')
    : undefined;
  const createdAtStr = creationEvent
    ? new Date(creationEvent.createdAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle
            className="font-brand uppercase text-muted-foreground"
            style={{ fontSize: scaled(10), letterSpacing: '2px' }}
          >
            Entry History
          </SheetTitle>
          <SheetDescription className="sr-only">Audit timeline for this entry</SheetDescription>
        </SheetHeader>

        {/* Entry summary */}
        <div
          className={cn(
            'mt-4 rounded-lg border p-3',
            isRunning ? 'border-primary/30' : 'border-border',
          )}
        >
          <div style={{ fontSize: scaled(13) }} className="truncate font-medium text-foreground">
            {entry.description || 'No description'}
          </div>
          <div className="mt-2 space-y-1.5" style={{ fontSize: scaled(11) }}>
            {entry.projectName && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.projectColor ?? '#00D4AA' }}
                />
                <span className="truncate">
                  {entry.clientName ? `${entry.clientName} · ` : ''}
                  {entry.projectName}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 tabular-nums text-muted-foreground">
              <span>
                {dayGroups.length === 1
                  ? formatDateLabel(dayGroups[0]!.date)
                  : `${dayGroups.length} days`}
              </span>
              <span className="opacity-30">|</span>
              {isRunning && runningSegment?.startedAt ? (
                <LiveDuration startedAt={runningSegment.startedAt} offset={completedDuration} />
              ) : (
                <span className="font-brand font-semibold text-foreground">
                  {formatDuration(entry.totalDurationSeconds)}
                </span>
              )}
            </div>
            {createdAtStr && (
              <div className="text-muted-foreground/40" style={{ fontSize: scaled(10) }}>
                Created {createdAtStr}
                {creationEvent && creationEvent.action === 'timer_started' && ' via timer'}
              </div>
            )}
          </div>
        </div>

        {/* Segment count + day count */}
        {entry.segments.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span
              className="font-brand uppercase tracking-wider text-muted-foreground/50"
              style={{ fontSize: scaled(9) }}
            >
              {entry.segments.length} {entry.segments.length === 1 ? 'block' : 'blocks'}
              {dayGroups.length > 1 && ` · ${dayGroups.length} days`}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        {/* Day-grouped timeline */}
        <div className="mt-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {isLoading ? (
            <div
              className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
              style={{ fontSize: scaled(13) }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history...
            </div>
          ) : dayGroups.length === 0 ? (
            <div
              className="py-8 text-center text-muted-foreground/50"
              style={{ fontSize: scaled(13) }}
            >
              No history recorded yet
            </div>
          ) : (
            <div>
              {dayGroups.map((group) => (
                <DayTimelineGroup
                  key={group.date}
                  group={group}
                  movedSegmentIds={movedSegmentIds}
                  movedToNames={movedToNames}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
