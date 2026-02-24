import { useState, useEffect, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import {
  Radio, LogOut, LogIn, Clock, Calendar, Users, BarChart3, Send, ChevronLeft, ChevronRight,
  Download, AlertTriangle, Printer, Check, Pencil, Copy, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// Types & Mock Data
// ============================================================

type PresenceStatus = 'available' | 'away' | 'leave' | 'off' | 'focus';
type EmploymentType = 'employee' | 'contractor';

interface MockPerson {
  id: string;
  name: string;
  initials: string;
  role: string;
  employmentType: EmploymentType;
  status: PresenceStatus;
  scheduleStart: number; // hour (e.g. 9)
  scheduleEnd: number;   // hour (e.g. 17)
  awayReason?: string;
  awayBack?: string;
  leaveNote?: string;
  loggedMinutes: number;
  awayMinutes: number;
}

const MOCK_TEAM: MockPerson[] = [
  { id: '1', name: 'Elena Marsh', initials: 'EM', role: 'Admin', employmentType: 'employee', status: 'available', scheduleStart: 9, scheduleEnd: 17, loggedMinutes: 312, awayMinutes: 0 },
  { id: '2', name: 'James Oakley', initials: 'JO', role: 'Developer', employmentType: 'contractor', status: 'available', scheduleStart: 9, scheduleEnd: 17, loggedMinutes: 288, awayMinutes: 40 },
  { id: '3', name: 'Nora Fielding', initials: 'NF', role: 'Designer', employmentType: 'contractor', status: 'available', scheduleStart: 10, scheduleEnd: 18, loggedMinutes: 216, awayMinutes: 0 },
  { id: '4', name: 'Leo Tanner', initials: 'LT', role: 'Developer', employmentType: 'employee', status: 'away', scheduleStart: 9, scheduleEnd: 17, awayReason: 'lunch', awayBack: '~15:00', loggedMinutes: 264, awayMinutes: 45 },
  { id: '5', name: 'Mia Corrigan', initials: 'MC', role: 'QA', employmentType: 'contractor', status: 'away', scheduleStart: 8, scheduleEnd: 16, awayReason: 'errand', awayBack: '~15:30', loggedMinutes: 302, awayMinutes: 70 },
  { id: '6', name: 'Sam Whitford', initials: 'SW', role: 'Developer', employmentType: 'contractor', status: 'leave', scheduleStart: 9, scheduleEnd: 17, leaveNote: 'holiday · back Wed', loggedMinutes: 0, awayMinutes: 0 },
  { id: '7', name: 'Ren Kimura', initials: 'RK', role: 'Developer', employmentType: 'employee', status: 'off', scheduleStart: 16, scheduleEnd: 24, loggedMinutes: 0, awayMinutes: 0 },
  { id: '8', name: 'Alex Morgan', initials: 'AM', role: 'Developer', employmentType: 'contractor', status: 'available', scheduleStart: 8, scheduleEnd: 16, loggedMinutes: 340, awayMinutes: 30 },
];

interface MockEntry {
  id: string;
  description: string;
  project: string;
  client: string;
  color: string;
  startTime: string;
  endTime: string | null;
  minutes: number;
  running?: boolean;
}

const MOCK_ENTRIES: MockEntry[] = [
  { id: 'e1', description: 'PROJ-341 Fix pagination edge case on reports', project: 'Platform Core', client: 'Meridian Labs', color: 'hsl(var(--t-project-1))', startTime: '09:00', endTime: '12:00', minutes: 180 },
  { id: 'e2', description: 'PROJ-342 Code review — auth middleware', project: 'Platform Core', client: 'Meridian Labs', color: 'hsl(var(--t-project-1))', startTime: '13:30', endTime: '14:30', minutes: 60 },
  { id: 'e3', description: 'PROJ-345 Implement presence API routes', project: 'Platform Core', client: 'Meridian Labs', color: 'hsl(var(--t-project-1))', startTime: '14:30', endTime: null, minutes: 2, running: true },
];

interface ScheduleDay {
  name: string;
  short: string;
  start: string;
  end: string;
  isOff: boolean;
}

const MOCK_SCHEDULE: ScheduleDay[] = [
  { name: 'Monday', short: 'Mon', start: '09:00', end: '17:00', isOff: false },
  { name: 'Tuesday', short: 'Tue', start: '09:00', end: '17:00', isOff: false },
  { name: 'Wednesday', short: 'Wed', start: '09:00', end: '15:00', isOff: false },
  { name: 'Thursday', short: 'Thu', start: '10:00', end: '18:00', isOff: false },
  { name: 'Friday', short: 'Fri', start: '09:00', end: '17:00', isOff: false },
  { name: 'Saturday', short: 'Sat', start: '', end: '', isOff: true },
  { name: 'Sunday', short: 'Sun', start: '', end: '', isOff: true },
];

interface BalanceEntry {
  date: string;
  type: 'absence' | 'makeup';
  time: string;
  duration: string;
  minutes: number;
  reason: string;
  runningBalance: string;
}

const MOCK_BALANCE: BalanceEntry[] = [
  { date: 'Mon, 6 Jan', type: 'absence', time: '12:00 – 14:00', duration: '2h 00m', minutes: -120, reason: 'Doctor appointment', runningBalance: '−2h 00m' },
  { date: 'Mon, 6 Jan', type: 'makeup', time: '19:00 – 21:00', duration: '2h 00m', minutes: 120, reason: 'PROJ-310 Bug fix', runningBalance: '0h 00m' },
  { date: 'Thu, 16 Jan', type: 'absence', time: '14:00 – 16:30', duration: '2h 30m', minutes: -150, reason: 'Personal errand', runningBalance: '−2h 30m' },
  { date: 'Thu, 16 Jan', type: 'makeup', time: '20:00 – 21:30', duration: '1h 30m', minutes: 90, reason: 'PROJ-315 Tests', runningBalance: '−1h 00m' },
  { date: 'Wed, 29 Jan', type: 'absence', time: '10:00 – 14:00', duration: '4h 00m', minutes: -240, reason: 'Car service', runningBalance: '−5h 00m' },
  { date: 'Fri, 31 Jan', type: 'makeup', time: '18:00 – 19:45', duration: '1h 45m', minutes: 105, reason: 'PROJ-320 Deployment', runningBalance: '−3h 15m' },
];

// ============================================================
// Helpers
// ============================================================

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min.toString().padStart(2, '0')}m` : `${min}m`;
}

function scheduleHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

const STATUS_COLORS: Record<PresenceStatus, { dot: string; bg: string; text: string; label: string }> = {
  available: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: 'Available' },
  away: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Away' },
  leave: { dot: 'bg-[hsl(var(--chart-2))]', bg: 'bg-[hsl(var(--chart-2)/0.1)]', text: 'text-[hsl(var(--chart-2))]', label: 'On Leave' },
  off: { dot: 'bg-muted-foreground/50', bg: 'bg-muted-foreground/8', text: 'text-muted-foreground', label: 'Off Schedule' },
  focus: { dot: 'bg-[hsl(var(--chart-5))]', bg: 'bg-[hsl(var(--chart-5)/0.1)]', text: 'text-[hsl(var(--chart-5))]', label: 'Focus' },
};

// ============================================================
// Components
// ============================================================

function PresenceBadge({ status }: { status: PresenceStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5', s.bg, s.text)} style={{ fontSize: scaled(10) }}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

function StatCard({ label, value, sub, accent, active, onClick }: {
  label: string; value: string | number; sub: string; accent?: 'primary' | 'warn' | 'danger'; active?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg border border-border bg-[hsl(var(--t-stat-bg))] p-3.5 transition-colors',
        active && 'border-primary/50',
        onClick && 'cursor-pointer hover:border-primary/30',
      )}
    >
      <div className="font-brand uppercase tracking-widest text-muted-foreground" style={{ fontSize: scaled(10) }}>{label}</div>
      <div className={cn(
        'font-brand font-bold',
        accent === 'primary' && 'text-primary',
        accent === 'warn' && 'text-[hsl(var(--chart-3))]',
        accent === 'danger' && 'text-destructive',
        !accent && 'text-foreground',
      )} style={{ fontSize: scaled(22) }}>{value}</div>
      <div className="text-muted-foreground/70" style={{ fontSize: scaled(10) }}>{sub}</div>
    </div>
  );
}

function ScheduleBar({ person, nowHour }: { person: MockPerson; nowHour: number }) {
  const rangeStart = 8;
  const rangeEnd = 20;
  const total = rangeEnd - rangeStart;
  const toPercent = (h: number) => Math.max(0, Math.min(100, ((h - rangeStart) / total) * 100));

  const schedLeft = toPercent(person.scheduleStart);
  const schedWidth = toPercent(person.scheduleEnd) - schedLeft;
  const nowPos = toPercent(nowHour);

  // Fake logged block (proportional to logged minutes within schedule)
  const scheduledMinutes = (person.scheduleEnd - person.scheduleStart) * 60;
  const loggedPct = scheduledMinutes > 0 ? Math.min(1, person.loggedMinutes / scheduledMinutes) : 0;
  const loggedWidth = schedWidth * loggedPct;

  return (
    <div className="relative h-7 rounded bg-muted/50">
      {/* Scheduled block */}
      <div className="absolute top-0 h-full rounded bg-primary/8" style={{ left: `${schedLeft}%`, width: `${schedWidth}%` }} />
      {/* Logged block */}
      <div className="absolute top-1.5 h-4 rounded-sm bg-primary/25" style={{ left: `${schedLeft}%`, width: `${loggedWidth}%` }} />
      {/* Away block (fake) */}
      {person.awayMinutes > 0 && (
        <div
          className="absolute top-0 h-full border-l-2 border-[hsl(var(--chart-3)/0.5)] bg-[hsl(var(--chart-3)/0.15)]"
          style={{
            left: `${schedLeft + loggedWidth - 3}%`,
            width: `${(person.awayMinutes / (total * 60)) * 100}%`,
          }}
        />
      )}
      {/* Now marker */}
      <div className="absolute top-0 bottom-0 z-10 w-0.5 bg-destructive" style={{ left: `${nowPos}%` }} />
      {/* Hour markers */}
      {[8, 10, 12, 14, 16, 18, 20].map((h) => (
        <span key={h} className="absolute text-muted-foreground/40" style={{ left: `${toPercent(h)}%`, bottom: 1, fontSize: 8, transform: 'translateX(-50%)' }}>
          {h}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// Views
// ============================================================

type ViewTab = 'board' | 'myday' | 'schedule' | 'leave' | 'admin' | 'balance' | 'attendance';

function ViewTabs({ active, onChange }: { active: ViewTab; onChange: (v: ViewTab) => void }) {
  const tabs: { id: ViewTab; label: string; icon: React.ElementType }[] = [
    { id: 'board', label: 'Team Board', icon: Radio },
    { id: 'myday', label: 'My Day', icon: Clock },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'leave', label: 'Leave', icon: Send },
    { id: 'admin', label: 'Reconciliation', icon: BarChart3 },
    { id: 'balance', label: 'Q. Balance', icon: Users },
    { id: 'attendance', label: 'Lista', icon: Printer },
  ];
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'mb-[-1px] flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-brand font-medium uppercase tracking-wider transition-colors',
            active === t.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
          style={{ fontSize: scaled(11), letterSpacing: '1px' }}
        >
          <t.icon className="h-3.5 w-3.5" />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---- Team Presence Board ----

function TeamBoard() {
  const [filter, setFilter] = useState<'all' | PresenceStatus>('all');
  const [awayDialogOpen, setAwayDialogOpen] = useState(false);
  const [myStatus, setMyStatus] = useState<PresenceStatus>('available');
  const [awayElapsed, setAwayElapsed] = useState(0);
  const awayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const nowHour = 14.5;

  const filtered = MOCK_TEAM.filter((p) => filter === 'all' || p.status === filter);
  const counts = {
    all: MOCK_TEAM.length,
    available: MOCK_TEAM.filter((p) => p.status === 'available').length,
    away: MOCK_TEAM.filter((p) => p.status === 'away').length,
    leave: MOCK_TEAM.filter((p) => p.status === 'leave').length,
    off: MOCK_TEAM.filter((p) => p.status === 'off').length,
  };

  const handleStepOut = useCallback(() => {
    setMyStatus('away');
    setAwayDialogOpen(false);
    setAwayElapsed(0);
    awayTimerRef.current = setInterval(() => setAwayElapsed((e) => e + 1), 1000);
  }, []);

  const handleBack = useCallback(() => {
    setMyStatus('available');
    if (awayTimerRef.current) clearInterval(awayTimerRef.current);
    awayTimerRef.current = null;
    setAwayElapsed(0);
  }, []);

  useEffect(() => {
    return () => { if (awayTimerRef.current) clearInterval(awayTimerRef.current); };
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="font-brand text-foreground" style={{ fontSize: scaled(18), fontWeight: 600, letterSpacing: '1px' }}>Presence</h2>
          <p className="text-muted-foreground" style={{ fontSize: scaled(12) }}>Monday, 17 Feb · 14:32</p>
        </div>
        <AnimatePresence mode="wait">
          {myStatus === 'available' ? (
            <motion.button
              key="out"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => setAwayDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--chart-3)/0.3)] bg-[hsl(var(--chart-3)/0.1)] px-3 py-1.5 font-medium text-[hsl(var(--chart-3))] transition-colors hover:bg-[hsl(var(--chart-3)/0.15)]"
              style={{ fontSize: scaled(12) }}
            >
              <LogOut className="h-3.5 w-3.5" /> I'm stepping out
            </motion.button>
          ) : (
            <motion.div
              key="back"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-3"
            >
              <div className="text-right">
                <div className="font-brand font-bold text-[hsl(var(--chart-3))]" style={{ fontSize: scaled(16) }}>
                  {Math.floor(awayElapsed / 60)}:{String(awayElapsed % 60).padStart(2, '0')}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>away</div>
              </div>
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-500 transition-colors hover:bg-emerald-500/15"
                style={{ fontSize: scaled(12) }}
              >
                <LogIn className="h-3.5 w-3.5" /> I'm back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats */}
      <div className="mb-4 flex gap-3">
        <StatCard label="Available" value={counts.available} sub="working right now" accent="primary" active={filter === 'available'} onClick={() => setFilter(filter === 'available' ? 'all' : 'available')} />
        <StatCard label="Away" value={counts.away} sub="temporarily out" accent="warn" active={filter === 'away'} onClick={() => setFilter(filter === 'away' ? 'all' : 'away')} />
        <StatCard label="On Leave" value={counts.leave} sub="approved leave" active={filter === 'leave'} onClick={() => setFilter(filter === 'leave' ? 'all' : 'leave')} />
        <StatCard label="Off Schedule" value={counts.off} sub="outside work hours" active={filter === 'off'} onClick={() => setFilter(filter === 'off' ? 'all' : 'off')} />
      </div>

      {/* Team grid header */}
      <div className="mb-1 grid grid-cols-[200px_100px_1fr_80px] gap-3 px-3.5 font-brand uppercase tracking-wider text-muted-foreground/60" style={{ fontSize: scaled(10), fontWeight: 600 }}>
        <span>Person</span><span>Status</span><span>Today's Schedule</span><span className="text-right">Logged</span>
      </div>

      {/* Team rows */}
      <div className="flex flex-col gap-1">
        <AnimatePresence>
          {filtered.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'grid grid-cols-[200px_100px_1fr_80px] items-center gap-3 rounded-lg border border-border bg-[hsl(var(--t-surface))] px-3.5 py-2.5 transition-colors hover:border-primary/20',
                (p.status === 'off' || p.status === 'leave') && 'opacity-50',
              )}
            >
              {/* Person */}
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]" style={{ fontSize: 11 }}>
                    {p.initials}
                  </div>
                  <div className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--t-surface))]', STATUS_COLORS[p.status].dot)} />
                </div>
                <div>
                  <div className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>{p.name}</div>
                  <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>{p.role}</div>
                </div>
              </div>
              {/* Status */}
              <div>
                <PresenceBadge status={p.status} />
                {p.awayReason && (
                  <div className="mt-0.5 italic text-muted-foreground" style={{ fontSize: scaled(10) }}>
                    {p.awayReason} · back {p.awayBack}
                  </div>
                )}
                {p.leaveNote && (
                  <div className="mt-0.5 italic text-muted-foreground" style={{ fontSize: scaled(10) }}>{p.leaveNote}</div>
                )}
                {p.status === 'off' && (
                  <div className="mt-0.5 italic text-muted-foreground" style={{ fontSize: scaled(10) }}>starts at {p.scheduleStart}:00</div>
                )}
              </div>
              {/* Schedule bar */}
              <div>
                {p.status === 'leave' ? (
                  <div className="flex h-7 items-center justify-center rounded bg-muted/50 font-brand uppercase tracking-widest text-[hsl(var(--chart-2))]/70" style={{ fontSize: scaled(10) }}>
                    On Leave
                  </div>
                ) : (
                  <ScheduleBar person={p} nowHour={nowHour} />
                )}
              </div>
              {/* Logged */}
              <div className="text-right">
                <div className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(13) }}>
                  {p.status === 'leave' ? '—' : fmtMin(p.loggedMinutes)}
                </div>
                {p.status !== 'leave' && p.status !== 'off' && (
                  <div className="text-muted-foreground" style={{ fontSize: scaled(9) }}>of {(p.scheduleEnd - p.scheduleStart)}h</div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Away dialog */}
      <AnimatePresence>
        {awayDialogOpen && <AwayDialog onClose={() => setAwayDialogOpen(false)} onConfirm={handleStepOut} />}
      </AnimatePresence>
    </div>
  );
}

function AwayDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [duration, setDuration] = useState<string>('30 min');
  const [reason, setReason] = useState('');
  const durations = ['15 min', '30 min', '1 hour', '2 hours', 'Not sure'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-[360px] rounded-xl border border-border bg-[hsl(var(--t-surface))] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3.5 flex items-center gap-2 font-brand font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          <LogOut className="h-4 w-4 text-[hsl(var(--chart-3))]" /> Stepping out
        </h3>

        <div className="mb-1.5 font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(10) }}>How long?</div>
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {durations.map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={cn(
                'rounded-lg border px-3 py-1.5 transition-colors',
                duration === d
                  ? 'border-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3)/0.1)] text-[hsl(var(--chart-3))]'
                  : 'border-border bg-muted text-foreground hover:border-[hsl(var(--chart-3)/0.3)]',
              )}
              style={{ fontSize: scaled(11) }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="mb-1.5 font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(10) }}>Reason (optional)</div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., lunch, errands, appointment..."
          className="mb-3.5 w-full rounded-lg border border-border bg-muted px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          style={{ fontSize: scaled(12) }}
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary/50" style={{ fontSize: scaled(12) }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--chart-3)/0.3)] bg-[hsl(var(--chart-3)/0.1)] px-3 py-1.5 font-medium text-[hsl(var(--chart-3))] transition-colors hover:bg-[hsl(var(--chart-3)/0.15)]"
            style={{ fontSize: scaled(12) }}
          >
            <LogOut className="h-3.5 w-3.5" /> Step out
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- My Day ----

function MyDayView() {
  return (
    <div className="grid grid-cols-[1fr_300px] gap-5">
      <div>
        {/* Status bar */}
        <div className="mb-4 flex items-center gap-3">
          <PresenceBadge status="available" />
          <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>since 09:00</span>
        </div>

        {/* Timeline */}
        <div className="mb-1 font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(10), fontWeight: 600 }}>Today's Timeline</div>
        <div className="relative mb-4 h-14 overflow-hidden rounded-lg border border-border bg-muted/30">
          {/* Scheduled 9-17 = 8.3% to 75% */}
          <div className="absolute top-0 h-full border-l-2 border-r-2 border-primary/15 bg-primary/6" style={{ left: '8.3%', width: '66.7%' }} />
          {/* Away 12-13:30 */}
          <div className="absolute top-0 h-full bg-[hsl(var(--chart-3)/0.12)]" style={{ left: '33.3%', width: '12.5%', backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 3px, hsl(var(--chart-3) / 0.06) 3px, hsl(var(--chart-3) / 0.06) 6px)' }} />
          {/* Entry blocks */}
          <div className="absolute top-2.5 h-4 rounded-sm bg-primary/30" style={{ left: '8.3%', width: '25%' }} title="09:00-12:00" />
          <div className="absolute top-2.5 h-4 rounded-sm bg-primary/30" style={{ left: '45.8%', width: '8.3%' }} title="13:30-14:30" />
          <motion.div className="absolute top-2.5 h-4 rounded-sm bg-primary/50" style={{ left: '54.2%', width: '1.5%' }} animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 2, repeat: Infinity }} title="14:30-now" />
          {/* Now */}
          <div className="absolute top-0 bottom-0 z-10 w-0.5 bg-destructive" style={{ left: '55%' }}>
            <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
          </div>
          {/* Hours */}
          {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => (
            <span key={h} className="absolute bottom-0.5 text-muted-foreground/40" style={{ left: `${((h - 8) / 12) * 100}%`, fontSize: 8, transform: 'translateX(-50%)' }}>{h}</span>
          ))}
        </div>

        {/* Legend */}
        <div className="mb-5 flex gap-4" style={{ fontSize: scaled(10) }}>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="inline-block h-1 w-3 rounded-sm border border-primary/15 bg-primary/6" /> Scheduled</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="inline-block h-1 w-3 rounded-sm bg-primary/30" /> Logged</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="inline-block h-1 w-3 rounded-sm bg-[hsl(var(--chart-3)/0.12)]" /> Away</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="inline-block h-2.5 w-0.5 rounded-sm bg-destructive" /> Now</span>
        </div>

        {/* Entries */}
        <div className="mb-1.5 font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(10), fontWeight: 600 }}>Today's Entries</div>
        <div className="flex flex-col gap-1">
          {MOCK_ENTRIES.map((e) => (
            <div
              key={e.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2',
                e.running ? 'border-primary/20 bg-primary/5' : 'border-border bg-[hsl(var(--t-surface))]',
              )}
            >
              <span className={cn('w-1 self-stretch rounded-full', e.running && 'animate-pulse')} style={{ background: e.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-foreground" style={{ fontSize: scaled(12) }}>{e.description}</div>
                <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>{e.client} · {e.project}</div>
              </div>
              <div className={cn('text-right', e.running ? 'text-primary' : 'text-muted-foreground')} style={{ fontSize: scaled(10) }}>
                {e.startTime} – {e.endTime ?? 'now'}
              </div>
              <div className={cn('font-brand font-semibold', e.running ? 'text-primary' : 'text-foreground')} style={{ fontSize: scaled(13) }}>
                {e.minutes >= 60 ? `${Math.floor(e.minutes / 60)}:${String(e.minutes % 60).padStart(2, '0')}` : `0:${String(e.minutes).padStart(2, '0')}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Reconciliation */}
      <div className="flex flex-col gap-3">
        <ReconCard />
        <WeekCard />
      </div>
    </div>
  );
}

