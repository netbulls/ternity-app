import { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Search, Users, Clock, Palmtree, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// Types
// ============================================================

type PresenceStatus = 'available' | 'working-off-hours' | 'idle' | 'off-schedule' | 'on-leave';

interface TimeEntry {
  id: string;
  project: string;
  description: string;
  color: string;
  startHour: number; // decimal, e.g. 9.5 = 09:30
  endHour: number | null; // null = running
  running?: boolean;
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
  tzOffset: number; // hours from UTC
  currentProject?: string;
  currentTask?: string;
  loggedMinutes: number;
  entries: TimeEntry[];
}

// ============================================================
// Mock Data — 14 Team Members
// ============================================================

const NOW_HOUR = 14.5; // 14:30

const PROJECT_COLORS = {
  'Platform Core': 'hsl(170, 80%, 45%)', // teal
  'Mobile App': 'hsl(25, 90%, 55%)', // orange
  'Design System': 'hsl(270, 60%, 55%)', // purple
  'API Gateway': 'hsl(210, 70%, 55%)', // blue
  'Data Pipeline': 'hsl(340, 65%, 55%)', // pink
  'QA Automation': 'hsl(45, 85%, 50%)', // gold
  'Client Portal': 'hsl(150, 60%, 45%)', // green
  DevOps: 'hsl(190, 70%, 50%)', // cyan
};

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
    tzOffset: 1,
    currentProject: 'Platform Core',
    currentTask: 'PROJ-341 Fix pagination edge case',
    loggedMinutes: 312,
    entries: [
      {
        id: 'e1-1',
        project: 'Platform Core',
        description: 'PROJ-341 Fix pagination edge case',
        color: PROJECT_COLORS['Platform Core'],
        startHour: 9,
        endHour: 12,
      },
      {
        id: 'e1-2',
        project: 'Platform Core',
        description: 'Code review — auth middleware',
        color: PROJECT_COLORS['Platform Core'],
        startHour: 12.5,
        endHour: 13.5,
      },
      {
        id: 'e1-3',
        project: 'Platform Core',
        description: 'PROJ-345 Implement presence API',
        color: PROJECT_COLORS['Platform Core'],
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
    tzOffset: 1,
    currentProject: 'API Gateway',
    currentTask: 'AUTH-128 Rate limiter refactor',
    loggedMinutes: 288,
    entries: [
      {
        id: 'e2-1',
        project: 'API Gateway',
        description: 'AUTH-128 Rate limiter refactor',
        color: PROJECT_COLORS['API Gateway'],
        startHour: 9,
        endHour: 11.5,
      },
      {
        id: 'e2-2',
        project: 'Platform Core',
        description: 'PR review for Elena',
        color: PROJECT_COLORS['Platform Core'],
        startHour: 11.5,
        endHour: 12,
      },
      {
        id: 'e2-3',
        project: 'API Gateway',
        description: 'AUTH-129 Token rotation',
        color: PROJECT_COLORS['API Gateway'],
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
    tzOffset: 1,
    currentProject: 'Design System',
    currentTask: 'DS-45 New date picker variants',
    loggedMinutes: 216,
    entries: [
      {
        id: 'e3-1',
        project: 'Design System',
        description: 'DS-44 Button states audit',
        color: PROJECT_COLORS['Design System'],
        startHour: 10,
        endHour: 12.5,
      },
      {
        id: 'e3-2',
        project: 'Design System',
        description: 'DS-45 New date picker variants',
        color: PROJECT_COLORS['Design System'],
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
    status: 'idle',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    tzOffset: 1,
    loggedMinutes: 264,
    entries: [
      {
        id: 'e4-1',
        project: 'Platform Core',
        description: 'PROJ-340 DB migration script',
        color: PROJECT_COLORS['Platform Core'],
        startHour: 9,
        endHour: 11,
      },
      {
        id: 'e4-2',
        project: 'Platform Core',
        description: 'PROJ-342 Cache invalidation',
        color: PROJECT_COLORS['Platform Core'],
        startHour: 11.5,
        endHour: 13.5,
      },
    ],
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
    tzOffset: 1,
    currentProject: 'QA Automation',
    currentTask: 'QA-89 E2E presence tests',
    loggedMinutes: 342,
    entries: [
      {
        id: 'e5-1',
        project: 'QA Automation',
        description: 'QA-88 Regression suite run',
        color: PROJECT_COLORS['QA Automation'],
        startHour: 8,
        endHour: 10.5,
      },
      {
        id: 'e5-2',
        project: 'Platform Core',
        description: 'QA-87 Bug repro for PROJ-341',
        color: PROJECT_COLORS['Platform Core'],
        startHour: 10.5,
        endHour: 12,
      },
      {
        id: 'e5-3',
        project: 'QA Automation',
        description: 'QA-89 E2E presence tests',
        color: PROJECT_COLORS['QA Automation'],
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
    tzOffset: 1,
    loggedMinutes: 0,
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
    tzOffset: 9,
    loggedMinutes: 0,
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
    tzOffset: 1,
    currentProject: 'DevOps',
    currentTask: 'OPS-55 K8s cluster upgrade',
    loggedMinutes: 340,
    entries: [
      {
        id: 'e8-1',
        project: 'DevOps',
        description: 'OPS-54 Monitoring alerts config',
        color: PROJECT_COLORS['DevOps'],
        startHour: 8,
        endHour: 10,
      },
      {
        id: 'e8-2',
        project: 'DevOps',
        description: 'OPS-55 K8s cluster upgrade',
        color: PROJECT_COLORS['DevOps'],
        startHour: 10.5,
        endHour: 12.5,
      },
      {
        id: 'e8-3',
        project: 'DevOps',
        description: 'OPS-55 K8s cluster upgrade cont.',
        color: PROJECT_COLORS['DevOps'],
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
    tzOffset: 1,
    currentProject: 'Platform Core',
    currentTask: 'Sprint planning & backlog',
    loggedMinutes: 270,
    entries: [
      {
        id: 'e9-1',
        project: 'Platform Core',
        description: 'Sprint planning meeting',
        color: PROJECT_COLORS['Platform Core'],
        startHour: 9,
        endHour: 10.5,
      },
      {
        id: 'e9-2',
        project: 'Client Portal',
        description: 'Client demo prep',
        color: PROJECT_COLORS['Client Portal'],
        startHour: 10.5,
        endHour: 12,
      },
      {
        id: 'e9-3',
        project: 'Platform Core',
        description: 'Backlog grooming',
        color: PROJECT_COLORS['Platform Core'],
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
    status: 'idle',
    scheduleStart: 9,
    scheduleEnd: 17,
    timezone: 'CET',
    tzOffset: 1,
    loggedMinutes: 180,
    entries: [
      {
        id: 'e10-1',
        project: 'Mobile App',
        description: 'MOB-22 Push notification fix',
        color: PROJECT_COLORS['Mobile App'],
        startHour: 9,
        endHour: 12,
      },
    ],
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
    tzOffset: 1,
    currentProject: 'Mobile App',
    currentTask: 'MOB-23 Onboarding flow redesign',
    loggedMinutes: 195,
    entries: [
      {
        id: 'e11-1',
        project: 'Design System',
        description: 'DS-43 Icon library update',
        color: PROJECT_COLORS['Design System'],
        startHour: 10,
        endHour: 11.5,
      },
      {
        id: 'e11-2',
        project: 'Mobile App',
        description: 'MOB-23 Onboarding flow redesign',
        color: PROJECT_COLORS['Mobile App'],
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
    tzOffset: 8,
    currentProject: 'Data Pipeline',
    currentTask: 'DATA-15 ETL job optimization',
    loggedMinutes: 120,
    entries: [
      {
        id: 'e12-1',
        project: 'Data Pipeline',
        description: 'DATA-15 ETL job optimization',
        color: PROJECT_COLORS['Data Pipeline'],
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
    tzOffset: 1,
    loggedMinutes: 420,
    entries: [
      {
        id: 'e13-1',
        project: 'QA Automation',
        description: 'QA-85 Test framework upgrade',
        color: PROJECT_COLORS['QA Automation'],
        startHour: 7,
        endHour: 9.5,
      },
      {
        id: 'e13-2',
        project: 'QA Automation',
        description: 'QA-86 Performance test suite',
        color: PROJECT_COLORS['QA Automation'],
        startHour: 9.5,
        endHour: 12,
      },
      {
        id: 'e13-3',
        project: 'Platform Core',
        description: 'QA signoff for PROJ-339',
        color: PROJECT_COLORS['Platform Core'],
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
    tzOffset: 1,
    loggedMinutes: 0,
    entries: [],
  },
];

// ============================================================
// Helpers
// ============================================================

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min.toString().padStart(2, '0')}m` : `${min}m`;
}

function fmtHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function entryDurationMin(entry: TimeEntry): number {
  const end = entry.endHour ?? NOW_HOUR;
  return Math.round((end - entry.startHour) * 60);
}

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
    label: 'Working (off-hours)',
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
    label: 'Off Schedule',
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

type FilterKey = 'all' | PresenceStatus;

// ============================================================
// Timeline Component
// ============================================================

const TIMELINE_START = 7;
const TIMELINE_END = 20;
const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

function toPercent(hour: number): number {
  return Math.max(0, Math.min(100, ((hour - TIMELINE_START) / TIMELINE_SPAN) * 100));
}

function TimelineRow({ person }: { person: MockPerson }) {
  const [hoveredEntry, setHoveredEntry] = useState<TimeEntry | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  const schedLeft = toPercent(person.scheduleStart);
  const schedRight = toPercent(person.scheduleEnd);
  const schedWidth = schedRight - schedLeft;
  const nowPos = toPercent(NOW_HOUR);

  // Calculate idle gaps during scheduled hours (past only, up to now or schedule end)
  const effectiveEnd = Math.min(person.scheduleEnd, NOW_HOUR);
  const isOnLeave = person.status === 'on-leave';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-center gap-0 rounded-lg border border-border bg-[hsl(var(--t-surface))] transition-colors hover:border-primary/20',
        (person.status === 'off-schedule' || person.status === 'on-leave') && 'opacity-50',
      )}
    >
      {/* Left: Person info */}
      <div className="flex w-[200px] flex-shrink-0 items-center gap-2.5 px-3 py-2.5">
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
          {person.currentProject && (
            <div className="truncate text-primary/80" style={{ fontSize: scaled(9) }}>
              {person.currentProject}
            </div>
          )}
        </div>
      </div>

      {/* Right: Timeline */}
      <div className="relative flex-1 py-2 pr-3">
        <div className="relative h-8 overflow-hidden rounded bg-muted/30">
          {/* Scheduled block background */}
          {!isOnLeave && (
            <div
              className="absolute top-0 h-full rounded bg-primary/5 border-l border-r border-primary/10"
              style={{ left: `${schedLeft}%`, width: `${schedWidth}%` }}
            />
          )}

          {/* On leave full bar */}
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

          {/* Idle/gap hatching during scheduled hours (only for available/idle within schedule) */}
          {!isOnLeave &&
            person.status !== 'off-schedule' &&
            person.scheduleStart < effectiveEnd && (
              <div
                className="absolute top-0 h-full"
                style={{
                  left: `${toPercent(person.scheduleStart)}%`,
                  width: `${toPercent(effectiveEnd) - toPercent(person.scheduleStart)}%`,
                  backgroundImage:
                    'repeating-linear-gradient(-45deg, transparent, transparent 4px, hsl(45 90% 50% / 0.06) 4px, hsl(45 90% 50% / 0.06) 8px)',
                }}
              />
            )}

          {/* Logged entry blocks */}
          {person.entries.map((entry) => {
            const endH = entry.endHour ?? NOW_HOUR;
            const left = toPercent(entry.startHour);
            const width = toPercent(endH) - left;
            return (
              <motion.div
                key={entry.id}
                className="absolute top-1.5 h-5 cursor-pointer rounded-sm transition-opacity hover:opacity-90"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.5)}%`,
                  backgroundColor: entry.color,
                  opacity: entry.running ? 0.9 : 0.6,
                }}
                onMouseEnter={(e) => {
                  setHoveredEntry(entry);
                  const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (rect) setTooltipX(e.clientX - rect.left);
                }}
                onMouseLeave={() => setHoveredEntry(null)}
              >
                {/* Running pulse */}
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
                className="absolute -top-[56px] z-20 rounded-md border border-border bg-[hsl(var(--t-surface))] px-2.5 py-1.5 shadow-lg"
                style={{ left: Math.min(Math.max(tooltipX - 60, 0), 200), whiteSpace: 'nowrap' }}
              >
                <div className="font-medium text-foreground" style={{ fontSize: scaled(10) }}>
                  {hoveredEntry.description}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: scaled(9) }}>
                  {hoveredEntry.project} · {fmtHour(hoveredEntry.startHour)} –{' '}
                  {hoveredEntry.endHour ? fmtHour(hoveredEntry.endHour) : 'now'} ·{' '}
                  {fmtMin(entryDurationMin(hoveredEntry))}
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
// Filter Bar
// ============================================================

function FilterBar({
  active,
  onChange,
  counts,
}: {
  active: FilterKey;
  onChange: (f: FilterKey) => void;
  counts: Record<FilterKey, number>;
}) {
  const pills: { key: FilterKey; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'All', icon: Users },
    { key: 'available', label: 'Available', icon: Clock },
    { key: 'idle', label: 'Idle', icon: Clock },
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

export function DevPresenceV2Page() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: MOCK_TEAM.length,
      available: 0,
      'working-off-hours': 0,
      idle: 0,
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
    if (filter !== 'all') list = list.filter((p) => p.status === filter);
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
  }, [filter, search]);

  const summaryParts = [
    counts.available > 0 && `${counts.available} available`,
    counts['working-off-hours'] > 0 && `${counts['working-off-hours']} off-hours`,
    counts.idle > 0 && `${counts.idle} idle`,
    counts['on-leave'] > 0 && `${counts['on-leave']} on leave`,
    counts['off-schedule'] > 0 && `${counts['off-schedule']} off schedule`,
  ].filter(Boolean);

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <div className="min-h-screen bg-background text-foreground">
          <DevToolbar />
          <div className="mx-auto max-w-[1200px] p-6">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
                Exploration 2 — Timeline Roster
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Full-day timeline per person. Horizontal bars show logged entries, idle gaps, and
                current activity at a glance.
              </p>
            </div>

            {/* Top bar */}
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
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
              </div>
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

            {/* Filter pills */}
            <div className="mb-3 flex items-center justify-between">
              <FilterBar active={filter} onChange={setFilter} counts={counts} />
              <div className="text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                {summaryParts.join(' · ')}
              </div>
            </div>

            {/* Timeline header */}
            <div className="mb-1 flex items-center gap-0 px-0">
              <div className="w-[200px] flex-shrink-0 px-3">
                <span
                  className="font-brand uppercase tracking-wider text-muted-foreground/50"
                  style={{ fontSize: scaled(9), fontWeight: 600 }}
                >
                  Team Member
                </span>
              </div>
              <div className="relative flex-1 pr-3">
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
                  <TimelineRow key={person.id} person={person} />
                ))}
              </AnimatePresence>
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
                <span
                  className="inline-block h-3 w-6 rounded-sm"
                  style={{ backgroundColor: PROJECT_COLORS['Platform Core'], opacity: 0.6 }}
                />
                Logged entry
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-3 w-6 rounded-sm"
                  style={{ backgroundColor: PROJECT_COLORS['Platform Core'], opacity: 0.9 }}
                >
                  <motion.span
                    className="block h-full w-1 rounded-r-sm ml-auto"
                    style={{ backgroundColor: PROJECT_COLORS['Platform Core'] }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </span>
                Running timer
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-3 w-6 rounded-sm border border-primary/10 bg-primary/5" />
                Scheduled hours
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-3 w-6 rounded-sm"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(-45deg, transparent, transparent 2px, hsl(45 90% 50% / 0.12) 2px, hsl(45 90% 50% / 0.12) 4px)',
                  }}
                />
                Idle gap
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-3 w-0.5 bg-destructive" />
                Now (14:30)
              </span>
            </div>
          </div>
        </div>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
