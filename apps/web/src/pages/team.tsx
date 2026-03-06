import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Users,
  Clock,
  Moon,
  Zap,
  Timer,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { UserAvatar } from '@/components/ui/user-avatar';
import { SelectPopover } from '@/components/ui/select-popover';
import { useTeamBoard, type TeamBoardMember, type PresenceStatus } from '@/hooks/use-team-board';

// ============================================================
// Constants
// ============================================================

const TIMELINE_START = 7;
const TIMELINE_END = 19;
const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

// ============================================================
// Status metadata
// ============================================================

const STATUS_META: Record<
  PresenceStatus,
  { dot: string; bg: string; text: string; label: string; sortOrder: number }
> = {
  active: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    label: 'Active',
    sortOrder: 0,
  },
  overtime: {
    dot: 'bg-teal-400',
    bg: 'bg-teal-400/10',
    text: 'text-teal-400',
    label: 'Overtime',
    sortOrder: 1,
  },
  idle: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    label: 'Idle',
    sortOrder: 2,
  },
  off: {
    dot: 'bg-muted-foreground',
    bg: 'bg-muted-foreground/10',
    text: 'text-muted-foreground',
    label: 'Off',
    sortOrder: 3,
  },
};

type StatusFilter = 'all' | PresenceStatus;

// ============================================================
// Helpers
// ============================================================

function toPercent(hour: number): number {
  return Math.max(0, Math.min(100, ((hour - TIMELINE_START) / TIMELINE_SPAN) * 100));
}

/** Parse "HH:mm" → fractional hours */
function timeToHour(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! + m! / 60;
}

