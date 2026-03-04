import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Users,
  Clock,
  Moon,
  Zap,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { useTeamBoard, type TeamBoardMember, type PresenceStatus } from '@/hooks/use-team-board';
import { useAssignedProjects } from '@/hooks/use-reference-data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ProjectOption } from '@ternity/shared';

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
  active: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    label: 'Active',
    sortOrder: 0,
  },
  overtime: {
    dot: 'bg-teal-400/60',
    bg: 'bg-teal-400/8',
    text: 'text-teal-400/70',
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
    dot: 'bg-muted-foreground/40',
    bg: 'bg-muted-foreground/6',
    text: 'text-muted-foreground/60',
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
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
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

function groupProjectsByClient(projects: ProjectOption[]) {
  const map = new Map<string, ProjectOption[]>();
  for (const p of projects) {
    const client = p.clientName ?? 'No Client';
    if (!map.has(client)) map.set(client, []);
    map.get(client)!.push(p);
  }
  return Array.from(map.entries()).map(([client, projectList]) => ({
    client,
    projects: projectList,
  }));
}

function ProjectFilter({
  value,
  onChange,
  projects,
}: {
  value: string | null;
  onChange: (project: string | null) => void;
  projects: ProjectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = projects.find((p) => p.name === value) ?? null;
  const grouped = groupProjectsByClient(projects);

  const filtered = search
    ? grouped
        .map((g) => ({
          ...g,
          projects: g.projects.filter(
            (p) =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              g.client.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((g) => g.projects.length > 0)
    : grouped;

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:bg-accent',
            selected ? 'text-foreground' : 'text-muted-foreground',
          )}
          style={{ fontSize: scaled(11) }}
        >
          {selected ? (
            <>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selected.color ?? '#00D4AA' }}
              />
              <span className="max-w-[140px] truncate">{selected.name}</span>
            </>
          ) : (
            <>
              <FolderKanban className="h-3.5 w-3.5" />
              <span>All Projects</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] overflow-hidden p-0" align="end" sideOffset={6}>
        {/* Search */}
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <motion.input
              ref={searchRef}
              className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-foreground outline-none"
              style={{ border: '1px solid hsl(var(--border))', fontSize: scaled(12) }}
              whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
              transition={{ duration: 0.2 }}
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* All Projects option */}
        <div className="border-b border-border p-1">
          <motion.button
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
              !value
                ? 'bg-primary/8 text-foreground'
                : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
            )}
            style={{ fontSize: scaled(12) }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">All Projects</span>
          </motion.button>
        </div>

        {/* Project list grouped by client */}
        <div className="max-h-[260px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {filtered.length === 0 ? (
            <div
              className="px-3 py-4 text-center text-muted-foreground"
              style={{ fontSize: scaled(11) }}
            >
              No projects match &ldquo;{search}&rdquo;
            </div>
          ) : (
            filtered.map((group, gi) => (
              <div key={group.client}>
                <div
                  className="flex items-center gap-1.5 px-2.5 pb-1 pt-2.5 font-brand font-semibold uppercase tracking-widest text-muted-foreground"
                  style={{ letterSpacing: '1.5px', opacity: 0.6, fontSize: scaled(9) }}
                >
                  {group.client}
                </div>
                {group.projects.map((p, pi) => {
                  const isSelected = value === p.name;
                  return (
                    <motion.button
                      key={p.id}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                        isSelected
                          ? 'bg-primary/8 text-foreground'
                          : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
                      )}
                      style={{ fontSize: scaled(12) }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.05 + pi * 0.03, duration: 0.15 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onChange(p.name);
                        setOpen(false);
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: p.color ?? '#00D4AA' }}
                      />
                      <span className="flex-1 truncate">{p.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
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
        member.status === 'off' && 'opacity-50',
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
                className="absolute top-0 bottom-0 z-10 w-0.5 bg-destructive/80"
                style={{ left: `${nowPos}%` }}
              >
                <div className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-destructive" />
              </div>
            )}

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
    { key: 'all', label: 'All', icon: Users },
    { key: 'active', label: 'Active', icon: Clock },
    { key: 'idle', label: 'Idle', icon: Zap },
    { key: 'off', label: 'Off', icon: Moon },
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
  const { data: projectOptions } = useAssignedProjects();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
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

  // Project dropdown shows all projects the current user can access (assigned for users, all for admins)
  const allProjects = useMemo(
    () => [...(projectOptions ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [projectOptions],
  );

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

    // Sort: active first, then overtime, idle, off
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
          <div
            className="mt-0.5 flex items-center gap-2 text-muted-foreground"
            style={{ fontSize: scaled(12) }}
          >
            <div className="flex items-center gap-0.5">
              <button
                onClick={goBack}
                className="rounded p-0.5 transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={goToday}
                className={cn(
                  'rounded px-1.5 py-0.5 font-medium transition-colors',
                  isToday ? 'text-foreground' : 'text-primary hover:bg-primary/10',
                )}
                style={{ fontSize: scaled(11) }}
              >
                {formatDateLabel(selectedDate)}
              </button>
              <button
                onClick={goForward}
                disabled={isToday}
                className={cn(
                  'rounded p-0.5 transition-colors',
                  isToday
                    ? 'cursor-default text-muted-foreground/30'
                    : 'hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <span>{members?.length ?? 0} members</span>
            {isToday && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{counts.active} active</span>
              </>
            )}
          </div>
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
