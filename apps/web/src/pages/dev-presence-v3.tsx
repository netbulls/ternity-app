import { useState, useMemo, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Search, Moon, Palmtree, Play, Square, AlertTriangle, Calendar, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// Types
// ============================================================

type PresenceStatus = 'available' | 'working-off-hours' | 'idle' | 'off-schedule' | 'on-leave';

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
  loggedMinutes: number;
  stateDurationMin: number; // how long in current state
}

interface FeedEvent {
  id: string;
  personId: string;
  personName: string;
  personInitials: string;
  type:
    | 'timer-start'
    | 'timer-stop'
    | 'idle-notice'
    | 'schedule-start'
    | 'schedule-end'
    | 'leave-notice';
  description: string;
  project?: string;
  loggedDuration?: string;
  timestamp: string; // HH:MM
  minutesAgo: number;
  statusAccent: PresenceStatus;
}

// ============================================================
// Mock Data — 14 Team Members
// ============================================================

const NOW_HOUR = 14.5;

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
    currentTask: 'PROJ-345 Implement presence API',
    loggedMinutes: 312,
    stateDurationMin: 60,
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
    currentTask: 'AUTH-129 Token rotation',
    loggedMinutes: 288,
    stateDurationMin: 90,
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
    currentTask: 'DS-45 Date picker variants',
    loggedMinutes: 216,
    stateDurationMin: 90,
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
    stateDurationMin: 60,
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
    loggedMinutes: 342,
    stateDurationMin: 120,
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
    stateDurationMin: 0,
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
    stateDurationMin: 0,
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
    loggedMinutes: 340,
    stateDurationMin: 90,
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
    currentTask: 'Backlog grooming',
    loggedMinutes: 270,
    stateDurationMin: 90,
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
    stateDurationMin: 150,
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
    currentTask: 'MOB-23 Onboarding redesign',
    loggedMinutes: 195,
    stateDurationMin: 150,
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
    currentTask: 'DATA-15 ETL optimization',
    loggedMinutes: 120,
    stateDurationMin: 120,
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
    stateDurationMin: 0,
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
    stateDurationMin: 0,
  },
];

// ============================================================
// Feed Events — Simulating a realistic day up to 14:30
// ============================================================

