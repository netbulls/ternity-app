import { useState } from 'react';
import { ArrowRight, ChevronRight, Loader2, Timer, Play, Square, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatDuration, formatTime } from '@/lib/format';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useEntryAudit } from '@/hooks/use-entries';
import { useElapsedSeconds } from '@/hooks/use-timer';
import type { Entry, AuditEvent } from '@ternity/shared';

interface Props {
  entry: Entry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AuditAction = AuditEvent['action'];

const actionConfig: Record<AuditAction, {
  label: string;
  icon: typeof Plus;
  iconColor: string;
}> = {
  created: { label: 'Created entry', icon: Plus, iconColor: 'text-primary' },
  updated: { label: 'Updated entry', icon: Pencil, iconColor: 'text-chart-3' },
  deleted: { label: 'Deleted entry', icon: Trash2, iconColor: 'text-destructive' },
  timer_started: { label: 'Started timer', icon: Play, iconColor: 'text-primary' },
  timer_stopped: { label: 'Stopped timer', icon: Square, iconColor: 'text-blue-500' },
  timer_resumed: { label: 'Resumed timer', icon: Timer, iconColor: 'text-blue-500' },
};

const fieldLabels: Record<string, string> = {
  description: 'Description',
  project: 'Project',
  startedAt: 'Start time',
  stoppedAt: 'End time',
  durationSeconds: 'Duration',
  labelIds: 'Labels',
};

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (field === 'durationSeconds' && typeof value === 'number') {
    return formatDuration(value);
  }
  if ((field === 'startedAt' || field === 'stoppedAt') && typeof value === 'string') {
    return formatTime(value);
  }
  if (typeof value === 'string' && value === '') return '(empty)';
  if (Array.isArray(value)) return value.length === 0 ? '(none)' : `${value.length} labels`;
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

/* ── Timer sessions & timeline ───────────────────────────────────── */

interface TimelineSession {
  startedAt: string;       // ISO
  stoppedAt: string | null; // null = still running
  durationSeconds: number | null;
  events: AuditEvent[];    // chronological order within session
}

type TimelineItem =
  | { kind: 'event'; event: AuditEvent }
  | { kind: 'session'; session: TimelineSession; index: number };

/** Build timer sessions from audit events (expects DESC order — newest first) */
function buildTimelineSessions(events: AuditEvent[]): TimelineSession[] {
  const chronological = [...events].reverse();
  const sessions: TimelineSession[] = [];
  let currentStart: string | null = null;
  let currentEvents: AuditEvent[] = [];

  for (const event of chronological) {
    if (event.action === 'timer_started' || event.action === 'timer_resumed') {
      const c = event.changes as Record<string, { old?: unknown; new?: unknown }> | null;
      currentStart = (c?.startedAt?.new as string) ?? event.createdAt;
      currentEvents = [event];
    } else if (event.action === 'timer_stopped' && currentStart) {
      const c = event.changes as Record<string, { old?: unknown; new?: unknown }> | null;
      const stoppedAt = (c?.stoppedAt?.new as string) ?? event.createdAt;
      const duration = (c?.durationSeconds?.new as number) ?? null;
      currentEvents.push(event);
      sessions.push({
        startedAt: currentStart, stoppedAt, durationSeconds: duration,
        events: [...currentEvents],
      });
      currentStart = null;
      currentEvents = [];
    }
  }

  // Running session (open start with no stop)
  if (currentStart && currentEvents.length > 0) {
    sessions.push({
      startedAt: currentStart, stoppedAt: null, durationSeconds: null,
      events: [...currentEvents],
    });
  }

  return sessions.reverse(); // newest first
}

/** Interleave sessions and non-timer events into a single timeline */
function buildTimelineItems(events: AuditEvent[], sessions: TimelineSession[]): TimelineItem[] {
  // Map each timer event ID → its session index
  const eventToSession = new Map<string, number>();
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]!;
    for (const ev of session.events) {
      eventToSession.set(ev.id, i);
    }
  }

  const renderedSessions = new Set<number>();
  const items: TimelineItem[] = [];

  for (const event of events) {
    const sessionIdx = eventToSession.get(event.id);
    if (sessionIdx !== undefined) {
      // First timer event of this session → insert the session block
      if (!renderedSessions.has(sessionIdx)) {
        renderedSessions.add(sessionIdx);
        items.push({ kind: 'session', session: sessions[sessionIdx]!, index: sessionIdx });
      }
      // Subsequent timer events for this session → skip (inside the collapsed block)
    } else {
      items.push({ kind: 'event', event });
    }
  }

  return items;
}

