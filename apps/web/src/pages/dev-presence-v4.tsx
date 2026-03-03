import { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// Types
// ============================================================

type PresenceStatus = 'available' | 'working-off-hours' | 'idle' | 'off-schedule' | 'on-leave';

type CellState = 'active' | 'logged' | 'idle' | 'empty' | 'leave' | 'future-scheduled';

interface HalfHourCell {
  hour: number; // 7, 7.5, 8, 8.5, ...
  state: CellState;
  project?: string;
  description?: string;
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
  loggedMinutes: number;
  cells: HalfHourCell[];
}

// ============================================================
// Mock Data Builder
// ============================================================

const NOW_HOUR = 14.5; // 14:30
const GRID_START = 7;
const GRID_END = 20;
const HALF_HOURS = (GRID_END - GRID_START) * 2; // 26 half-hour slots

function buildCells(
  scheduleStart: number,
  scheduleEnd: number,
  status: PresenceStatus,
  entries: { startHour: number; endHour: number; project: string; description: string }[],
): HalfHourCell[] {
  const cells: HalfHourCell[] = [];

  for (let i = 0; i < HALF_HOURS; i++) {
    const hour = GRID_START + i * 0.5;
    const isScheduled = hour >= scheduleStart && hour < scheduleEnd;
    const isPast = hour < NOW_HOUR;
    const isCurrent = hour <= NOW_HOUR && hour + 0.5 > NOW_HOUR;

    if (status === 'on-leave' && isScheduled) {
      cells.push({ hour, state: 'leave' });
      continue;
    }

    // Check if there's an entry covering this half hour
    const entry = entries.find((e) => hour >= e.startHour && hour < e.endHour);

    if (entry) {
      const isRunning = entry.endHour > NOW_HOUR && isCurrent;
      cells.push({
        hour,
        state: isRunning ? 'active' : 'logged',
        project: entry.project,
        description: entry.description,
      });
    } else if (isScheduled && isPast) {
      cells.push({ hour, state: 'idle' });
    } else if (isScheduled && !isPast) {
      cells.push({ hour, state: 'future-scheduled' });
    } else {
      cells.push({ hour, state: 'empty' });
    }
  }
  return cells;
}

// ============================================================
// 14 Team Members
// ============================================================

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
    loggedMinutes: 312,
    cells: buildCells(9, 17, 'available', [
      {
        startHour: 9,
        endHour: 12,
        project: 'Platform Core',
        description: 'PROJ-341 Fix pagination edge case',
      },
      {
        startHour: 12.5,
        endHour: 13.5,
        project: 'Platform Core',
        description: 'Code review — auth middleware',
      },
      {
        startHour: 13.5,
        endHour: 15,
        project: 'Platform Core',
        description: 'PROJ-345 Implement presence API',
      },
    ]),
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
    loggedMinutes: 288,
    cells: buildCells(9, 17, 'available', [
      {
        startHour: 9,
        endHour: 11.5,
        project: 'API Gateway',
        description: 'AUTH-128 Rate limiter refactor',
      },
      {
        startHour: 11.5,
        endHour: 12,
        project: 'Platform Core',
        description: 'PR review for Elena',
      },
      {
        startHour: 13,
        endHour: 15,
        project: 'API Gateway',
        description: 'AUTH-129 Token rotation',
      },
    ]),
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
    loggedMinutes: 420,
    cells: buildCells(7, 15, 'off-schedule', [
      {
        startHour: 7,
        endHour: 9.5,
        project: 'QA Automation',
        description: 'QA-85 Test framework upgrade',
      },
      {
        startHour: 9.5,
        endHour: 12,
        project: 'QA Automation',
        description: 'QA-86 Performance test suite',
      },
      {
        startHour: 12.5,
        endHour: 15,
        project: 'Platform Core',
        description: 'QA signoff for PROJ-339',
      },
    ]),
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
    loggedMinutes: 342,
    cells: buildCells(8, 16, 'available', [
      {
        startHour: 8,
        endHour: 10.5,
        project: 'QA Automation',
        description: 'QA-88 Regression suite run',
      },
      {
        startHour: 10.5,
        endHour: 12,
        project: 'Platform Core',
        description: 'QA-87 Bug repro for PROJ-341',
      },
      {
        startHour: 12.5,
        endHour: 15,
        project: 'QA Automation',
        description: 'QA-89 E2E presence tests',
      },
    ]),
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
    loggedMinutes: 340,
    cells: buildCells(8, 16, 'available', [
      {
        startHour: 8,
        endHour: 10,
        project: 'DevOps',
        description: 'OPS-54 Monitoring alerts config',
      },
      {
        startHour: 10.5,
        endHour: 12.5,
        project: 'DevOps',
        description: 'OPS-55 K8s cluster upgrade',
      },
      {
        startHour: 13,
        endHour: 15,
        project: 'DevOps',
        description: 'OPS-55 K8s cluster upgrade cont.',
      },
    ]),
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
    loggedMinutes: 264,
    cells: buildCells(9, 17, 'idle', [
      {
        startHour: 9,
        endHour: 11,
        project: 'Platform Core',
        description: 'PROJ-340 DB migration script',
      },
      {
        startHour: 11.5,
        endHour: 13.5,
        project: 'Platform Core',
        description: 'PROJ-342 Cache invalidation',
      },
    ]),
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
    loggedMinutes: 270,
    cells: buildCells(9, 17, 'available', [
      {
        startHour: 9,
        endHour: 10.5,
        project: 'Platform Core',
        description: 'Sprint planning meeting',
      },
      { startHour: 10.5, endHour: 12, project: 'Client Portal', description: 'Client demo prep' },
      { startHour: 13, endHour: 15, project: 'Platform Core', description: 'Backlog grooming' },
    ]),
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
    loggedMinutes: 180,
    cells: buildCells(9, 17, 'idle', [
      {
        startHour: 9,
        endHour: 12,
        project: 'Mobile App',
        description: 'MOB-22 Push notification fix',
      },
    ]),
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
    loggedMinutes: 0,
    cells: buildCells(9, 17, 'on-leave', []),
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
    loggedMinutes: 0,
    cells: buildCells(9, 17, 'on-leave', []),
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
    loggedMinutes: 216,
    cells: buildCells(10, 18, 'available', [
      {
        startHour: 10,
        endHour: 12.5,
        project: 'Design System',
        description: 'DS-44 Button states audit',
      },
      {
        startHour: 13,
        endHour: 15,
        project: 'Design System',
        description: 'DS-45 New date picker variants',
      },
    ]),
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
    loggedMinutes: 195,
    cells: buildCells(10, 18, 'available', [
      {
        startHour: 10,
        endHour: 11.5,
        project: 'Design System',
        description: 'DS-43 Icon library update',
      },
      {
        startHour: 12,
        endHour: 15,
        project: 'Mobile App',
        description: 'MOB-23 Onboarding flow redesign',
      },
    ]),
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
    loggedMinutes: 120,
    cells: buildCells(16, 24, 'working-off-hours', [
      {
        startHour: 12.5,
        endHour: 15,
        project: 'Data Pipeline',
        description: 'DATA-15 ETL job optimization',
      },
    ]),
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
    loggedMinutes: 0,
    cells: buildCells(16, 24, 'off-schedule', []),
  },
];