const FEED_EVENTS: FeedEvent[] = [
  {
    id: 'f1',
    personId: '5',
    personName: 'Mia Corrigan',
    personInitials: 'MC',
    type: 'schedule-start',
    description: 'started her schedule',
    timestamp: '08:00',
    minutesAgo: 390,
    statusAccent: 'available',
  },
  {
    id: 'f2',
    personId: '5',
    personName: 'Mia Corrigan',
    personInitials: 'MC',
    type: 'timer-start',
    description: 'started tracking on QA Automation — Regression suite run',
    project: 'QA Automation',
    timestamp: '08:02',
    minutesAgo: 388,
    statusAccent: 'available',
  },
  {
    id: 'f3',
    personId: '8',
    personName: 'Alex Morgan',
    personInitials: 'AM',
    type: 'schedule-start',
    description: 'started his schedule',
    timestamp: '08:00',
    minutesAgo: 390,
    statusAccent: 'available',
  },
  {
    id: 'f4',
    personId: '8',
    personName: 'Alex Morgan',
    personInitials: 'AM',
    type: 'timer-start',
    description: 'started tracking on DevOps — Monitoring alerts config',
    project: 'DevOps',
    timestamp: '08:05',
    minutesAgo: 385,
    statusAccent: 'available',
  },
  {
    id: 'f5',
    personId: '1',
    personName: 'Elena Marsh',
    personInitials: 'EM',
    type: 'schedule-start',
    description: 'started her schedule',
    timestamp: '09:00',
    minutesAgo: 330,
    statusAccent: 'available',
  },
  {
    id: 'f6',
    personId: '1',
    personName: 'Elena Marsh',
    personInitials: 'EM',
    type: 'timer-start',
    description: 'started tracking on Platform Core — Fix pagination edge case',
    project: 'Platform Core',
    timestamp: '09:00',
    minutesAgo: 330,
    statusAccent: 'available',
  },
  {
    id: 'f7',
    personId: '2',
    personName: 'James Oakley',
    personInitials: 'JO',
    type: 'timer-start',
    description: 'started tracking on API Gateway — Rate limiter refactor',
    project: 'API Gateway',
    timestamp: '09:00',
    minutesAgo: 330,
    statusAccent: 'available',
  },
  {
    id: 'f8',
    personId: '4',
    personName: 'Leo Tanner',
    personInitials: 'LT',
    type: 'timer-start',
    description: 'started tracking on Platform Core — DB migration script',
    project: 'Platform Core',
    timestamp: '09:00',
    minutesAgo: 330,
    statusAccent: 'available',
  },
  {
    id: 'f9',
    personId: '9',
    personName: 'Priya Desai',
    personInitials: 'PD',
    type: 'timer-start',
    description: 'started tracking on Platform Core — Sprint planning meeting',
    project: 'Platform Core',
    timestamp: '09:05',
    minutesAgo: 325,
    statusAccent: 'available',
  },
  {
    id: 'f10',
    personId: '10',
    personName: 'Tom Galloway',
    personInitials: 'TG',
    type: 'timer-start',
    description: 'started tracking on Mobile App — Push notification fix',
    project: 'Mobile App',
    timestamp: '09:10',
    minutesAgo: 320,
    statusAccent: 'available',
  },
  {
    id: 'f11',
    personId: '3',
    personName: 'Nora Fielding',
    personInitials: 'NF',
    type: 'schedule-start',
    description: 'started her schedule',
    timestamp: '10:00',
    minutesAgo: 270,
    statusAccent: 'available',
  },
  {
    id: 'f12',
    personId: '3',
    personName: 'Nora Fielding',
    personInitials: 'NF',
    type: 'timer-start',
    description: 'started tracking on Design System — Button states audit',
    project: 'Design System',
    timestamp: '10:00',
    minutesAgo: 270,
    statusAccent: 'available',
  },
  {
    id: 'f13',
    personId: '11',
    personName: 'Chloe Bennett',
    personInitials: 'CB',
    type: 'timer-start',
    description: 'started tracking on Design System — Icon library update',
    project: 'Design System',
    timestamp: '10:00',
    minutesAgo: 270,
    statusAccent: 'available',
  },
  {
    id: 'f14',
    personId: '8',
    personName: 'Alex Morgan',
    personInitials: 'AM',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '2h 00m',
    project: 'DevOps',
    timestamp: '10:00',
    minutesAgo: 270,
    statusAccent: 'idle',
  },
  {
    id: 'f15',
    personId: '8',
    personName: 'Alex Morgan',
    personInitials: 'AM',
    type: 'timer-start',
    description: 'started tracking on DevOps — K8s cluster upgrade',
    project: 'DevOps',
    timestamp: '10:30',
    minutesAgo: 240,
    statusAccent: 'available',
  },
  {
    id: 'f16',
    personId: '5',
    personName: 'Mia Corrigan',
    personInitials: 'MC',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '2h 30m',
    project: 'QA Automation',
    timestamp: '10:30',
    minutesAgo: 240,
    statusAccent: 'idle',
  },
  {
    id: 'f17',
    personId: '5',
    personName: 'Mia Corrigan',
    personInitials: 'MC',
    type: 'timer-start',
    description: 'started tracking on Platform Core — Bug repro for PROJ-341',
    project: 'Platform Core',
    timestamp: '10:30',
    minutesAgo: 240,
    statusAccent: 'available',
  },
  {
    id: 'f18',
    personId: '4',
    personName: 'Leo Tanner',
    personInitials: 'LT',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '2h 00m',
    project: 'Platform Core',
    timestamp: '11:00',
    minutesAgo: 210,
    statusAccent: 'idle',
  },
  {
    id: 'f19',
    personId: '2',
    personName: 'James Oakley',
    personInitials: 'JO',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '2h 30m',
    project: 'API Gateway',
    timestamp: '11:30',
    minutesAgo: 180,
    statusAccent: 'idle',
  },
  {
    id: 'f20',
    personId: '2',
    personName: 'James Oakley',
    personInitials: 'JO',
    type: 'timer-start',
    description: 'started tracking on Platform Core — PR review for Elena',
    project: 'Platform Core',
    timestamp: '11:30',
    minutesAgo: 180,
    statusAccent: 'available',
  },
  {
    id: 'f21',
    personId: '4',
    personName: 'Leo Tanner',
    personInitials: 'LT',
    type: 'timer-start',
    description: 'started tracking on Platform Core — Cache invalidation',
    project: 'Platform Core',
    timestamp: '11:30',
    minutesAgo: 180,
    statusAccent: 'available',
  },
  {
    id: 'f22',
    personId: '11',
    personName: 'Chloe Bennett',
    personInitials: 'CB',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '1h 30m',
    project: 'Design System',
    timestamp: '11:30',
    minutesAgo: 180,
    statusAccent: 'idle',
  },
  {
    id: 'f23',
    personId: '1',
    personName: 'Elena Marsh',
    personInitials: 'EM',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '3h 00m',
    project: 'Platform Core',
    timestamp: '12:00',
    minutesAgo: 150,
    statusAccent: 'idle',
  },
  {
    id: 'f24',
    personId: '5',
    personName: 'Mia Corrigan',
    personInitials: 'MC',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '1h 30m',
    project: 'Platform Core',
    timestamp: '12:00',
    minutesAgo: 150,
    statusAccent: 'idle',
  },
  {
    id: 'f25',
    personId: '10',
    personName: 'Tom Galloway',
    personInitials: 'TG',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '3h 00m',
    project: 'Mobile App',
    timestamp: '12:00',
    minutesAgo: 150,
    statusAccent: 'idle',
  },
  {
    id: 'f26',
    personId: '12',
    personName: 'Daniel Yeo',
    personInitials: 'DY',
    type: 'timer-start',
    description: 'started tracking on Data Pipeline — ETL optimization',
    project: 'Data Pipeline',
    timestamp: '12:30',
    minutesAgo: 120,
    statusAccent: 'working-off-hours',
  },
  {
    id: 'f27',
    personId: '11',
    personName: 'Chloe Bennett',
    personInitials: 'CB',
    type: 'timer-start',
    description: 'started tracking on Mobile App — Onboarding redesign',
    project: 'Mobile App',
    timestamp: '12:00',
    minutesAgo: 150,
    statusAccent: 'available',
  },
  {
    id: 'f28',
    personId: '1',
    personName: 'Elena Marsh',
    personInitials: 'EM',
    type: 'timer-start',
    description: 'started tracking on Platform Core — Code review auth middleware',
    project: 'Platform Core',
    timestamp: '12:30',
    minutesAgo: 120,
    statusAccent: 'available',
  },
  {
    id: 'f29',
    personId: '5',
    personName: 'Mia Corrigan',
    personInitials: 'MC',
    type: 'timer-start',
    description: 'started tracking on QA Automation — E2E presence tests',
    project: 'QA Automation',
    timestamp: '12:30',
    minutesAgo: 120,
    statusAccent: 'available',
  },
  {
    id: 'f30',
    personId: '8',
    personName: 'Alex Morgan',
    personInitials: 'AM',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '2h 00m',
    project: 'DevOps',
    timestamp: '12:30',
    minutesAgo: 120,
    statusAccent: 'idle',
  },
  {
    id: 'f31',
    personId: '2',
    personName: 'James Oakley',
    personInitials: 'JO',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '0h 30m',
    project: 'Platform Core',
    timestamp: '12:00',
    minutesAgo: 150,
    statusAccent: 'idle',
  },
  {
    id: 'f32',
    personId: '2',
    personName: 'James Oakley',
    personInitials: 'JO',
    type: 'timer-start',
    description: 'started tracking on API Gateway — Token rotation',
    project: 'API Gateway',
    timestamp: '13:00',
    minutesAgo: 90,
    statusAccent: 'available',
  },
  {
    id: 'f33',
    personId: '8',
    personName: 'Alex Morgan',
    personInitials: 'AM',
    type: 'timer-start',
    description: 'started tracking on DevOps — K8s cluster upgrade cont.',
    project: 'DevOps',
    timestamp: '13:00',
    minutesAgo: 90,
    statusAccent: 'available',
  },
  {
    id: 'f34',
    personId: '9',
    personName: 'Priya Desai',
    personInitials: 'PD',
    type: 'timer-start',
    description: 'started tracking on Platform Core — Backlog grooming',
    project: 'Platform Core',
    timestamp: '13:00',
    minutesAgo: 90,
    statusAccent: 'available',
  },
  {
    id: 'f35',
    personId: '3',
    personName: 'Nora Fielding',
    personInitials: 'NF',
    type: 'timer-start',
    description: 'started tracking on Design System — Date picker variants',
    project: 'Design System',
    timestamp: '13:00',
    minutesAgo: 90,
    statusAccent: 'available',
  },
  {
    id: 'f36',
    personId: '4',
    personName: 'Leo Tanner',
    personInitials: 'LT',
    type: 'timer-stop',
    description: 'stopped timer',
    loggedDuration: '2h 00m',
    project: 'Platform Core',
    timestamp: '13:30',
    minutesAgo: 60,
    statusAccent: 'idle',
  },
  {
    id: 'f37',
    personId: '10',
    personName: 'Tom Galloway',
    personInitials: 'TG',
    type: 'idle-notice',
    description: 'timer has been idle for 2h 30m',
    timestamp: '14:30',
    minutesAgo: 0,
    statusAccent: 'idle',
  },
  {
    id: 'f38',
    personId: '4',
    personName: 'Leo Tanner',
    personInitials: 'LT',
    type: 'idle-notice',
    description: 'timer has been idle for 1h',
    timestamp: '14:30',
    minutesAgo: 0,
    statusAccent: 'idle',
  },
  {
    id: 'f39',
    personId: '1',
    personName: 'Elena Marsh',
    personInitials: 'EM',
    type: 'timer-start',
    description: 'started tracking on Platform Core — Implement presence API',
    project: 'Platform Core',
    timestamp: '13:30',
    minutesAgo: 60,
    statusAccent: 'available',
  },
  {
    id: 'f40',
    personId: '6',
    personName: 'Sam Whitford',
    personInitials: 'SW',
    type: 'leave-notice',
    description: 'is on leave today (holiday)',
    timestamp: '09:00',
    minutesAgo: 330,
    statusAccent: 'on-leave',
  },
  {
    id: 'f41',
    personId: '14',
    personName: 'Kai Lund',
    personInitials: 'KL',
    type: 'leave-notice',
    description: 'is on leave today (personal day)',
    timestamp: '09:00',
    minutesAgo: 330,
    statusAccent: 'on-leave',
  },
  {
    id: 'f42',
    personId: '13',
    personName: 'Isla Novak',
    personInitials: 'IN',
    type: 'schedule-end',
    description: 'finished her schedule — 7h logged',
    timestamp: '15:00',
    minutesAgo: -30,
    statusAccent: 'off-schedule',
  },
];