function ReconCard() {
  return (
    <div className="rounded-lg border border-border bg-[hsl(var(--t-surface))] p-4">
      <h3 className="mb-3 font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(11), fontWeight: 600 }}>Today's Balance</h3>
      {[
        { label: 'Scheduled', value: '8h 00m' },
        { label: 'Away time', value: '−1h 30m', color: 'text-[hsl(var(--chart-3))]' },
      ].map((r) => (
        <div key={r.label} className="flex justify-between py-1" style={{ fontSize: scaled(12) }}>
          <span className="text-muted-foreground">{r.label}</span>
          <span className={cn('font-brand font-semibold', r.color || 'text-foreground')}>{r.value}</span>
        </div>
      ))}
      <div className="my-1 border-t border-border" />
      <div className="flex justify-between py-1" style={{ fontSize: scaled(12) }}>
        <span className="text-muted-foreground">Net expected</span>
        <span className="font-brand font-semibold text-foreground">6h 30m</span>
      </div>
      <div className="flex justify-between py-1" style={{ fontSize: scaled(12) }}>
        <span className="text-muted-foreground">Time logged</span>
        <span className="font-brand font-semibold text-foreground">4h 02m</span>
      </div>
      <div className="my-1 border-t border-border" />
      <div className="flex justify-between pt-2" style={{ fontSize: scaled(12) }}>
        <span className="font-semibold text-foreground">Remaining</span>
        <span className="font-brand font-bold text-[hsl(var(--chart-3))]" style={{ fontSize: scaled(16) }}>2h 28m</span>
      </div>
      <div className="mt-2 text-center text-muted-foreground" style={{ fontSize: scaled(10) }}>Schedule ends at 17:00 · 2h 28m left</div>
    </div>
  );
}