// Sort by schedule start time
const SORTED_TEAM = [...MOCK_TEAM].sort((a, b) => a.scheduleStart - b.scheduleStart);

// ============================================================
// Helpers & Constants
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

const CELL_STYLES: Record<CellState, { bg: string; border: string; hoverBg: string }> = {
  active: {
    bg: 'bg-emerald-500/60',
    border: 'border-emerald-500/30',
    hoverBg: 'hover:bg-emerald-500/70',
  },
  logged: { bg: 'bg-primary/35', border: 'border-primary/20', hoverBg: 'hover:bg-primary/45' },
  idle: { bg: 'bg-amber-500/20', border: 'border-amber-500/15', hoverBg: 'hover:bg-amber-500/30' },
  empty: { bg: 'bg-transparent', border: 'border-transparent', hoverBg: '' },
  leave: {
    bg: 'bg-indigo-400/20',
    border: 'border-indigo-400/15',
    hoverBg: 'hover:bg-indigo-400/30',
  },
  'future-scheduled': {
    bg: 'bg-muted/30',
    border: 'border-muted/20',
    hoverBg: 'hover:bg-muted/40',
  },
};

type FilterKey = 'all' | PresenceStatus;

// ============================================================
// Components
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
  const pills: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'available', label: 'Available' },
    { key: 'idle', label: 'Idle' },
    { key: 'off-schedule', label: 'Off Schedule' },
    { key: 'on-leave', label: 'On Leave' },
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

