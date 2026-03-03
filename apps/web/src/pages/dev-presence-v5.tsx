import { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Search, Users, Clock, Palmtree, Moon, Zap, CalendarOff, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// Types
// ============================================================

type PresenceStatus =
  | 'available'
  | 'working-off-hours'
  | 'idle'
  | 'away'
  | 'off-schedule'
  | 'on-leave';

interface TimeEntry {
  id: string;
  project: string;
  description: string;
  color: string;
  startHour: number;
  endHour: number | null; // null = running
  running?: boolean;
}

interface AbsenceBlock {
  id: string;
  reason: string; // e.g. "Doctor appointment", "Half-day off"
  startHour: number;
  endHour: number;
}

interface MockPerson {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: PresenceStatus;
  scheduleStart: number;
  scheduleEnd: number;
  timezone: string;
  currentProject?: string;
  currentTask?: string;
  entries: TimeEntry[];
  absences?: AbsenceBlock[];
}

// ============================================================
// Mock Data — 14 Team Members
// ============================================================

const NOW_HOUR = 14.5; // 14:30

// Using the real Ternity palette from @ternity/shared
const PROJECT_COLORS = {
  'Platform Core': '#00D4AA', // teal (brand)
  'Mobile App': '#F97316', // orange
  'Design System': '#8B5CF6', // purple
  'API Gateway': '#3B82F6', // blue
  'Data Pipeline': '#EC4899', // pink
  'QA Automation': '#F59E0B', // amber
  'Client Portal': '#14B8A6', // teal-2
  DevOps: '#6366F1', // indigo
} as const;

type ProjectName = keyof typeof PROJECT_COLORS;

const getColor = (name: string): string => PROJECT_COLORS[name as ProjectName] ?? '#00D4AA';

// Simulated "user's default project" — in real app this comes from preferences
const USER_DEFAULT_PROJECT = 'Platform Core';

const MOCK_TEAM: MockPerson[] = [
  {
    id: '1',
    name: 'Elena Marsh',
    initials: 'EM',
    role: 'Lead Developer',
    status: 'available',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    currentProject: 'Platform Core',
    currentTask: 'PROJ-341 Fix pagination edge case',
    entries: [
      {
        id: 'e1-1',
        project: 'Platform Core',
        description: 'PROJ-341 Fix pagination edge case',
        color: getColor('Platform Core'),
        startHour: 9,
        endHour: 12,
      },
      {
        id: 'e1-2',
        project: 'Platform Core',
        description: 'Code review — auth middleware',
        color: getColor('Platform Core'),
        startHour: 12.5,
        endHour: 13.5,
      },
      {
        id: 'e1-3',
        project: 'Platform Core',
        description: 'PROJ-345 Implement presence API',
        color: getColor('Platform Core'),
        startHour: 13.5,
        endHour: null,
        running: true,
      },
    ],
  },
  {
    id: '2',
    name: 'James Oakley',
    initials: 'JO',
    role: 'Senior Developer',
    status: 'available',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    currentProject: 'API Gateway',
    currentTask: 'AUTH-128 Rate limiter refactor',
    entries: [
      {
        id: 'e2-1',
        project: 'API Gateway',
        description: 'AUTH-128 Rate limiter refactor',
        color: getColor('API Gateway'),
        startHour: 9,
        endHour: 11.5,
      },
      {
        id: 'e2-2',
        project: 'Platform Core',
        description: 'PR review for Elena',
        color: getColor('Platform Core'),
        startHour: 11.5,
        endHour: 12,
      },
      {
        id: 'e2-3',
        project: 'API Gateway',
        description: 'AUTH-129 Token rotation',
        color: getColor('API Gateway'),
        startHour: 13,
        endHour: null,
        running: true,
      },
    ],
  },
  {
    id: '3',
    name: 'Nora Fielding',
    initials: 'NF',
    role: 'UI Designer',
    status: 'available',
    scheduleStart: 10,
    scheduleEnd: 18,
    timezone: 'CET',
    currentProject: 'Design System',
    currentTask: 'DS-45 New date picker variants',
    entries: [
      {
        id: 'e3-1',
        project: 'Design System',
        description: 'DS-44 Button states audit',
        color: getColor('Design System'),
        startHour: 10,
        endHour: 12.5,
      },
      {
        id: 'e3-2',
        project: 'Design System',
        description: 'DS-45 New date picker variants',
        color: getColor('Design System'),
        startHour: 13,
        endHour: null,
        running: true,
      },
    ],
  },
  {
    id: '4',
    name: 'Leo Tanner',
    initials: 'LT',
    role: 'Developer',
    status: 'away',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    entries: [
      {
        id: 'e4-1',
        project: 'Platform Core',
        description: 'PROJ-340 DB migration script',
        color: getColor('Platform Core'),
        startHour: 9,
        endHour: 11,
      },
      {
        id: 'e4-2',
        project: 'Platform Core',
        description: 'PROJ-342 Cache invalidation',
        color: getColor('Platform Core'),
        startHour: 11.5,
        endHour: 13.5,
      },
    ],
    absences: [{ id: 'abs4-1', reason: 'Half-day off', startHour: 14, endHour: 17 }],
  },
  {
    id: '5',
    name: 'Mia Corrigan',
    initials: 'MC',
    role: 'QA Engineer',
    status: 'available',
    scheduleStart: 8,
    scheduleEnd: 16,
    timezone: 'CET',
    currentProject: 'QA Automation',
    currentTask: 'QA-89 E2E presence tests',
    entries: [
      {
        id: 'e5-1',
        project: 'QA Automation',
        description: 'QA-88 Regression suite run',
        color: getColor('QA Automation'),
        startHour: 8,
        endHour: 10.5,
      },
      {
        id: 'e5-2',
        project: 'Platform Core',
        description: 'QA-87 Bug repro for PROJ-341',
        color: getColor('Platform Core'),
        startHour: 10.5,
        endHour: 12,
      },
      {
        id: 'e5-3',
        project: 'QA Automation',
        description: 'QA-89 E2E presence tests',
        color: getColor('QA Automation'),
        startHour: 12.5,
        endHour: null,
        running: true,
      },
    ],
  },
  {
    id: '6',
    name: 'Sam Whitford',
    initials: 'SW',
    role: 'Developer',
    status: 'on-leave',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    entries: [],
  },
  {
    id: '7',
    name: 'Ren Kimura',
    initials: 'RK',
    role: 'Developer',
    status: 'off-schedule',
    scheduleStart: 16,
    scheduleEnd: 24,
    timezone: 'JST',
    entries: [],
  },
  {
    id: '8',
    name: 'Alex Morgan',
    initials: 'AM',
    role: 'DevOps Engineer',
    status: 'available',
    scheduleStart: 8,
    scheduleEnd: 16,
    timezone: 'CET',
    currentProject: 'DevOps',
    currentTask: 'OPS-55 K8s cluster upgrade',
    entries: [
      {
        id: 'e8-1',
        project: 'DevOps',
        description: 'OPS-54 Monitoring alerts config',
        color: getColor('DevOps'),
        startHour: 8,
        endHour: 10,
      },
      {
        id: 'e8-2',
        project: 'DevOps',
        description: 'OPS-55 K8s cluster upgrade',
        color: getColor('DevOps'),
        startHour: 10.5,
        endHour: 12.5,
      },
      {
        id: 'e8-3',
        project: 'DevOps',
        description: 'OPS-55 K8s cluster upgrade cont.',
        color: getColor('DevOps'),
        startHour: 13,
        endHour: null,
        running: true,
      },
    ],
  },
  {
    id: '9',
    name: 'Priya Desai',
    initials: 'PD',
    role: 'Product Manager',
    status: 'available',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    currentProject: 'Platform Core',
    currentTask: 'Sprint planning & backlog',
    entries: [
      {
        id: 'e9-1',
        project: 'Platform Core',
        description: 'Sprint planning meeting',
        color: getColor('Platform Core'),
        startHour: 9,
        endHour: 10.5,
      },
      {
        id: 'e9-2',
        project: 'Client Portal',
        description: 'Client demo prep',
        color: getColor('Client Portal'),
        startHour: 10.5,
        endHour: 12,
      },
      {
        id: 'e9-3',
        project: 'Platform Core',
        description: 'Backlog grooming',
        color: getColor('Platform Core'),
        startHour: 13,
        endHour: null,
        running: true,
      },
    ],
  },
  {
    id: '10',
    name: 'Tom Galloway',
    initials: 'TG',
    role: 'Developer',
    status: 'away',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    entries: [
      {
        id: 'e10-1',
        project: 'Mobile App',
        description: 'MOB-22 Push notification fix',
        color: getColor('Mobile App'),
        startHour: 9,
        endHour: 12,
      },
    ],
    absences: [{ id: 'abs10-1', reason: 'Doctor appointment', startHour: 13, endHour: 15 }],
  },
  {
    id: '11',
    name: 'Chloe Bennett',
    initials: 'CB',
    role: 'Designer',
    status: 'available',
    scheduleStart: 10,
    scheduleEnd: 18,
    timezone: 'CET',
    currentProject: 'Mobile App',
    currentTask: 'MOB-23 Onboarding flow redesign',
    entries: [
      {
        id: 'e11-1',
        project: 'Design System',
        description: 'DS-43 Icon library update',
        color: getColor('Design System'),
        startHour: 10,
        endHour: 11.5,
      },
      {
        id: 'e11-2',
        project: 'Mobile App',
        description: 'MOB-23 Onboarding flow redesign',
        color: getColor('Mobile App'),
        startHour: 12,
        endHour: null,
        running: true,
      },
    ],
  },
  {
    id: '12',
    name: 'Daniel Yeo',
    initials: 'DY',
    role: 'Backend Developer',
    status: 'working-off-hours',
    scheduleStart: 16,
    scheduleEnd: 24,
    timezone: 'SGT',
    currentProject: 'Data Pipeline',
    currentTask: 'DATA-15 ETL job optimization',
    entries: [
      {
        id: 'e12-1',
        project: 'Data Pipeline',
        description: 'DATA-15 ETL job optimization',
        color: getColor('Data Pipeline'),
        startHour: 12.5,
        endHour: null,
        running: true,
      },
    ],
  },
  {
    id: '13',
    name: 'Isla Novak',
    initials: 'IN',
    role: 'QA Lead',
    status: 'off-schedule',
    scheduleStart: 7,
    scheduleEnd: 15,
    timezone: 'CET',
    entries: [
      {
        id: 'e13-1',
        project: 'QA Automation',
        description: 'QA-85 Test framework upgrade',
        color: getColor('QA Automation'),
        startHour: 7,
        endHour: 9.5,
      },
      {
        id: 'e13-2',
        project: 'QA Automation',
        description: 'QA-86 Performance test suite',
        color: getColor('QA Automation'),
        startHour: 9.5,
        endHour: 12,
      },
      {
        id: 'e13-3',
        project: 'Platform Core',
        description: 'QA signoff for PROJ-339',
        color: getColor('Platform Core'),
        startHour: 12.5,
        endHour: 15,
      },
    ],
  },
  {
    id: '14',
    name: 'Kai Lund',
    initials: 'KL',
    role: 'Junior Developer',
    status: 'on-leave',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    entries: [],
  },
];

// ============================================================
// Helpers
// ============================================================

/** Return dark or light text for a given background color (hex or hsl) */
function textForColor(color: string): string {
  let r = 0,
    g = 0,
    b = 0;
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex?.[1]) {
    r = parseInt(hex[1].slice(0, 2), 16);
    g = parseInt(hex[1].slice(2, 4), 16);
    b = parseInt(hex[1].slice(4, 6), 16);
  } else {
    return '#fff'; // fallback
  }
  // Perceived brightness (ITU-R BT.601)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a1a' : '#f8f8f8';
}

function fmtHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min.toString().padStart(2, '0')}m` : `${min}m`;
}

function entryDurationMin(entry: TimeEntry): number {
  const end = entry.endHour ?? NOW_HOUR;
  return Math.round((end - entry.startHour) * 60);
}

/** Collect all unique project names across all team members */
function getAllProjects(): string[] {
  const set = new Set<string>();
  MOCK_TEAM.forEach((p) => p.entries.forEach((e) => set.add(e.project)));
  return Array.from(set).sort();
}

/** Check if a person has any entries for the given project */
function personHasProject(person: MockPerson, project: string): boolean {
  return person.entries.some((e) => e.project === project);
}

const ALL_PROJECTS = getAllProjects();

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
  away: {
    dot: 'bg-violet-400',
    bg: 'bg-violet-400/10',
    text: 'text-violet-400',
    label: 'Away',
    sortOrder: 2.5,
  },
  'off-schedule': {
    dot: 'bg-muted-foreground/40',
    bg: 'bg-muted-foreground/6',
    text: 'text-muted-foreground/60',
    label: 'Off Hours',
    sortOrder: 3,
  },
  'on-leave': {
    dot: 'bg-indigo-400',
    bg: 'bg-indigo-400/10',
    text: 'text-indigo-400',
    label: 'On Leave',
    sortOrder: 4,
  },
};

type StatusFilter = 'all' | PresenceStatus;

// ============================================================
// Status Badge (explicit, like original Team Board)
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
}: {
  value: string | null;
  onChange: (project: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = value ?? 'All Projects';
  const selectedColor = value ? getColor(value) : undefined;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-1.5 font-medium transition-colors',
          value
            ? 'border-primary/30 bg-primary/5 text-foreground'
            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/20',
        )}
        style={{ fontSize: scaled(11) }}
      >
        {selectedColor && (
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedColor }} />
        )}
        {selectedLabel}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-[hsl(var(--t-surface))] py-1 shadow-xl"
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
              {ALL_PROJECTS.map((p) => (
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
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getColor(p) }} />
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

const TIMELINE_START = 7;
const TIMELINE_END = 20;
const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

function toPercent(hour: number): number {
  return Math.max(0, Math.min(100, ((hour - TIMELINE_START) / TIMELINE_SPAN) * 100));
}

function TimelineRow({
  person,
  highlightProject,
}: {
  person: MockPerson;
  highlightProject: string | null;
}) {
  const [hoveredEntry, setHoveredEntry] = useState<TimeEntry | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  const schedLeft = toPercent(person.scheduleStart);
  const schedRight = toPercent(person.scheduleEnd);
  const schedWidth = schedRight - schedLeft;
  const nowPos = toPercent(NOW_HOUR);

  const isOnLeave = person.status === 'on-leave';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'grid items-center gap-0 rounded-lg border border-border bg-[hsl(var(--t-surface))] transition-colors hover:border-primary/20',
        (person.status === 'off-schedule' || person.status === 'on-leave') && 'opacity-50',
      )}
      style={{ gridTemplateColumns: '200px 120px 1fr' }}
    >
      {/* Person info */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="relative">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]"
            style={{ fontSize: 11 }}
          >
            {person.initials}
          </div>
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--t-surface))]',
              STATUS_META[person.status].dot,
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground" style={{ fontSize: scaled(12) }}>
            {person.name}
          </div>
          <div className="truncate text-muted-foreground" style={{ fontSize: scaled(9) }}>
            {person.role}
          </div>
        </div>
      </div>

      {/* Status column — single-line pill */}
      <div className="flex items-center px-2">
        <PresenceBadge status={person.status} />
      </div>

      {/* Timeline */}
      <div className="relative py-2 pr-3">
        <div className="relative h-8 overflow-hidden rounded bg-muted/30">
          {/* Scheduled block background — skip for off-hours and on-leave */}
          {!isOnLeave && person.status !== 'off-schedule' && (
            <div
              className="absolute top-0 h-full rounded border-l border-r bg-primary/5 border-primary/10"
              style={{ left: `${schedLeft}%`, width: `${schedWidth}%` }}
            />
          )}

          {/* Absence blocks — background layer, overrides part of the schedule */}
          {person.absences?.map((abs) => {
            const left = toPercent(abs.startHour);
            const width = toPercent(abs.endHour) - left;
            return (
              <div
                key={abs.id}
                className="absolute top-0 h-full rounded-sm bg-violet-400/10"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.5)}%`,
                }}
                title={abs.reason}
              />
            );
          })}

          {/* On leave bar */}
          {isOnLeave && (
            <div
              className="absolute top-0 h-full rounded bg-indigo-400/10"
              style={{ left: `${schedLeft}%`, width: `${schedWidth}%` }}
            >
              <div
                className="flex h-full items-center justify-center font-brand uppercase tracking-widest text-indigo-400/60"
                style={{ fontSize: scaled(9) }}
              >
                On Leave
              </div>
            </div>
          )}

          {/* Entry blocks */}
          {person.entries.map((entry) => {
            const endH = entry.endHour ?? NOW_HOUR;
            const left = toPercent(entry.startHour);
            const width = toPercent(endH) - left;
            const isHighlightedProject = highlightProject && entry.project === highlightProject;
            const isDimmed = highlightProject && entry.project !== highlightProject;

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
                    backgroundColor: entry.color,
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
                      color: textForColor(entry.color),
                    }}
                  >
                    {entry.project}
                  </span>
                )}
                {entry.running && (
                  <motion.div
                    className="absolute right-0 top-0 h-full w-1 rounded-r-sm"
                    style={{ backgroundColor: entry.color }}
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
                    style={{ backgroundColor: hoveredEntry.color }}
                  />
                  <span className="text-muted-foreground">{hoveredEntry.project}</span>
                </div>
                {/* Description */}
                <div
                  className="mt-0.5 truncate font-medium text-foreground"
                  style={{ fontSize: scaled(10), maxWidth: '250px' }}
                >
                  {hoveredEntry.description}
                </div>
                {/* Time + duration */}
                <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(9) }}>
                  {fmtHour(hoveredEntry.startHour)} –{' '}
                  {hoveredEntry.endHour ? fmtHour(hoveredEntry.endHour) : 'now'}
                  <span className="ml-2 text-muted-foreground/70">
                    {fmtMin(entryDurationMin(hoveredEntry))}
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
    { key: 'away', label: 'Away', icon: CalendarOff },
    { key: 'off-schedule', label: 'Off Schedule', icon: Moon },
    { key: 'on-leave', label: 'On Leave', icon: Palmtree },
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