/** Format fractional hours → "HH:MM" */
function fmtHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/** Format minutes → "Xh YYm" */
function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min.toString().padStart(2, '0')}m` : `${min}m`;
}

/** ISO string → fractional hour of day */
function isoToHour(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

/** Return dark or light text for a given hex background color */
function textForColor(color: string): string {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (!hex?.[1]) return '#fff';
  const r = parseInt(hex[1].slice(0, 2), 16);
  const g = parseInt(hex[1].slice(2, 4), 16);
  const b = parseInt(hex[1].slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a1a' : '#f8f8f8';
}

/** Get initials from display name */

// ============================================================
// PresenceBadge
// ============================================================

function PresenceBadge({ status }: { status: PresenceStatus }) {
  const s = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5',
        s.bg,
        s.text,
      )}
      style={{ fontSize: scaled(10) }}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

// ============================================================
// Timeline Row
// ============================================================

interface TimelineEntry {
  id: string;
  projectName: string;
  projectColor: string;
  description: string;
  startHour: number;
  endHour: number | null;
  running: boolean;
  durationSeconds: number;
}

function TimelineRow({
  member,
  highlightProject,
  nowHour,
  showNowLine = true,
}: {
  member: TeamBoardMember;
  highlightProject: string | null;
  nowHour: number;
  showNowLine?: boolean;
}) {
  const [hoveredEntry, setHoveredEntry] = useState<TimelineEntry | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Convert API entries to timeline entries (fractional hours)
  const entries: TimelineEntry[] = useMemo(
    () =>
      member.entries.map((e) => ({
        id: e.id,
        projectName: e.projectName,
        projectColor: e.projectColor,
        description: e.description,
        startHour: isoToHour(e.startedAt),
        endHour: e.stoppedAt ? isoToHour(e.stoppedAt) : null,
        running: e.stoppedAt === null,
        durationSeconds: e.durationSeconds,
      })),
    [member.entries],
  );

  const hasSchedule = member.schedule !== null;
  const schedStart = hasSchedule ? timeToHour(member.schedule!.start) : 0;
  const schedEnd = hasSchedule ? timeToHour(member.schedule!.end) : 0;
  const schedLeft = toPercent(schedStart);
  const schedRight = toPercent(schedEnd);
  const schedWidth = schedRight - schedLeft;
  const nowPos = toPercent(nowHour);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'grid items-center gap-0 rounded-lg border border-border bg-[hsl(var(--t-surface))] transition-colors hover:border-primary/20',
        member.status === 'off' && 'opacity-50',
      )}
      style={{ gridTemplateColumns: '200px 120px 1fr' }}
    >
      {/* Person info */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="relative">
          <UserAvatar user={member} size="md" />
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--t-surface))]',
              STATUS_META[member.status].dot,
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground" style={{ fontSize: scaled(12) }}>
            {member.displayName}
          </div>
        </div>
      </div>

      {/* Status column — single-line pill */}
      <div className="flex items-center px-2">
        <PresenceBadge status={member.status} />
      </div>

      {/* Timeline */}
      <div className="relative py-2 pr-3">
        {/* Wrapper — tooltip renders here, outside the strip, so it's never clipped */}
        <div ref={wrapperRef} className="relative">
          {/* Tooltip — outside the strip to avoid overflow clipping */}
          <AnimatePresence>
            {hoveredEntry && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className="absolute z-30 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg"
                style={{
                  bottom: 'calc(100% + 8px)',
                  left: `${tooltipX}px`,
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  maxWidth: '280px',
                }}
              >
                {/* Arrow */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-popover"
                  style={{ top: '100%' }}
                />
                {/* Project */}
                <div className="flex items-center gap-1.5" style={{ fontSize: scaled(9) }}>
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: hoveredEntry.projectColor }}
                  />
                  <span className="text-muted-foreground">{hoveredEntry.projectName}</span>
                </div>
                {/* Description */}
                <div
                  className="mt-0.5 truncate font-medium text-foreground"
                  style={{ fontSize: scaled(10), maxWidth: '250px' }}
                >
                  {hoveredEntry.description || 'No description'}
                </div>
                {/* Time + duration */}
                <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(9) }}>
                  {fmtHour(hoveredEntry.startHour)} –{' '}
                  {hoveredEntry.endHour ? fmtHour(hoveredEntry.endHour) : 'now'}
                  <span className="ml-2 text-muted-foreground/70">
                    {fmtMin(Math.round(hoveredEntry.durationSeconds / 60))}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Strip */}
          <div
            ref={stripRef}
            className="relative h-8 rounded bg-muted/30"
            onMouseLeave={() => setHoveredEntry(null)}
          >
            {/* Scheduled block background — skip for off-hours */}
            {hasSchedule && member.status !== 'off' && (
              <div
                className="absolute top-0 h-full rounded border-l border-r bg-primary/5 border-primary/10"
                style={{ left: `${schedLeft}%`, width: `${schedWidth}%` }}
              />
            )}

            {/* Entry blocks */}
            {entries.map((entry) => {
              const endH = entry.endHour ?? nowHour;
              const left = toPercent(entry.startHour);
              const width = toPercent(endH) - left;
              const isHighlightedProject =
                highlightProject !== null && entry.projectName === highlightProject;
              const isDimmed = highlightProject !== null && entry.projectName !== highlightProject;
              const isHovered = hoveredEntry?.id === entry.id;

              return (
                <div
                  key={entry.id}
                  className="absolute top-1.5 h-5 cursor-pointer overflow-hidden rounded-sm"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 0.5)}%`,
                    opacity: isHovered ? 1 : isDimmed ? 0.15 : 1,
                    zIndex: isHovered ? 5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    setHoveredEntry(entry);
                    const rect = wrapperRef.current?.getBoundingClientRect();
                    if (rect) setTooltipX(e.clientX - rect.left);
                  }}
                  onMouseMove={(e) => {
                    const rect = wrapperRef.current?.getBoundingClientRect();
                    if (rect) setTooltipX(e.clientX - rect.left);
                  }}
                >
                  {/* Color layer */}
                  <div
                    className="absolute inset-0 rounded-sm"
                    style={{
                      backgroundColor: entry.projectColor,
                      opacity: isDimmed
                        ? 1
                        : isHighlightedProject || isHovered
                          ? 0.95
                          : entry.running
                            ? 0.95
                            : 0.8,
                    }}
                  />
                  {/* Text layer — no opacity inheritance */}
                  {!isDimmed && (
                    <span
                      className="relative block truncate px-1 leading-5 font-semibold"
                      style={{
                        fontSize: scaled(8),
                        color: textForColor(entry.projectColor),
                      }}
                    >
                      {entry.projectName}
                    </span>
                  )}
                  {entry.running && (
                    <motion.div
                      className="absolute right-0 top-0 h-full w-1 rounded-r-sm"
                      style={{ backgroundColor: entry.projectColor }}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>
              );
            })}

            {/* Now line — only shown for today */}
            {showNowLine && (
              <div
                className="absolute top-0 bottom-0 z-10 w-[1.5px] rounded-full bg-destructive/80"
                style={{ left: `${nowPos}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Status Filter Pills
// ============================================================

function StatusFilterBar({
  active,
  onChange,
  counts,
}: {
  active: StatusFilter;
  onChange: (f: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  const pills: { key: StatusFilter; label: string; icon: React.ElementType }[] = [
    { key: 'active', label: 'Active', icon: Clock },
    { key: 'idle', label: 'Idle', icon: Zap },
    { key: 'overtime', label: 'Overtime', icon: Timer },
    { key: 'off', label: 'Off', icon: Moon },
    { key: 'all', label: 'All', icon: Users },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((p) => {
        const isActive = active === p.key;
        const meta = p.key !== 'all' ? STATUS_META[p.key] : null;
        return (
          <button
            key={p.key}
            onClick={() => onChange(isActive && p.key !== 'all' ? 'all' : p.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 font-brand font-medium transition-colors',
              isActive
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/20 hover:text-foreground',
            )}
            style={{ fontSize: scaled(10) }}
          >
            {meta && <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />}
            {p.label}
            <span className="ml-0.5 opacity-60">{counts[p.key]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

/** Check if date is today */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Format date for display: "Today", "Yesterday", or "Wed, Mar 4" */
function formatDateLabel(date: Date): string {
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function TeamPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const { data: members, isLoading, error } = useTeamBoard(selectedDate);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [teamFilter, setTeamFilter] = useState('');
  const [search, setSearch] = useState('');

  const now = new Date();
  const isToday = isSameDay(selectedDate, now);
  const nowHour = now.getHours() + now.getMinutes() / 60;

  const goBack = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const goForward = useCallback(() => {
    if (isToday) return; // Can't go to the future
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, [isToday]);

  const goToday = useCallback(() => setSelectedDate(new Date()), []);

  // Keyboard left/right arrow navigation between days
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't navigate when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      } else if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        goToday();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goBack, goForward, goToday]);

  // Distinct teams from the board members for filter dropdown
  const teamFilterItems = useMemo(() => {
    if (!members) return [];
    const seen = new Map<string, { name: string; color: string | null }>();
    for (const m of members) {
      if (m.teamId && m.teamName && !seen.has(m.teamId)) {
        seen.set(m.teamId, { name: m.teamName, color: m.teamColor });
      }
    }
    return [
      { value: '', label: 'All Teams' },
      ...Array.from(seen.entries())
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([id, t]) => ({
          value: id,
          label: t.name,
          color: t.color ?? undefined,
        })),
    ];
  }, [members]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: members?.length ?? 0,
      active: 0,
      overtime: 0,
      idle: 0,
      off: 0,
    };
    members?.forEach((m) => {
      c[m.status]++;
    });
    return c;
  }, [members]);

  const filtered = useMemo(() => {
    let list = members ?? [];

    // Status filter
    if (statusFilter !== 'all') list = list.filter((m) => m.status === statusFilter);

    // Team filter (by defaultProjectId / teamId)
    if (teamFilter) list = list.filter((m) => m.teamId === teamFilter);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.runningEntry?.projectName.toLowerCase().includes(q) ||
          m.runningEntry?.description.toLowerCase().includes(q),
      );
    }

    // Sort: active first, then overtime, idle, off
    return [...list].sort(
      (a, b) => STATUS_META[a.status].sortOrder - STATUS_META[b.status].sortOrder,
    );
  }, [members, statusFilter, teamFilter, search]);

  const hasFilters = statusFilter !== 'all' || teamFilter !== '' || search.trim() !== '';

  function clearFilters() {
    setStatusFilter('all');
    setTeamFilter('');
    setSearch('');
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading team board...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive">
        Failed to load team board
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1
            className="font-brand font-semibold tracking-wide text-foreground"
            style={{ fontSize: scaled(18) }}
          >
            Team
          </h1>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
            See who&apos;s working, idle, or off
          </p>
        </div>
      </div>

      {/* Controls row */}
      <div className="mb-4 flex items-center gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            aria-label="Previous"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent"
            style={{ fontSize: scaled(12) }}
            onClick={goToday}
            title="Go to today"
          >
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-brand font-semibold tracking-wide">
              {formatDateLabel(selectedDate)}
            </span>
          </button>
          <button
            onClick={goForward}
            disabled={isToday}
            aria-label="Next"
            className={cn(
              'rounded-md p-1 transition-colors',
              isToday
                ? 'cursor-default text-muted-foreground/30'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Status filter */}
        <StatusFilterBar active={statusFilter} onChange={setStatusFilter} counts={counts} />

        {/* Team filter */}
        {teamFilterItems.length > 1 && (
          <SelectPopover
            value={teamFilter}
            onChange={setTeamFilter}
            items={teamFilterItems}
            placeholder="All Teams"
            searchable={teamFilterItems.length > 8}
            searchPlaceholder="Search teams..."
            compact
            width={200}
          />
        )}

        {/* Search */}
        <div className="flex max-w-[280px] flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-[7px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people..."
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: scaled(12), border: 'none' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
            style={{ fontSize: scaled(10) }}
          >
            Clear filters
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Member stats */}
        <div className="flex items-center gap-2">
          <span
            className="font-brand uppercase text-muted-foreground"
            style={{ fontSize: scaled(9), letterSpacing: '1.5px' }}
          >
            Members
          </span>
          <span
            className="font-brand font-bold tabular-nums text-foreground"
            style={{ fontSize: scaled(13) }}
          >
            {members?.length ?? 0}
          </span>
        </div>
      </div>

      {/* Column headers — 1px horizontal inset to align with bordered rows */}
      <div
        className="mb-1 grid items-center gap-0"
        style={{ gridTemplateColumns: '200px 120px 1fr', paddingLeft: '1px', paddingRight: '1px' }}
      >
        <span
          className="px-3 font-brand uppercase tracking-wider text-muted-foreground/50"
          style={{ fontSize: scaled(9), fontWeight: 600 }}
        >
          Person
        </span>
        <span
          className="px-2 font-brand uppercase tracking-wider text-muted-foreground/50"
          style={{ fontSize: scaled(9), fontWeight: 600 }}
        >
          Status
        </span>
        <div className="relative pr-3">
          <div className="relative h-4">
            {Array.from(
              { length: TIMELINE_END - TIMELINE_START + 1 },
              (_, i) => TIMELINE_START + i,
            ).map((h) => (
              <span
                key={h}
                className="absolute font-brand text-muted-foreground/40"
                style={{
                  fontSize: scaled(8),
                  left: `${toPercent(h)}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {h}:00
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Roster rows */}
      <div className="flex flex-col gap-1">
        <AnimatePresence>
          {filtered.map((member) => (
            <TimelineRow
              key={member.id}
              member={member}
              highlightProject={null}
              nowHour={nowHour}
              showNowLine={isToday}
            />
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-muted-foreground" style={{ fontSize: scaled(13) }}>
            No team members match the current filters.
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        className="mt-4 flex items-center gap-5 rounded-lg border border-border bg-muted/20 px-4 py-2"
        style={{ fontSize: scaled(9) }}
      >
        <span
          className="font-brand uppercase tracking-wider text-muted-foreground/50"
          style={{ fontWeight: 600 }}
        >
          Legend
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-3 w-6 rounded-sm border border-primary/10 bg-primary/5" />
          Scheduled hours
        </span>
        {isToday && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-3 w-0.5 bg-destructive" />
            Now
          </span>
        )}
      </div>
    </div>
  );
}