function CellTooltip({ cell }: { cell: HalfHourCell }) {
  const hourLabel = `${Math.floor(cell.hour)}:${cell.hour % 1 === 0 ? '00' : '30'}`;
  const endLabel = `${Math.floor(cell.hour + 0.5)}:${(cell.hour + 0.5) % 1 === 0 ? '00' : '30'}`;

  return (
    <div
      className="rounded-md border border-border bg-[hsl(var(--t-surface))] px-2.5 py-1.5 shadow-lg"
      style={{ minWidth: 140 }}
    >
      <div className="font-brand font-medium text-foreground" style={{ fontSize: scaled(10) }}>
        {hourLabel} – {endLabel}
      </div>
      {cell.state === 'active' && (
        <>
          <div className="mt-0.5 text-emerald-500" style={{ fontSize: scaled(9) }}>
            Timer running
          </div>
          {cell.project && (
            <div className="text-primary/80" style={{ fontSize: scaled(9) }}>
              {cell.project}
            </div>
          )}
          {cell.description && (
            <div className="text-muted-foreground" style={{ fontSize: scaled(8) }}>
              {cell.description}
            </div>
          )}
        </>
      )}
      {cell.state === 'logged' && (
        <>
          <div className="mt-0.5 text-primary/80" style={{ fontSize: scaled(9) }}>
            Logged
          </div>
          {cell.project && (
            <div className="text-muted-foreground" style={{ fontSize: scaled(9) }}>
              {cell.project}
            </div>
          )}
          {cell.description && (
            <div className="text-muted-foreground/70" style={{ fontSize: scaled(8) }}>
              {cell.description}
            </div>
          )}
        </>
      )}
      {cell.state === 'idle' && (
        <div className="mt-0.5 text-amber-500" style={{ fontSize: scaled(9) }}>
          Idle — no entry
        </div>
      )}
      {cell.state === 'leave' && (
        <div className="mt-0.5 text-indigo-400" style={{ fontSize: scaled(9) }}>
          On leave
        </div>
      )}
      {cell.state === 'future-scheduled' && (
        <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(9) }}>
          Scheduled (upcoming)
        </div>
      )}
      {cell.state === 'empty' && (
        <div className="mt-0.5 text-muted-foreground/40" style={{ fontSize: scaled(9) }}>
          Not scheduled
        </div>
      )}
    </div>
  );
}

