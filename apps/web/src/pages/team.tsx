import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Users, Clock, Moon, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { useTeamBoard, type TeamBoardMember, type PresenceStatus } from '@/hooks/use-team-board';
import { useProjects } from '@/hooks/use-reference-data';
import { usePreferences } from '@/providers/preferences-provider';

// ============================================================
// Constants
// ============================================================

const TIMELINE_START = 7;
const TIMELINE_END = 20;
const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

// ============================================================
// Status metadata
// ============================================================

const STATUS_META: Record<
  PresenceStatus,
  { dot: string; bg: string; text: string; label: string; sortOrder: number }
> = {
  available: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    label: 'Available',
    sortOrder: 0,
  },
  'working-off-hours': {
    dot: 'bg-teal-400/60',
    bg: 'bg-teal-400/8',
    text: 'text-teal-400/70',
    label: 'Off-hours',
    sortOrder: 1,
  },
  idle: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    label: 'Idle',
    sortOrder: 2,
  },
  'off-schedule': {
    dot: 'bg-muted-foreground/40',
    bg: 'bg-muted-foreground/6',
    text: 'text-muted-foreground/60',
    label: 'Off Hours',
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
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Collect all unique project names across all members */
function getAllProjects(members: TeamBoardMember[]): string[] {
  const set = new Set<string>();
  members.forEach((m) => m.entries.forEach((e) => set.add(e.projectName)));
  return Array.from(set).sort();
}

/** Check if a member has any entries for a given project */
function memberHasProject(member: TeamBoardMember, project: string): boolean {
  return member.entries.some((e) => e.projectName === project);
}

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
// Project Filter Dropdown
// ============================================================

function ProjectFilter({
  value,
  onChange,
  projects,
}: {
  value: string | null;
  onChange: (project: string | null) => void;
  projects: string[];
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value ?? 'All Projects';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-1.5 font-medium transition-colors',
          value
            ? 'border-primary/30 bg-primary/5 text-foreground'
            : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground',
        )}
        style={{ fontSize: scaled(11) }}
      >
        {selectedLabel}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
          <Search className="h-3 w-3 opacity-50" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-border bg-popover py-1 shadow-lg"
            >
              <button
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted/50',
                  !value && 'text-primary',
                )}
                style={{ fontSize: scaled(11) }}
              >
                All Projects
              </button>
              {projects.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted/50',
                    value === p && 'text-primary',
                  )}
                  style={{ fontSize: scaled(11) }}
                >
                  {p}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
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
}: {
  member: TeamBoardMember;
  highlightProject: string | null;
  nowHour: number;
}) {
  const [hoveredEntry, setHoveredEntry] = useState<TimelineEntry | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
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

  const initials = getInitials(member.displayName);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'grid items-center gap-0 rounded-lg border border-border bg-[hsl(var(--t-surface))] transition-colors hover:border-primary/20',
        member.status === 'off-schedule' && 'opacity-50',
      )}
      style={{ gridTemplateColumns: '200px 120px 1fr' }}
    >
      {/* Person info */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="relative">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.displayName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]"
              style={{ fontSize: 11 }}
            >
              {initials}
            </div>
          )}
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
        <div ref={stripRef} className="relative h-8 overflow-hidden rounded bg-muted/30">
          {/* Scheduled block background — skip for off-hours */}
          {hasSchedule && member.status !== 'off-schedule' && (
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

            return (
              <motion.div
                key={entry.id}
                className="absolute top-1.5 h-5 cursor-pointer overflow-hidden rounded-sm transition-all"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.5)}%`,
                }}
                onMouseEnter={(e) => {
                  setHoveredEntry(entry);
                  const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (rect) setTooltipX(e.clientX - rect.left);
                }}
                onMouseLeave={() => setHoveredEntry(null)}
              >
                {/* Color layer */}
                <div
                  className="absolute inset-0 rounded-sm"
                  style={{
                    backgroundColor: entry.projectColor,
                    opacity: isDimmed
                      ? 0.15
                      : isHighlightedProject
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
              </motion.div>
            );
          })}

          {/* Now line */}
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-destructive/80"
            style={{ left: `${nowPos}%` }}
          >
            <div className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-destructive" />
          </div>

          {/* Hour ticks */}
          {Array.from(
            { length: TIMELINE_END - TIMELINE_START + 1 },
            (_, i) => TIMELINE_START + i,
          ).map((h) => (
            <span
              key={h}
              className="absolute bottom-0 text-muted-foreground/30"
              style={{ left: `${toPercent(h)}%`, fontSize: 7, transform: 'translateX(-50%)' }}
            >
              {h}
            </span>
          ))}

          {/* Tooltip */}
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
                  left: `clamp(0px, ${tooltipX}px - 100px, calc(100% - 220px))`,
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
    { key: 'all', label: 'All', icon: Users },
    { key: 'available', label: 'Available', icon: Clock },
    { key: 'idle', label: 'Idle', icon: Zap },
    { key: 'off-schedule', label: 'Off Hours', icon: Moon },
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

export function TeamPage() {
  const { data: members, isLoading, error } = useTeamBoard();
  const { data: projectOptions } = useProjects();
  const { defaultProjectId } = usePreferences();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const initializedRef = useRef(false);

  // Set initial project filter once data is available
  useEffect(() => {
    if (initializedRef.current || !members?.length || !projectOptions?.length) return;
    initializedRef.current = true;

    // 1. Try user's default project
    if (defaultProjectId) {
      const defaultProject = projectOptions.find((p) => p.id === defaultProjectId);
      if (defaultProject) {
        setProjectFilter(defaultProject.name);
        return;
      }
    }

    // 2. Fall back to user's most recent entry project (from current user's running timer or latest entry)
    // The current user's ID isn't directly available here, but we can check the members data
    // for the running entry — the first available project in the data works as a fallback
  }, [members, projectOptions, defaultProjectId]);

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;

  const allProjects = useMemo(() => getAllProjects(members ?? []), [members]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: members?.length ?? 0,
      available: 0,
      'working-off-hours': 0,
      idle: 0,
      'off-schedule': 0,
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

    // Project filter
    if (projectFilter) list = list.filter((m) => memberHasProject(m, projectFilter));

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

    // Sort: available first, then working-off-hours, idle, off-schedule
    return [...list].sort(
      (a, b) => STATUS_META[a.status].sortOrder - STATUS_META[b.status].sortOrder,
    );
  }, [members, statusFilter, projectFilter, search]);

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
            {members?.length ?? 0} members · {counts.available} available
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectFilter value={projectFilter} onChange={setProjectFilter} projects={allProjects} />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
              style={{ fontSize: scaled(11), width: 180 }}
            />
          </div>
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-4">
        <StatusFilterBar active={statusFilter} onChange={setStatusFilter} counts={counts} />
      </div>

      {/* Column headers */}
      <div
        className="mb-1 grid items-center gap-0 px-0"
        style={{ gridTemplateColumns: '200px 120px 1fr' }}
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
          <div className="flex justify-between">
            {Array.from(
              { length: TIMELINE_END - TIMELINE_START + 1 },
              (_, i) => TIMELINE_START + i,
            ).map((h) => (
              <span
                key={h}
                className="font-brand text-muted-foreground/40"
                style={{
                  fontSize: scaled(8),
                  width: `${100 / (TIMELINE_END - TIMELINE_START)}%`,
                  textAlign: 'left',
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
              highlightProject={projectFilter}
              nowHour={nowHour}
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
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-3 w-0.5 bg-destructive" />
          Now
        </span>
      </div>
    </div>
  );
}