// Sort feed events reverse-chronological (most recent first)
const SORTED_FEED = [...FEED_EVENTS]
  .filter((e) => e.minutesAgo >= 0) // only past events
  .sort((a, b) => a.minutesAgo - b.minutesAgo);

// ============================================================
// Helpers
// ============================================================

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min.toString().padStart(2, '0')}m` : `${min}m`;
}

const STATUS_META: Record<
  PresenceStatus,
  { dot: string; bg: string; text: string; label: string; sortOrder: number; rowBg: string }
> = {
  available: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    label: 'Available',
    sortOrder: 0,
    rowBg: 'bg-emerald-500/[0.03]',
  },
  'working-off-hours': {
    dot: 'bg-teal-400/60',
    bg: 'bg-teal-400/8',
    text: 'text-teal-400/70',
    label: 'Working (off-hours)',
    sortOrder: 1,
    rowBg: 'bg-teal-400/[0.02]',
  },
  idle: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    label: 'Idle',
    sortOrder: 2,
    rowBg: 'bg-amber-500/[0.03]',
  },
  'off-schedule': {
    dot: 'bg-muted-foreground/40',
    bg: 'bg-muted-foreground/6',
    text: 'text-muted-foreground/60',
    label: 'Off Schedule',
    sortOrder: 3,
    rowBg: 'bg-muted-foreground/[0.02]',
  },
  'on-leave': {
    dot: 'bg-indigo-400',
    bg: 'bg-indigo-400/10',
    text: 'text-indigo-400',
    label: 'On Leave',
    sortOrder: 4,
    rowBg: 'bg-indigo-400/[0.03]',
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

function PersonRow({
  person,
  isSelected,
  onClick,
}: {
  person: MockPerson;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[person.status];

  const activityText = (() => {
    if (person.status === 'available' || person.status === 'working-off-hours')
      return person.currentTask ?? person.currentProject ?? 'Working';
    if (person.status === 'idle') return 'Idle — no timer running';
    if (person.status === 'off-schedule') return `Starts at ${person.scheduleStart}:00`;
    if (person.status === 'on-leave') return 'On leave today';
    return '';
  })();

  const durationText = (() => {
    if (person.status === 'on-leave') return 'all day';
    if (person.status === 'off-schedule' && person.stateDurationMin === 0) {
      if (person.loggedMinutes > 0) return `${fmtMin(person.loggedMinutes)} logged`;
      return `in ${person.scheduleStart - Math.floor(NOW_HOUR)}h`;
    }
    if (person.stateDurationMin > 0) return fmtMin(person.stateDurationMin);
    return '';
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors cursor-pointer',
        meta.rowBg,
        isSelected && 'ring-1 ring-primary/30',
        'hover:bg-primary/[0.04]',
        (person.status === 'off-schedule' || person.status === 'on-leave') && 'opacity-60',
      )}
    >
      {/* Status dot */}
      <div className={cn('h-2 w-2 flex-shrink-0 rounded-full', meta.dot)} />

      {/* Name + activity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground" style={{ fontSize: scaled(11) }}>
            {person.name}
          </span>
          {person.status === 'available' && (
            <span className="flex-shrink-0 text-emerald-500" style={{ fontSize: scaled(8) }}>
              <Timer className="inline h-2.5 w-2.5" />
            </span>
          )}
        </div>
        <div className={cn('truncate', meta.text)} style={{ fontSize: scaled(9) }}>
          {activityText}
        </div>
      </div>

      {/* Duration */}
      <div
        className="flex-shrink-0 text-right text-muted-foreground"
        style={{ fontSize: scaled(9) }}
      >
        {durationText}
      </div>
    </motion.div>
  );
}

function FeedItem({ event, isHighlighted }: { event: FeedEvent; isHighlighted: boolean }) {
  const meta = STATUS_META[event.statusAccent];

  const icon = (() => {
    switch (event.type) {
      case 'timer-start':
        return <Play className="h-3 w-3" />;
      case 'timer-stop':
        return <Square className="h-3 w-3" />;
      case 'idle-notice':
        return <AlertTriangle className="h-3 w-3" />;
      case 'schedule-start':
        return <Calendar className="h-3 w-3" />;
      case 'schedule-end':
        return <Moon className="h-3 w-3" />;
      case 'leave-notice':
        return <Palmtree className="h-3 w-3" />;
    }
  })();

  const descriptionText = (() => {
    switch (event.type) {
      case 'timer-start':
        return (
          <>
            <strong className="text-foreground">{event.personName}</strong> started tracking on{' '}
            <span className="text-primary">{event.project}</span>
          </>
        );
      case 'timer-stop':
        return (
          <>
            <strong className="text-foreground">{event.personName}</strong> stopped timer ·{' '}
            <span className="font-semibold">{event.loggedDuration}</span> logged
          </>
        );
      case 'idle-notice':
        return (
          <>
            <strong className="text-foreground">{event.personName}</strong>'s {event.description}
          </>
        );
      case 'schedule-start':
        return (
          <>
            <strong className="text-foreground">{event.personName}</strong> {event.description}
          </>
        );
      case 'schedule-end':
        return (
          <>
            <strong className="text-foreground">{event.personName}</strong> {event.description}
          </>
        );
      case 'leave-notice':
        return (
          <>
            <strong className="text-foreground">{event.personName}</strong> {event.description}
          </>
        );
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: isHighlighted ? 1 : 0.7, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-start gap-2.5 rounded-md px-3 py-2 transition-all',
        isHighlighted && 'bg-primary/[0.04] ring-1 ring-primary/20',
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]"
          style={{ fontSize: 8 }}
        >
          {event.personInitials}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
          {descriptionText}
        </div>
        {event.type === 'timer-start' && event.description.includes('—') && (
          <div className="mt-0.5 truncate text-muted-foreground/60" style={{ fontSize: scaled(9) }}>
            {event.description.split('—')[1]?.trim()}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
        <span className="text-muted-foreground/50" style={{ fontSize: scaled(8) }}>
          {event.timestamp}
        </span>
        <span className={cn(meta.text)} style={{ fontSize: scaled(8) }}>
          {icon}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================
// Simulated live feed
// ============================================================

function useLiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(SORTED_FEED);
  const counterRef = useRef(100);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate a new event every 8 seconds
      const templates = [
        {
          personId: '1',
          personName: 'Elena Marsh',
          personInitials: 'EM',
          type: 'timer-start' as const,
          description: 'switched task on Platform Core',
          project: 'Platform Core',
          statusAccent: 'available' as const,
        },
        {
          personId: '8',
          personName: 'Alex Morgan',
          personInitials: 'AM',
          type: 'timer-stop' as const,
          description: 'stopped timer',
          loggedDuration: '1h 30m',
          project: 'DevOps',
          statusAccent: 'idle' as const,
        },
        {
          personId: '9',
          personName: 'Priya Desai',
          personInitials: 'PD',
          type: 'timer-start' as const,
          description: 'started tracking on Client Portal — Demo prep',
          project: 'Client Portal',
          statusAccent: 'available' as const,
        },
      ];
      const tmpl = templates[counterRef.current % templates.length]!;
      counterRef.current++;

      const newEvent: FeedEvent = {
        personId: tmpl.personId,
        personName: tmpl.personName,
        personInitials: tmpl.personInitials,
        type: tmpl.type,
        description: tmpl.description,
        statusAccent: tmpl.statusAccent,
        ...(tmpl.project ? { project: tmpl.project } : {}),
        ...('loggedDuration' in tmpl && tmpl.loggedDuration
          ? { loggedDuration: tmpl.loggedDuration }
          : {}),
        id: `live-${counterRef.current}`,
        timestamp: '14:30',
        minutesAgo: 0,
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, 40));
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return events;
}

// ============================================================
// Main Page
// ============================================================

const queryClient = new QueryClient();

export function DevPresenceV3Page() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const feedEvents = useLiveFeed();

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

  // Filter feed events by selected person
  const displayedEvents = selectedPersonId
    ? feedEvents.filter((e) => e.personId === selectedPersonId)
    : feedEvents;

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <div className="min-h-screen bg-background text-foreground">
          <DevToolbar />
          <div className="mx-auto max-w-[1200px] p-6">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
                Exploration 3 — Live Feed
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Split view: compact presence list on the left, live activity feed on the right.
                Click a person to filter their events.
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

            {/* Split layout */}
            <div className="flex gap-4">
              {/* Left panel — Compact presence list */}
              <div className="w-[55%] flex-shrink-0">
                <div className="mb-2 flex items-center justify-between px-2.5">
                  <span
                    className="font-brand uppercase tracking-wider text-muted-foreground/50"
                    style={{ fontSize: scaled(9), fontWeight: 600 }}
                  >
                    Team ({filtered.length})
                  </span>
                  {selectedPersonId && (
                    <button
                      onClick={() => setSelectedPersonId(null)}
                      className="text-primary/70 hover:text-primary transition-colors"
                      style={{ fontSize: scaled(9) }}
                    >
                      Clear selection
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-[hsl(var(--t-surface))] p-1.5">
                  <AnimatePresence>
                    {filtered.map((person) => (
                      <PersonRow
                        key={person.id}
                        person={person}
                        isSelected={selectedPersonId === person.id}
                        onClick={() =>
                          setSelectedPersonId(selectedPersonId === person.id ? null : person.id)
                        }
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right panel — Live activity feed */}
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-between px-3">
                  <span
                    className="font-brand uppercase tracking-wider text-muted-foreground/50"
                    style={{ fontSize: scaled(9), fontWeight: 600 }}
                  >
                    Activity Feed
                    {selectedPersonId && (
                      <span className="ml-1.5 normal-case tracking-normal text-primary/60">
                        — {MOCK_TEAM.find((p) => p.id === selectedPersonId)?.name}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground/40" style={{ fontSize: scaled(8) }}>
                    {displayedEvents.length} events
                  </span>
                </div>
                <div
                  className="rounded-lg border border-border bg-[hsl(var(--t-surface))] p-1.5"
                  style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}
                >
                  <AnimatePresence initial={false}>
                    {displayedEvents.map((event) => (
                      <FeedItem
                        key={event.id}
                        event={event}
                        isHighlighted={!selectedPersonId || event.personId === selectedPersonId}
                      />
                    ))}
                  </AnimatePresence>
                  {displayedEvents.length === 0 && (
                    <div
                      className="flex items-center justify-center py-12 text-muted-foreground/40"
                      style={{ fontSize: scaled(11) }}
                    >
                      No activity for this person today
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