function HeatCell({ cell }: { cell: HalfHourCell }) {
  const [hovered, setHovered] = useState(false);
  const styles = CELL_STYLES[cell.state];
  const isNowSlot = cell.hour <= NOW_HOUR && cell.hour + 0.5 > NOW_HOUR;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          'h-6 w-full rounded-[2px] border transition-colors cursor-pointer',
          styles.bg,
          styles.border,
          styles.hoverBg,
          cell.state === 'active' && 'ring-1 ring-emerald-500/40',
        )}
      >
        {/* Active pulse */}
        {cell.state === 'active' && (
          <motion.div
            className="absolute inset-0 rounded-[2px] bg-emerald-500/20"
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        {/* Idle hatch pattern */}
        {cell.state === 'idle' && (
          <div
            className="absolute inset-0 rounded-[2px]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, transparent, transparent 2px, hsl(45 90% 50% / 0.08) 2px, hsl(45 90% 50% / 0.08) 4px)',
            }}
          />
        )}
      </div>
      {/* Now indicator line */}
      {isNowSlot && (
        <div
          className="absolute top-0 bottom-0 z-10 w-0.5 bg-destructive pointer-events-none"
          style={{ left: '50%' }}
        />
      )}
      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.1 }}
            className="absolute -top-[80px] left-1/2 z-30 -translate-x-1/2"
          >
            <CellTooltip cell={cell} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryRow({ team }: { team: MockPerson[] }) {
  // Count active people per half-hour slot
  const slotCounts = Array.from({ length: HALF_HOURS }, (_, i) => {
    let count = 0;
    team.forEach((person) => {
      const cell = person.cells[i];
      if (cell && (cell.state === 'active' || cell.state === 'logged')) count++;
    });
    return count;
  });

  const maxCount = Math.max(...slotCounts, 1);

  return (
    <div className="flex items-center gap-0">
      {/* Label */}
      <div className="w-[160px] flex-shrink-0 px-2 text-right">
        <span
          className="font-brand uppercase tracking-wider text-muted-foreground/50"
          style={{ fontSize: scaled(8), fontWeight: 600 }}
        >
          Active
        </span>
      </div>

      {/* Cells */}
      <div
        className="grid flex-1 gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${HALF_HOURS}, 1fr)` }}
      >
        {slotCounts.map((count, i) => {
          const intensity = count / maxCount;
          return (
            <div key={i} className="relative flex flex-col items-center">
              <div
                className="h-5 w-full rounded-[2px] transition-colors"
                style={{
                  backgroundColor:
                    count > 0 ? `hsl(170 80% 45% / ${0.1 + intensity * 0.5})` : 'transparent',
                }}
              />
              {count > 0 && (
                <span
                  className="absolute top-0.5 font-brand font-semibold text-foreground/70"
                  style={{ fontSize: 7 }}
                >
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

const queryClient = new QueryClient();

export function DevPresenceV4Page() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: SORTED_TEAM.length,
      available: 0,
      'working-off-hours': 0,
      idle: 0,
      'off-schedule': 0,
      'on-leave': 0,
    };
    SORTED_TEAM.forEach((p) => {
      c[p.status]++;
    });
    return c;
  }, []);

  const filtered = useMemo(() => {
    let list = SORTED_TEAM;
    if (filter !== 'all') list = list.filter((p) => p.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, search]);

  const summaryParts = [
    counts.available > 0 && `${counts.available} available`,
    counts['working-off-hours'] > 0 && `${counts['working-off-hours']} off-hours`,
    counts.idle > 0 && `${counts.idle} idle`,
    counts['on-leave'] > 0 && `${counts['on-leave']} on leave`,
    counts['off-schedule'] > 0 && `${counts['off-schedule']} off schedule`,
  ].filter(Boolean);

  // Determine which half-hour column is "now"
  const nowSlotIndex = Math.floor((NOW_HOUR - GRID_START) / 0.5);

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <div className="min-h-screen bg-background text-foreground">
          <DevToolbar />
          <div className="mx-auto max-w-[1300px] p-6">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
                Exploration 4 — Heat Map Matrix
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Hour-by-hour grid. Each cell shows whether someone was active, idle, or away. Sorted
                by schedule start time.
              </p>
            </div>

            {/* Top bar */}
            <div className="mb-3 flex items-center justify-between gap-4">
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

            {/* Filters + summary */}
            <div className="mb-4 flex items-center justify-between">
              <FilterBar active={filter} onChange={setFilter} counts={counts} />
              <div className="text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                {summaryParts.join(' · ')}
              </div>
            </div>

            {/* Matrix */}
            <div className="overflow-x-auto rounded-lg border border-border bg-[hsl(var(--t-surface))] p-3">
              {/* Column headers — hour labels */}
              <div className="flex items-end gap-0 mb-1">
                <div className="w-[160px] flex-shrink-0" />
                <div
                  className="grid flex-1 gap-[2px]"
                  style={{ gridTemplateColumns: `repeat(${HALF_HOURS}, 1fr)` }}
                >
                  {Array.from({ length: HALF_HOURS }, (_, i) => {
                    const hour = GRID_START + i * 0.5;
                    const isFullHour = hour % 1 === 0;
                    const isNow = i === nowSlotIndex;
                    return (
                      <div key={i} className="text-center">
                        {isFullHour && (
                          <span
                            className={cn(
                              'font-brand',
                              isNow ? 'font-bold text-destructive' : 'text-muted-foreground/40',
                            )}
                            style={{ fontSize: scaled(7) }}
                          >
                            {hour}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* "Now" column highlight indicator */}
              <div className="flex items-center gap-0 mb-0.5">
                <div className="w-[160px] flex-shrink-0" />
                <div
                  className="grid flex-1 gap-[2px]"
                  style={{ gridTemplateColumns: `repeat(${HALF_HOURS}, 1fr)` }}
                >
                  {Array.from({ length: HALF_HOURS }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-0.5 rounded-full',
                        i === nowSlotIndex ? 'bg-destructive' : 'bg-transparent',
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Person rows */}
              <div className="flex flex-col gap-[3px]">
                <AnimatePresence>
                  {filtered.map((person) => {
                    const meta = STATUS_META[person.status];
                    return (
                      <motion.div
                        key={person.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          'flex items-center gap-0',
                          (person.status === 'off-schedule' || person.status === 'on-leave') &&
                            'opacity-50',
                        )}
                      >
                        {/* Row header */}
                        <div className="w-[160px] flex-shrink-0 flex items-center gap-2 px-2">
                          <div className={cn('h-2 w-2 flex-shrink-0 rounded-full', meta.dot)} />
                          <div className="min-w-0 flex-1">
                            <div
                              className="truncate font-medium text-foreground"
                              style={{ fontSize: scaled(10) }}
                            >
                              {person.name}
                            </div>
                            <div
                              className="truncate text-muted-foreground/60"
                              style={{ fontSize: scaled(8) }}
                            >
                              {person.scheduleStart}:00–
                              {person.scheduleEnd > 23 ? '00' : person.scheduleEnd}:00
                            </div>
                          </div>
                        </div>

                        {/* Cells */}
                        <div
                          className="grid flex-1 gap-[2px]"
                          style={{ gridTemplateColumns: `repeat(${HALF_HOURS}, 1fr)` }}
                        >
                          {person.cells.map((cell, i) => (
                            <HeatCell key={i} cell={cell} />
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Separator */}
              <div className="my-2 border-t border-border/50" />

              {/* Summary row */}
              <SummaryRow team={filtered} />
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
                <span className={cn('inline-block h-3 w-4 rounded-[2px]', CELL_STYLES.active.bg)} />
                Active (running)
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn('inline-block h-3 w-4 rounded-[2px]', CELL_STYLES.logged.bg)} />
                Logged
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn('inline-block h-3 w-4 rounded-[2px]', CELL_STYLES.idle.bg)} />
                Idle
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className={cn(
                    'inline-block h-3 w-4 rounded-[2px]',
                    CELL_STYLES['future-scheduled'].bg,
                  )}
                />
                Upcoming
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn('inline-block h-3 w-4 rounded-[2px]', CELL_STYLES.leave.bg)} />
                On Leave
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