function WeekCard() {
  const days = [
    { label: 'Mon', value: '4h 02m', note: 'in progress' },
    { label: 'Tue', value: '—', dimmed: true },
    { label: 'Wed', value: '—', dimmed: true },
    { label: 'Thu', value: '—', dimmed: true },
    { label: 'Fri', value: '—', dimmed: true },
  ];
  return (
    <div className="rounded-lg border border-border bg-[hsl(var(--t-surface))] p-4">
      <h3 className="mb-3 font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(11), fontWeight: 600 }}>This Week</h3>
      {days.map((d) => (
        <div key={d.label} className={cn('flex justify-between py-1', d.dimmed && 'opacity-40')} style={{ fontSize: scaled(12) }}>
          <span className="text-muted-foreground">{d.label}</span>
          <span className="font-brand font-semibold text-foreground">
            {d.value}
            {d.note && <span className="ml-1 font-normal text-[hsl(var(--chart-3))]" style={{ fontSize: scaled(10) }}>{d.note}</span>}
          </span>
        </div>
      ))}
      <div className="my-1 border-t border-border" />
      <div className="flex justify-between py-1" style={{ fontSize: scaled(12) }}>
        <span className="text-muted-foreground">Week total</span>
        <span className="font-brand font-semibold text-foreground">4h 02m <span className="font-normal text-muted-foreground" style={{ fontSize: scaled(10) }}>/ 40h</span></span>
      </div>
    </div>
  );
}

