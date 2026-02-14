import { GlobalRole } from '@ternity/shared';
import type {
  AuthContext,
  ProjectOption,
  LabelOption,
  UserOption,
  Entry,
  TimerState,
  DayGroup,
  Stats,
} from '@ternity/shared';
import type { AdminUser } from '@/hooks/use-admin-users';

/* ── Auth ──────────────────────────────────────────────────────────────── */

export const MOCK_USER: AuthContext = {
  userId: 'dev-user-001',
  displayName: 'Alex Morgan',
  email: 'alex.morgan@netbulls.com',
  phone: '+44 7700 900000',
  avatarUrl: null,
  globalRole: GlobalRole.Admin,
  orgRoles: {},
};

/* ── Reference Data ────────────────────────────────────────────────────── */

export const MOCK_PROJECTS: ProjectOption[] = [
  { id: 'p1', name: 'API Platform', color: '#00D4AA', clientName: 'Netbulls' },
  { id: 'p2', name: 'Mobile App', color: '#6366f1', clientName: 'Netbulls' },
  { id: 'p3', name: 'Brand Refresh', color: '#f59e0b', clientName: 'Acme Corp' },
  { id: 'p4', name: 'Data Pipeline', color: '#ef4444', clientName: 'Acme Corp' },
];

export const MOCK_LABELS: LabelOption[] = [
  { id: 'l1', name: 'Development', color: '#22c55e' },
  { id: 'l2', name: 'Design', color: '#a855f7' },
  { id: 'l3', name: 'Bug Fix', color: '#ef4444' },
  { id: 'l4', name: 'Meeting', color: '#3b82f6' },
];

export const MOCK_USERS: UserOption[] = [
  { id: 'dev-user-001', displayName: 'Alex Morgan', email: 'alex.morgan@netbulls.com', avatarUrl: null, globalRole: 'admin', active: true },
  { id: 'dev-user-002', displayName: 'Jamie Chen', email: 'jamie.chen@netbulls.com', avatarUrl: null, globalRole: 'user', active: true },
  { id: 'dev-user-003', displayName: 'Sam Wilson', email: 'sam.wilson@netbulls.com', avatarUrl: null, globalRole: 'user', active: true },
];