function LiveDuration({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedSeconds(startedAt, true);
  return (
    <span className="font-brand font-semibold text-primary">
      {formatDuration(elapsed)}
    </span>
  );
}

function SessionTimelineItem({
  session, expanded, onToggle,
}: {
  session: TimelineSession;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isRunning = session.stoppedAt === null;

  return (
    <div>
      {/* Clickable session bar */}
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-3 py-2 tabular-nums text-left transition-colors',
          isRunning ? 'border border-primary/20' : '',
        )}
        style={{ background: isRunning ? 'hsl(var(--primary) / 0.04)' : 'hsl(var(--muted) / 0.3)' }}
      >
        {/* Chevron */}
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200',
            expanded && 'rotate-90',
          )}
        />

        {/* Running pulse or static dot */}
        {isRunning ? (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500/50" />
        )}

        {/* Time range */}
        <span style={{ fontSize: scaled(12) }} className="text-foreground">
          {formatTime(session.startedAt)}
          <span className="mx-1 text-muted-foreground/40">–</span>
          {isRunning ? (
            <span className="text-primary">now</span>
          ) : (
            formatTime(session.stoppedAt!)
          )}
        </span>

        {/* Duration */}
        <span className="ml-auto" style={{ fontSize: scaled(12) }}>
          {isRunning ? (
            <LiveDuration startedAt={session.startedAt} />
          ) : session.durationSeconds != null ? (
            <span className="font-brand font-semibold text-foreground">
              {formatDuration(session.durationSeconds)}
            </span>
          ) : null}
        </span>
      </button>

      {/* Expanded: individual timer events */}
      {expanded && (
        <div className="ml-5 mt-1.5 space-y-1.5 border-l border-border/50 pl-3">
          {session.events.map((event) => (
            <AuditEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Event bar ───────────────────────────────────────────────────── */

function AuditEventCard({ event }: { event: AuditEvent }) {
  const config = actionConfig[event.action];
  const Icon = config.icon;
  const source = event.metadata && typeof (event.metadata as Record<string, unknown>).source === 'string'
    ? ((event.metadata as Record<string, unknown>).source as string).replace(/_/g, ' ')
    : null;
  const hasChanges = event.changes && Object.keys(event.changes).length > 0;
  const [expanded, setExpanded] = useState(false);

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

      {/* Source */}
      {source && (
        <span className="text-muted-foreground/40" style={{ fontSize: scaled(10) }}>
          {source}
        </span>
      )}

      {/* Timestamp */}
      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground/60" style={{ fontSize: scaled(11) }}>
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
          <div className="flex items-center gap-1.5 py-1 text-muted-foreground" style={{ fontSize: scaled(11) }}>
            <span>{event.actorName}</span>
          </div>

          {/* Changes */}
          {Object.entries(event.changes!).map(([field, change]) => (
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
                  <span className="font-medium text-foreground">
                    {formatFieldValue(field, change.new)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────── */

export function AuditPanel({ entry, open, onOpenChange }: Props) {
  const { data: events, isLoading } = useEntryAudit(open && entry ? entry.id : null);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());

  if (!entry) return null;

  const dateStr = new Date(entry.startedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const startTime = formatTime(entry.startedAt);
  const endTime = entry.stoppedAt ? formatTime(entry.stoppedAt) : null;
  const isRunning = !entry.stoppedAt;

  // Build unified timeline: sessions (collapsible) interleaved with regular events
  const sessions = events ? buildTimelineSessions(events) : [];
  const timelineItems = events ? buildTimelineItems(events, sessions) : [];

  // Find the creation event (oldest = last in our DESC-sorted array)
  const creationEvent = events
    ? [...events].reverse().find(
        (e) => e.action === 'created' || e.action === 'timer_started',
      )
    : undefined;
  const createdAtStr = creationEvent
    ? new Date(creationEvent.createdAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const toggleSession = (index: number) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

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
          <SheetDescription className="sr-only">
            Audit timeline for this entry
          </SheetDescription>
        </SheetHeader>

        {/* Entry summary */}
        <div className={cn(
          'mt-4 rounded-lg border p-3',
          isRunning ? 'border-primary/30' : 'border-border',
        )}>
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
              <span>{dateStr}</span>
              {/* Show time range only when no sessions (sessions have their own ranges) */}
              {sessions.length === 0 && (
                <>
                  <span className="opacity-30">|</span>
                  <span>
                    {startTime} – {isRunning ? (
                      <span className="text-primary">now</span>
                    ) : endTime}
                  </span>
                </>
              )}
              <span className="opacity-30">|</span>
              {isRunning ? (
                <LiveDuration startedAt={entry.startedAt} />
              ) : entry.durationSeconds != null ? (
                <span className="font-brand font-semibold text-foreground">
                  {formatDuration(entry.durationSeconds)}
                </span>
              ) : null}
            </div>
            {createdAtStr && (
              <div className="text-muted-foreground/40" style={{ fontSize: scaled(10) }}>
                Created {createdAtStr}
                {creationEvent && creationEvent.action === 'timer_started' && ' via timer'}
              </div>
            )}
          </div>
        </div>

        {/* Timeline count */}
        {events && events.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span
              className="font-brand uppercase tracking-wider text-muted-foreground/50"
              style={{ fontSize: scaled(9) }}
            >
              {events.length} {events.length === 1 ? 'event' : 'events'}
              {sessions.length > 0 && ` · ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        {/* Unified timeline */}
        <div className="mt-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history...
            </div>
          ) : timelineItems.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground/50">
              No history recorded yet
            </div>
          ) : (
            <div className="space-y-1.5">
              {timelineItems.map((item) =>
                item.kind === 'session' ? (
                  <SessionTimelineItem
                    key={`session-${item.index}`}
                    session={item.session}
                    expanded={expandedSessions.has(item.index)}
                    onToggle={() => toggleSession(item.index)}
                  />
                ) : (
                  <AuditEventCard key={item.event.id} event={item.event} />
                ),
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