// ---- Schedule Setup ----

function ScheduleView() {
  const [schedule, setSchedule] = useState(MOCK_SCHEDULE);
  const [editing, setEditing] = useState(false);

  const weeklyTotal = schedule.reduce((sum, d) => sum + scheduleHours(d.start, d.end), 0);
  const workingDays = schedule.filter((d) => !d.isOff).length;

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(16) }}>My Schedule</h2>
          <p className="text-muted-foreground" style={{ fontSize: scaled(11) }}>Effective since 3 Feb 2026</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary/50" style={{ fontSize: scaled(12) }}>
            <Copy className="h-3.5 w-3.5" /> Use template
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors',
              editing
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary text-primary-foreground hover:opacity-90',
            )}
            style={{ fontSize: scaled(12) }}
          >
            {editing ? <><Check className="h-3.5 w-3.5" /> Save</> : <><Pencil className="h-3.5 w-3.5" /> Request change</>}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {schedule.map((day, i) => (
          <div
            key={day.name}
            className={cn(
              'grid items-center gap-2.5 rounded-lg border border-border bg-[hsl(var(--t-surface))] px-3 py-2',
              day.isOff ? 'grid-cols-[80px_1fr] opacity-40' : 'grid-cols-[80px_120px_20px_120px_1fr]',
            )}
          >
            <span className={cn('font-brand font-medium', day.isOff ? 'text-muted-foreground' : 'text-foreground')} style={{ fontSize: scaled(12) }}>
              {day.name}
            </span>
            {day.isOff ? (
              <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>Day off</span>
            ) : (
              <>
                <input
                  value={day.start}
                  onChange={(e) => {
                    const next = [...schedule];
                    next[i] = { ...day, start: e.target.value };
                    setSchedule(next);
                  }}
                  disabled={!editing}
                  className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-center font-brand font-semibold text-foreground disabled:opacity-70"
                  style={{ fontSize: scaled(13) }}
                />
                <span className="text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>–</span>
                <input
                  value={day.end}
                  onChange={(e) => {
                    const next = [...schedule];
                    next[i] = { ...day, end: e.target.value };
                    setSchedule(next);
                  }}
                  disabled={!editing}
                  className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-center font-brand font-semibold text-foreground disabled:opacity-70"
                  style={{ fontSize: scaled(13) }}
                />
                <div className="text-right font-brand font-medium text-muted-foreground" style={{ fontSize: scaled(12) }}>
                  <span className="font-semibold text-foreground">{scheduleHours(day.start, day.end)}h</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Weekly total */}
      <div className="mt-3 flex items-center gap-4 rounded-lg border border-border bg-[hsl(var(--t-stat-bg))] px-3 py-2.5">
        <span className="font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(10) }}>Weekly Total</span>
        <span className="font-brand font-bold text-primary" style={{ fontSize: scaled(18) }}>{weeklyTotal}h</span>
        <span className="text-muted-foreground" style={{ fontSize: scaled(10) }}>{workingDays} working days</span>
      </div>
    </div>
  );
}

// ---- Leave Request ----

function LeaveView() {
  const [leaveType, setLeaveType] = useState('Holiday');
  const types = ['Holiday', 'Sick leave', 'Personal', 'Other'];

  return (
    <div className="max-w-[500px] rounded-lg border border-border bg-[hsl(var(--t-surface))] p-5">
      <h2 className="mb-4 font-brand font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Request Time Off</h2>

      <div className="mb-3.5">
        <label className="mb-1 block font-medium text-foreground" style={{ fontSize: scaled(11) }}>Type</label>
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setLeaveType(t)}
              className={cn(
                'rounded-lg border px-3 py-1.5 transition-colors',
                leaveType === t
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted text-foreground hover:border-primary/30',
              )}
              style={{ fontSize: scaled(11) }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3.5 flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block font-medium text-foreground" style={{ fontSize: scaled(11) }}>From</label>
          <input value="Wed, 19 Feb 2026" readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-foreground" style={{ fontSize: scaled(12) }} />
        </div>
        <div className="flex-1">
          <label className="mb-1 block font-medium text-foreground" style={{ fontSize: scaled(11) }}>To</label>
          <input value="Fri, 21 Feb 2026" readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-foreground" style={{ fontSize: scaled(12) }} />
        </div>
      </div>
      <div className="mb-3.5 text-muted-foreground" style={{ fontSize: scaled(10) }}>3 working days</div>

      <div className="mb-3.5">
        <label className="mb-1 block font-medium text-foreground" style={{ fontSize: scaled(11) }}>Note (optional)</label>
        <input placeholder="Reason for leave..." className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-foreground placeholder:text-muted-foreground" style={{ fontSize: scaled(12) }} />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-[hsl(var(--chart-3)/0.2)] bg-[hsl(var(--chart-3)/0.08)] px-3 py-2 text-[hsl(var(--chart-3))]" style={{ fontSize: scaled(11) }}>
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        James Oakley is also off on 19–20 Feb
      </div>

      <div className="flex justify-end gap-2">
        <button className="rounded-lg border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary/50" style={{ fontSize: scaled(12) }}>Cancel</button>
        <button className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90" style={{ fontSize: scaled(12) }}>
          <Send className="h-3.5 w-3.5" /> Submit request
        </button>
      </div>
    </div>
  );
}

// ---- Admin Reconciliation ----

function AdminReconView() {
  const team = [
    { name: 'Elena Marsh', initials: 'EM', scheduled: '40h', away: '1h 30m', logged: '38h 12m', pct: 99, gap: '+18m', gapClass: 'text-emerald-500' },
    { name: 'James Oakley', initials: 'JO', scheduled: '40h', away: '3h 20m', logged: '36h 05m', pct: 98, gap: '−35m', gapClass: 'text-destructive' },
    { name: 'Nora Fielding', initials: 'NF', scheduled: '40h', away: '2h', logged: '37h 48m', pct: 99, gap: '−12m', gapClass: 'text-destructive' },
    { name: 'Leo Tanner', initials: 'LT', scheduled: '40h', away: '5h 45m', logged: '32h 10m', pct: 94, gap: '−2h 05m', gapClass: 'text-destructive' },
    { name: 'Mia Corrigan', initials: 'MC', scheduled: '40h', away: '1h', logged: '38h 55m', pct: 100, gap: '−5m', gapClass: 'text-muted-foreground' },
    { name: 'Ren Kimura', initials: 'RK', scheduled: '40h', away: '4h 30m', logged: '34h 50m', pct: 98, gap: '−40m', gapClass: 'text-destructive' },
  ];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18) }}>Team Reconciliation</h2>
          <p className="text-muted-foreground" style={{ fontSize: scaled(12) }}>Schedule vs actual — Week of 10–14 Feb 2026</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-border p-1.5 text-foreground hover:border-primary/50"><ChevronLeft className="h-4 w-4" /></button>
          <button className="rounded-lg border border-border px-3 py-1.5 text-foreground hover:border-primary/50" style={{ fontSize: scaled(12) }}>This week</button>
          <button className="rounded-lg border border-border p-1.5 text-foreground hover:border-primary/50"><ChevronRight className="h-4 w-4" /></button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-foreground hover:border-primary/50" style={{ fontSize: scaled(12) }}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-3">
        <StatCard label="Team Scheduled" value="320h" sub="8 people × 40h" />
        <StatCard label="Total Logged" value="298h" sub="93% of scheduled" accent="primary" />
        <StatCard label="Total Away" value="18h" sub="across all members" accent="warn" />
        <StatCard label="Avg Utilization" value="93%" sub="logged / (scheduled − away)" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-[hsl(var(--t-surface))]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Person', 'Scheduled', 'Away', 'Logged', 'Utilization', 'Gap'].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    'border-b border-border bg-muted/30 px-3 py-2.5 text-left font-brand uppercase tracking-wider text-muted-foreground',
                    (i === 1 || i === 2 || i === 3 || i === 5) && 'text-right',
                    i === 4 && 'w-[140px]',
                  )}
                  style={{ fontSize: scaled(10), fontWeight: 600 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((p) => (
              <tr key={p.name} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]" style={{ fontSize: 10 }}>{p.initials}</div>
                    <span className="text-foreground" style={{ fontSize: scaled(12) }}>{p.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-brand font-semibold text-foreground" style={{ fontSize: scaled(13) }}>{p.scheduled}</td>
                <td className="px-3 py-2.5 text-right font-brand font-semibold text-foreground" style={{ fontSize: scaled(13) }}>{p.away}</td>
                <td className="px-3 py-2.5 text-right font-brand font-semibold text-foreground" style={{ fontSize: scaled(13) }}>{p.logged}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={cn('h-full rounded-full', p.pct >= 98 ? 'bg-primary' : p.pct >= 95 ? 'bg-[hsl(var(--chart-3))]' : 'bg-destructive')}
                        initial={{ width: 0 }}
                        animate={{ width: `${p.pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <span className={cn('min-w-[36px] text-right font-brand font-semibold', p.pct >= 98 ? 'text-emerald-500' : p.pct >= 95 ? 'text-[hsl(var(--chart-3))]' : 'text-destructive')} style={{ fontSize: scaled(10) }}>
                      {p.pct}%
                    </span>
                  </div>
                </td>
                <td className={cn('px-3 py-2.5 text-right font-brand font-semibold', p.gapClass)} style={{ fontSize: scaled(13) }}>{p.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Quarterly Balance ----

function BalanceView() {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(16) }}>Quarterly Balance — Leo Tanner</h2>
          <p className="text-muted-foreground" style={{ fontSize: scaled(11) }}>Q1 2026 (Jan – Mar) · Employee</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-foreground hover:border-primary/50" style={{ fontSize: scaled(12) }}>
          <Download className="h-3.5 w-3.5" /> Export PDF
        </button>
      </div>

      <div className="mb-4 flex gap-3">
        <div className="flex-1 rounded-lg border border-border bg-[hsl(var(--t-surface))] p-4 text-center">
          <div className="font-brand font-bold text-[hsl(var(--chart-3))]" style={{ fontSize: scaled(28) }}>12h 30m</div>
          <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>Total absences</div>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-[hsl(var(--t-surface))] p-4 text-center">
          <div className="font-brand font-bold text-emerald-500" style={{ fontSize: scaled(28) }}>9h 15m</div>
          <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>Made up</div>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-[hsl(var(--t-surface))] p-4 text-center">
          <div className="font-brand font-bold text-destructive" style={{ fontSize: scaled(28) }}>−3h 15m</div>
          <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>Outstanding</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-[hsl(var(--t-surface))]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Date', 'Type', 'Time', 'Duration', 'Reason', 'Balance'].map((h, i) => (
                <th key={h} className={cn('border-b border-border bg-muted/30 px-2.5 py-2 text-left font-brand uppercase tracking-wider text-muted-foreground', i === 5 && 'text-right')} style={{ fontSize: scaled(10), fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_BALANCE.map((b, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="px-2.5 py-2 text-foreground" style={{ fontSize: scaled(11) }}>{b.date}</td>
                <td className={cn('px-2.5 py-2 font-medium', b.type === 'absence' ? 'text-[hsl(var(--chart-3))]' : 'text-emerald-500')} style={{ fontSize: scaled(11) }}>
                  {b.type === 'absence' ? 'Absence' : 'Make-up'}
                </td>
                <td className="px-2.5 py-2 text-foreground" style={{ fontSize: scaled(11) }}>{b.time}</td>
                <td className={cn('px-2.5 py-2', b.type === 'absence' ? 'text-[hsl(var(--chart-3))]' : 'text-emerald-500')} style={{ fontSize: scaled(11) }}>
                  {b.type === 'absence' ? '−' : '+'}{b.duration}
                </td>
                <td className="px-2.5 py-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>{b.reason}</td>
                <td className={cn('px-2.5 py-2 text-right font-brand font-semibold', b.runningBalance.startsWith('−') ? 'text-[hsl(var(--chart-3))]' : 'text-muted-foreground')} style={{ fontSize: scaled(11) }}>{b.runningBalance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-destructive/15 bg-destructive/5 px-3 py-2.5 text-destructive" style={{ fontSize: scaled(11) }}>
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <strong>3h 15m outstanding</strong> — 6 weeks remaining in Q1. Employee should schedule make-up time.
      </div>
    </div>
  );
}

// ---- Attendance Record (Lista Obecności) ----

function AttendanceView() {
  const rows = [
    { date: 'Mon, 3 Feb', schedule: '09:00 – 17:00', start: '08:55', end: '17:12', breaks: '45m', worked: '7h 32m', status: 'confirmed' as const },
    { date: 'Tue, 4 Feb', schedule: '09:00 – 17:00', start: '09:02', end: '17:45', breaks: '1h 15m', worked: '7h 28m', status: 'confirmed' as const },
    { date: 'Wed, 5 Feb', schedule: '09:00 – 17:00', start: '09:10', end: '18:30', breaks: '30m', worked: '8h 50m', status: 'confirmed' as const },
    { date: 'Thu, 6 Feb', schedule: '09:00 – 17:00', start: '08:50', end: '16:30', breaks: '2h 10m', worked: '5h 30m', status: 'short' as const },
    { date: 'Fri, 7 Feb', schedule: '09:00 – 17:00', start: '09:00', end: '19:15', breaks: '45m', worked: '9h 30m', status: 'confirmed' as const },
  ];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(16) }}>Attendance Record — James Oakley</h2>
          <p className="text-muted-foreground" style={{ fontSize: scaled(11) }}>February 2026 · Employee (umowa o pracę)</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-border p-1.5 text-foreground hover:border-primary/50"><ChevronLeft className="h-4 w-4" /></button>
          <button className="rounded-lg border border-border p-1.5 text-foreground hover:border-primary/50"><ChevronRight className="h-4 w-4" /></button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-foreground hover:border-primary/50" style={{ fontSize: scaled(12) }}>
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90" style={{ fontSize: scaled(12) }}>
            <Check className="h-3.5 w-3.5" /> Confirm month
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-[hsl(var(--t-surface))]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Date', 'Schedule', 'Actual Start', 'Actual End', 'Breaks', 'Worked', 'Status'].map((h, i) => (
                <th key={h} className={cn('border-b border-border bg-muted/30 px-2.5 py-2 text-left font-brand uppercase tracking-wider text-muted-foreground', i === 5 && 'text-right')} style={{ fontSize: scaled(10), fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-b border-border/30">
                <td className="px-2.5 py-2 text-foreground" style={{ fontSize: scaled(11) }}>{r.date}</td>
                <td className="px-2.5 py-2 text-foreground" style={{ fontSize: scaled(11) }}>{r.schedule}</td>
                <td className="px-2.5 py-2 text-foreground" style={{ fontSize: scaled(11) }}>{r.start}</td>
                <td className="px-2.5 py-2 text-foreground" style={{ fontSize: scaled(11) }}>{r.end}</td>
                <td className="px-2.5 py-2 text-foreground" style={{ fontSize: scaled(11) }}>{r.breaks}</td>
                <td className={cn('px-2.5 py-2 text-right font-brand font-semibold', r.status === 'short' ? 'text-[hsl(var(--chart-3))]' : 'text-foreground')} style={{ fontSize: scaled(13) }}>{r.worked}</td>
                <td className="px-2.5 py-2" style={{ fontSize: scaled(10) }}>
                  {r.status === 'confirmed' ? (
                    <span className="text-emerald-500">✓ Confirmed</span>
                  ) : (
                    <span className="text-[hsl(var(--chart-3))]">⚠ Short</span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30">
              <td colSpan={5} className="px-2.5 py-2 text-right font-semibold text-foreground" style={{ fontSize: scaled(11) }}>Week 6 Total</td>
              <td className="px-2.5 py-2 text-right font-brand font-bold text-primary" style={{ fontSize: scaled(14) }}>38h 50m</td>
              <td className="px-2.5 py-2 text-muted-foreground" style={{ fontSize: scaled(10) }}>of 40h</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-4">
        <div className="flex-1 rounded-lg border border-border bg-[hsl(var(--t-surface))] p-3 text-center">
          <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>Month Total</div>
          <div className="font-brand font-bold text-primary" style={{ fontSize: scaled(22) }}>112h 30m</div>
          <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>of 160h scheduled (14 working days)</div>
        </div>
        <div className="rounded-lg border border-border bg-[hsl(var(--t-surface))] p-3 text-center" style={{ minWidth: 180 }}>
          <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>Status</div>
          <div className="mt-1 font-semibold text-[hsl(var(--chart-3))]" style={{ fontSize: scaled(14) }}>Pending</div>
          <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>10 confirmed, 4 unconfirmed</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

const queryClient = new QueryClient();

export function DevPresencePage() {
  const [activeView, setActiveView] = useState<ViewTab>('board');

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        
          <div className="min-h-screen bg-background text-foreground">
            <DevToolbar />
            <div className="mx-auto max-w-[1100px] p-6">
              <div className="mb-6">
                <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">Presence & Availability — Interactive Prototype</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  All views for the presence system. Team board with real-time status, personal reconciliation, schedule management, leave requests, admin reports.
                </p>
              </div>

              <ViewTabs active={activeView} onChange={setActiveView} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeView === 'board' && <TeamBoard />}
                  {activeView === 'myday' && <MyDayView />}
                  {activeView === 'schedule' && <ScheduleView />}
                  {activeView === 'leave' && <LeaveView />}
                  {activeView === 'admin' && <AdminReconView />}
                  {activeView === 'balance' && <BalanceView />}
                  {activeView === 'attendance' && <AttendanceView />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