/* ── Time Entries ──────────────────────────────────────────────────────── */

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function todayAt(hour: number, min = 0): string {
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

/** Running entry — startedAt set to ~1h ago */
const RUNNING_ENTRY: Entry = {
  id: 'e-running',
  description: 'Implementing component catalog',
  projectId: 'p1',
  projectName: 'API Platform',
  projectColor: '#00D4AA',
  clientName: 'Netbulls',
  labels: [{ id: 'l1', name: 'Development', color: '#22c55e' }],
  startedAt: hoursAgo(1),
  stoppedAt: null,
  durationSeconds: null,
  userId: 'dev-user-001',
};

const COMPLETED_ENTRIES: Entry[] = [
  {
    id: 'e1',
    description: 'Sprint planning meeting',
    projectId: 'p2',
    projectName: 'Mobile App',
    projectColor: '#6366f1',
    clientName: 'Netbulls',
    labels: [{ id: 'l4', name: 'Meeting', color: '#3b82f6' }],
    startedAt: todayAt(9, 0),
    stoppedAt: todayAt(10, 30),
    durationSeconds: 5400,
    userId: 'dev-user-001',
  },
  {
    id: 'e2',
    description: 'Fix auth token refresh bug',
    projectId: 'p1',
    projectName: 'API Platform',
    projectColor: '#00D4AA',
    clientName: 'Netbulls',
    labels: [
      { id: 'l1', name: 'Development', color: '#22c55e' },
      { id: 'l3', name: 'Bug Fix', color: '#ef4444' },
    ],
    startedAt: todayAt(10, 45),
    stoppedAt: todayAt(12, 15),
    durationSeconds: 5400,
    userId: 'dev-user-001',
  },
  {
    id: 'e3',
    description: 'Design review for new dashboard',
    projectId: 'p3',
    projectName: 'Brand Refresh',
    projectColor: '#f59e0b',
    clientName: 'Acme Corp',
    labels: [{ id: 'l2', name: 'Design', color: '#a855f7' }],
    startedAt: todayAt(13, 0),
    stoppedAt: todayAt(14, 0),
    durationSeconds: 3600,
    userId: 'dev-user-001',
  },
  {
    id: 'e4',
    description: '',
    projectId: null,
    projectName: null,
    projectColor: null,
    clientName: null,
    labels: [],
    startedAt: todayAt(14, 30),
    stoppedAt: todayAt(15, 0),
    durationSeconds: 1800,
    userId: 'dev-user-001',
  },
];

export const MOCK_ENTRIES: Entry[] = [RUNNING_ENTRY, ...COMPLETED_ENTRIES];

export const MOCK_DAY_GROUPS: DayGroup[] = [
  {
    date: today,
    totalSeconds: 16200 + 3600, // completed entries
    entries: MOCK_ENTRIES,
  },
  {
    date: yesterday,
    totalSeconds: 28800,
    entries: [
      {
        id: 'e-y1',
        description: 'Data pipeline optimization',
        projectId: 'p4',
        projectName: 'Data Pipeline',
        projectColor: '#ef4444',
        clientName: 'Acme Corp',
        labels: [{ id: 'l1', name: 'Development', color: '#22c55e' }],
        startedAt: new Date(Date.now() - 86400_000 + 9 * 3600_000).toISOString(),
        stoppedAt: new Date(Date.now() - 86400_000 + 17 * 3600_000).toISOString(),
        durationSeconds: 28800,
        userId: 'dev-user-001',
      },
    ],
  },
];

/* ── Timer ─────────────────────────────────────────────────────────────── */

export const MOCK_TIMER_RUNNING: TimerState = {
  running: true,
  entry: RUNNING_ENTRY,
};

export const MOCK_TIMER_STOPPED: TimerState = {
  running: false,
  entry: null,
};

/* ── Stats ─────────────────────────────────────────────────────────────── */

export const MOCK_STATS: Stats = {
  todaySeconds: 14400, // 4h
  weekSeconds: 86400, // 24h
};

/* ── Admin Users ───────────────────────────────────────────────────────── */

export const MOCK_ADMIN_USERS: AdminUser[] = [
  { id: 'u1', displayName: 'Alex Morgan', email: 'alex.morgan@netbulls.com', avatarUrl: null, globalRole: 'admin', active: true, entryCount: 3542, lastEntryAt: hoursAgo(1) },
  { id: 'u2', displayName: 'Jamie Chen', email: 'jamie.chen@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 2891, lastEntryAt: hoursAgo(3) },
  { id: 'u3', displayName: 'Sam Wilson', email: 'sam.wilson@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 1456, lastEntryAt: hoursAgo(24) },
  { id: 'u4', displayName: 'Taylor Reed', email: 'taylor.reed@netbulls.com', avatarUrl: null, globalRole: 'user', active: false, entryCount: 892, lastEntryAt: '2025-11-15T10:00:00.000Z' },
  { id: 'u5', displayName: 'Jordan Blake', email: 'jordan.blake@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 4210, lastEntryAt: hoursAgo(6) },
  { id: 'u6', displayName: 'Robin Patel', email: 'robin.patel@netbulls.com', avatarUrl: null, globalRole: 'admin', active: false, entryCount: 0, lastEntryAt: null },
  { id: 'u7', displayName: 'Chris Evans', email: 'chris.evans@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 1823, lastEntryAt: hoursAgo(2) },
  { id: 'u8', displayName: 'Dana Park', email: 'dana.park@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 967, lastEntryAt: hoursAgo(48) },
  { id: 'u9', displayName: 'Morgan Lee', email: 'morgan.lee@netbulls.com', avatarUrl: null, globalRole: 'user', active: false, entryCount: 412, lastEntryAt: '2025-09-20T14:30:00.000Z' },
  { id: 'u10', displayName: 'Avery Kim', email: 'avery.kim@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 5102, lastEntryAt: hoursAgo(1) },
  { id: 'u11', displayName: 'Riley Foster', email: 'riley.foster@netbulls.com', avatarUrl: null, globalRole: 'admin', active: true, entryCount: 2340, lastEntryAt: hoursAgo(5) },
  { id: 'u12', displayName: 'Quinn Murphy', email: 'quinn.murphy@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 756, lastEntryAt: hoursAgo(72) },
  { id: 'u13', displayName: 'Skyler Torres', email: 'skyler.torres@netbulls.com', avatarUrl: null, globalRole: 'user', active: false, entryCount: 189, lastEntryAt: '2025-06-01T09:00:00.000Z' },
  { id: 'u14', displayName: 'Hayden Brooks', email: 'hayden.brooks@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 3015, lastEntryAt: hoursAgo(8) },
  { id: 'u15', displayName: 'Emery Walsh', email: 'emery.walsh@netbulls.com', avatarUrl: null, globalRole: 'user', active: true, entryCount: 621, lastEntryAt: hoursAgo(36) },
];