const queryClient = new QueryClient();

export function DevPresenceV5Page() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string | null>(USER_DEFAULT_PROJECT);
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: MOCK_TEAM.length,
      available: 0,
      'working-off-hours': 0,
      idle: 0,
      away: 0,
      'off-schedule': 0,
      'on-leave': 0,
    };
    MOCK_TEAM.forEach((p) => {
      c[p.status]++;
    });
    return c;
  }, []);

  const filtered = useMemo(() => {
    let list = MOCK_TEAM;

    // Status filter
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter);

    // Project filter — show people who have entries for this project
    if (projectFilter) list = list.filter((p) => personHasProject(p, projectFilter));

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.role.toLowerCase().includes(q) ||
          p.currentProject?.toLowerCase().includes(q),
      );
    }

    return [...list].sort(
      (a, b) => STATUS_META[a.status].sortOrder - STATUS_META[b.status].sortOrder,
    );
  }, [statusFilter, projectFilter, search]);

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <div className="min-h-screen bg-background text-foreground">
          <DevToolbar />
          <div className="mx-auto max-w-[1200px] p-6">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
                Exploration 5 — Timeline Roster + Status
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                V2 evolved: explicit status column, project filter (defaults to your project), no
                hour totals between people.
              </p>
            </div>

            {/* Top bar */}
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2
                  className="font-brand text-foreground"
                  style={{ fontSize: scaled(18), fontWeight: 600, letterSpacing: '1px' }}
                >
                  Team Presence
                </h2>
                <p className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  Monday, 17 Feb · 14:30
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ProjectFilter value={projectFilter} onChange={setProjectFilter} />
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search team..."
                    className="w-[200px] rounded-lg border border-border bg-muted/50 py-1.5 pl-8 pr-3 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
                    style={{ fontSize: scaled(11) }}
                  />
                </div>
              </div>
            </div>

            {/* Status filter pills */}
            <div className="mb-3">
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
                {filtered.map((person) => (
                  <TimelineRow key={person.id} person={person} highlightProject={projectFilter} />
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <div
                  className="py-10 text-center text-muted-foreground"
                  style={{ fontSize: scaled(13) }}
                >
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
                <span className="inline-block h-3 w-6 rounded-sm bg-violet-400/10" />
                Planned absence
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-3 w-6 rounded-sm bg-indigo-400/10" />
                On Leave
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-3 w-0.5 bg-destructive" />
                Now
              </span>
            </div>
          </div>
        </div>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
