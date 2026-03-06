import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Palmtree, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// V2 — Horizontal Bar Wallchart (Gantt-style)
// Each person gets a row with a continuous bar spanning their leave dates.
// More visual than the grid — shows leave duration at a glance.
// Full page simulation with My Leave list and booking dialog hint.
// ============================================================

const queryClient = new QueryClient();

// ── Types ───────────────────────────────────────────────────────

interface LeaveType {
  id: string;
  name: string;
  color: string;
}

interface LeaveBooking {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  hours: number | null;
  note: string | null;
  status: 'autoconfirmed' | 'approved' | 'cancelled';
}

interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
  avatarColor: string;
}

// ── Mock Data ───────────────────────────────────────────────────

const LEAVE_TYPES: LeaveType[] = [
  { id: 'lt1', name: 'Holiday', color: '#00D4AA' },
  { id: 'lt2', name: 'Sick Leave', color: '#F97316' },
  { id: 'lt3', name: 'Personal', color: '#8B5CF6' },
  { id: 'lt4', name: 'Parental', color: '#EC4899' },
  { id: 'lt5', name: 'Unpaid', color: '#6B7280' },
];

const PEOPLE: Person[] = [
  { id: 'u1', name: 'Przemyslaw Rudzki', initials: 'PR', role: 'Admin', avatarColor: '#00D4AA' },
  { id: 'u2', name: 'Bartosz Nowak', initials: 'BN', role: 'Developer', avatarColor: '#3B82F6' },
  { id: 'u3', name: 'Elena Kowalska', initials: 'EK', role: 'Designer', avatarColor: '#8B5CF6' },
  { id: 'u4', name: 'Marek Wisniewski', initials: 'MW', role: 'Developer', avatarColor: '#F97316' },
  { id: 'u5', name: 'Anna Zielinska', initials: 'AZ', role: 'QA', avatarColor: '#EC4899' },
  { id: 'u6', name: 'Tomasz Kaminski', initials: 'TK', role: 'Developer', avatarColor: '#F59E0B' },
  { id: 'u7', name: 'Kasia Dabrowska', initials: 'KD', role: 'Developer', avatarColor: '#14B8A6' },
  { id: 'u8', name: 'Piotr Lewandowski', initials: 'PL', role: 'DevOps', avatarColor: '#6366F1' },
  { id: 'u9', name: 'Marta Wojcik', initials: 'MWo', role: 'QA', avatarColor: '#10B981' },
  { id: 'u10', name: 'Jakub Szymanski', initials: 'JS', role: 'Developer', avatarColor: '#EF4444' },
];

const POLISH_HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-01-06': 'Epiphany',
  '2026-04-05': 'Easter Sunday',
  '2026-04-06': 'Easter Monday',
  '2026-05-01': 'Labour Day',
  '2026-05-03': 'Constitution Day',
  '2026-06-04': 'Corpus Christi',
  '2026-08-15': 'Assumption',
  '2026-11-01': "All Saints' Day",
  '2026-11-11': 'Independence Day',
  '2026-12-25': 'Christmas Day',
  '2026-12-26': "St. Stephen's Day",
};

const BOOKINGS: LeaveBooking[] = [
  {
    id: 'b1',
    userId: 'u1',
    leaveTypeId: 'lt1',
    startDate: '2026-03-09',
    endDate: '2026-03-13',
    daysCount: 5,
    hours: null,
    note: 'Spring vacation',
    status: 'autoconfirmed',
  },
  {
    id: 'b2',
    userId: 'u2',
    leaveTypeId: 'lt2',
    startDate: '2026-03-04',
    endDate: '2026-03-05',
    daysCount: 2,
    hours: null,
    note: 'Flu',
    status: 'autoconfirmed',
  },
  {
    id: 'b3',
    userId: 'u3',
    leaveTypeId: 'lt1',
    startDate: '2026-03-16',
    endDate: '2026-03-20',
    daysCount: 5,
    hours: null,
    note: null,
    status: 'autoconfirmed',
  },
  {
    id: 'b4',
    userId: 'u4',
    leaveTypeId: 'lt3',
    startDate: '2026-03-11',
    endDate: '2026-03-11',
    daysCount: 0.25,
    hours: 2,
    note: 'Doctor appointment',
    status: 'autoconfirmed',
  },
  {
    id: 'b5',
    userId: 'u5',
    leaveTypeId: 'lt1',
    startDate: '2026-03-23',
    endDate: '2026-03-27',
    daysCount: 5,
    hours: null,
    note: 'Family trip',
    status: 'autoconfirmed',
  },
  {
    id: 'b6',
    userId: 'u6',
    leaveTypeId: 'lt3',
    startDate: '2026-03-18',
    endDate: '2026-03-18',
    daysCount: 0.5,
    hours: 4,
    note: 'Moving day',
    status: 'autoconfirmed',
  },
  {
    id: 'b7',
    userId: 'u7',
    leaveTypeId: 'lt1',
    startDate: '2026-03-02',
    endDate: '2026-03-06',
    daysCount: 5,
    hours: null,
    note: 'Skiing trip',
    status: 'autoconfirmed',
  },
  {
    id: 'b8',
    userId: 'u8',
    leaveTypeId: 'lt2',
    startDate: '2026-03-25',
    endDate: '2026-03-26',
    daysCount: 2,
    hours: null,
    note: null,
    status: 'autoconfirmed',
  },
  {
    id: 'b9',
    userId: 'u9',
    leaveTypeId: 'lt4',
    startDate: '2026-03-02',
    endDate: '2026-03-31',
    daysCount: 22,
    hours: null,
    note: 'Maternity leave',
    status: 'autoconfirmed',
  },
  {
    id: 'b10',
    userId: 'u10',
    leaveTypeId: 'lt1',
    startDate: '2026-03-30',
    endDate: '2026-04-03',
    daysCount: 5,
    hours: null,
    note: 'Easter break',
    status: 'autoconfirmed',
  },
  {
    id: 'b11',
    userId: 'u1',
    leaveTypeId: 'lt3',
    startDate: '2026-03-25',
    endDate: '2026-03-25',
    daysCount: 0.375,
    hours: 3,
    note: 'Dentist',
    status: 'autoconfirmed',
  },
];

// ── Helpers ──────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(dateStr: string): boolean {
  return dateStr in POLISH_HOLIDAYS_2026;
}

function getLeaveType(id: string): LeaveType | undefined {
  return LEAVE_TYPES.find((lt) => lt.id === id);
}

function getBookingsForUser(userId: string): LeaveBooking[] {
  return BOOKINGS.filter((b) => b.userId === userId && b.status !== 'cancelled');
}

// ── Components ──────────────────────────────────────────────────

function Avatar({ person, size = 28 }: { person: Person; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-brand font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: person.avatarColor + '20',
        color: person.avatarColor,
        fontSize: scaled(size * 0.38),
      }}
    >
      {person.initials}
    </div>
  );
}

function MonthNavigator({
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const label = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPrev}
        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onToday}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-foreground hover:bg-accent"
        style={{ fontSize: scaled(12) }}
      >
        <Palmtree className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-brand font-semibold tracking-wide">{label}</span>
      </button>
      <button
        onClick={onNext}
        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function GanttWallchart({ year, month, search }: { year: number; month: number; search: string }) {
  const daysInMonth = getDaysInMonth(year, month);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month, daysInMonth);
  const monthStartStr = formatDate(monthStart);
  const monthEndStr = formatDate(monthEnd);

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return {
      date: d,
      dateStr: formatDate(d),
      dayNum: i + 1,
      isWeekend: isWeekend(d),
      isHoliday: isHoliday(formatDate(d)),
      isToday: formatDate(d) === formatDate(new Date()),
    };
  });

  // Group days by week
  const weeks: number[][] = [];
  let currentWeek: number[] = [];
  days.forEach((day) => {
    if (day.date.getDay() === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day.dayNum);
  });
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const filtered = PEOPLE.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
  });

  // Calculate bar position for a booking
  const getBarStyle = (booking: LeaveBooking) => {
    const startDay = Math.max(
      1,
      Math.round(
        (new Date(booking.startDate).getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1,
    );
    const endDay = Math.min(
      daysInMonth,
      Math.round(
        (new Date(booking.endDate).getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1,
    );
    const left = ((startDay - 1) / daysInMonth) * 100;
    const width = ((endDay - startDay + 1) / daysInMonth) * 100;
    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div style={{ minWidth: 900 }}>
        {/* Day numbers header */}
        <div className="flex border-b border-border bg-muted/20">
          <div className="shrink-0 border-r border-border" style={{ width: 180 }} />
          <div className="relative flex-1">
            <div className="flex">
              {days.map((day) => (
                <div
                  key={day.dayNum}
                  className={cn(
                    'flex flex-col items-center justify-center py-1.5',
                    day.isWeekend && 'bg-muted/30',
                    day.isHoliday && 'bg-amber-500/5',
                    day.isToday && 'bg-primary/5',
                  )}
                  style={{ width: `${100 / daysInMonth}%` }}
                >
                  <span
                    className={cn(
                      'font-brand text-muted-foreground/40',
                      day.isToday && 'text-primary',
                    )}
                    style={{ fontSize: scaled(7) }}
                  >
                    {day.date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </span>
                  <span
                    className={cn(
                      'font-brand font-semibold',
                      day.isWeekend || day.isHoliday
                        ? 'text-muted-foreground/30'
                        : day.isToday
                          ? 'rounded-full bg-primary px-1 text-primary-foreground'
                          : 'text-foreground/70',
                    )}
                    style={{ fontSize: scaled(9) }}
                  >
                    {day.dayNum}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Person rows with bars */}
        {filtered.map((person) => {
          const bookings = getBookingsForUser(person.id).filter(
            (b) => b.startDate <= monthEndStr && b.endDate >= monthStartStr,
          );

          return (
            <div key={person.id} className="flex border-b border-border/50 last:border-b-0">
              <div
                className="flex shrink-0 items-center gap-2 border-r border-border px-3 py-2.5"
                style={{ width: 180 }}
              >
                <Avatar person={person} size={24} />
                <div className="min-w-0">
                  <div
                    className="truncate font-medium text-foreground"
                    style={{ fontSize: scaled(11) }}
                  >
                    {person.name}
                  </div>
                </div>
              </div>
              <div className="relative flex-1" style={{ height: 44 }}>
                {/* Weekend stripes */}
                {days.map(
                  (day) =>
                    (day.isWeekend || day.isHoliday) && (
                      <div
                        key={day.dayNum}
                        className={cn(
                          'absolute top-0 h-full',
                          day.isWeekend ? 'bg-muted/20' : 'bg-amber-500/5',
                        )}
                        style={{
                          left: `${((day.dayNum - 1) / daysInMonth) * 100}%`,
                          width: `${(1 / daysInMonth) * 100}%`,
                        }}
                      />
                    ),
                )}
                {/* Today line */}
                {days.find((d) => d.isToday) && (
                  <div
                    className="absolute top-0 z-10 h-full w-[1.5px] bg-primary/50"
                    style={{
                      left: `${(((days.find((d) => d.isToday)?.dayNum ?? 1) - 0.5) / daysInMonth) * 100}%`,
                    }}
                  />
                )}
                {/* Booking bars */}
                {bookings.map((booking) => {
                  const lt = getLeaveType(booking.leaveTypeId);
                  if (!lt) return null;
                  const style = getBarStyle(booking);
                  const isPartial = booking.hours !== null;

                  return (
                    <motion.div
                      key={booking.id}
                      className={cn(
                        'absolute top-2 flex items-center rounded-md px-1.5',
                        isPartial ? 'border border-dashed' : '',
                      )}
                      style={{
                        left: style.left,
                        width: style.width,
                        height: 28,
                        backgroundColor: lt.color + '20',
                        borderColor: isPartial ? lt.color + '40' : undefined,
                      }}
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ duration: 0.3 }}
                      title={`${lt.name}${isPartial ? ` (${booking.hours}h)` : ''} — ${booking.startDate} to ${booking.endDate}${booking.note ? ` — ${booking.note}` : ''}`}
                    >
                      <span
                        className="truncate font-brand font-medium"
                        style={{ fontSize: scaled(8), color: lt.color }}
                      >
                        {lt.name}
                        {isPartial ? ` ${booking.hours}h` : ''}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyLeaveList() {
  const myBookings = BOOKINGS.filter((b) => b.userId === 'u1' && b.status !== 'cancelled');

  return (
    <div className="space-y-2">
      {myBookings.map((booking) => {
        const leaveType = getLeaveType(booking.leaveTypeId);
        if (!leaveType) return null;
        const isPartial = booking.hours !== null;
        return (
          <motion.div
            key={booking.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--t-surface))] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full" style={{ backgroundColor: leaveType.color }} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
                    {leaveType.name}
                  </span>
                  {isPartial && (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-brand font-medium"
                      style={{
                        fontSize: scaled(9),
                        backgroundColor: leaveType.color + '15',
                        color: leaveType.color,
                      }}
                    >
                      {booking.hours}h
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  {booking.startDate === booking.endDate
                    ? new Date(booking.startDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : `${new Date(booking.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(booking.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  {!isPartial && ` · ${booking.daysCount} day${booking.daysCount !== 1 ? 's' : ''}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-brand font-medium text-emerald-500"
                style={{ fontSize: scaled(9) }}
              >
                Confirmed
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div
      className="flex items-center gap-5 rounded-lg border border-border bg-muted/20 px-4 py-2"
      style={{ fontSize: scaled(9) }}
    >
      <span
        className="font-brand uppercase tracking-wider text-muted-foreground/50"
        style={{ fontWeight: 600 }}
      >
        Legend
      </span>
      {LEAVE_TYPES.map((lt) => (
        <span key={lt.id} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="inline-block h-3 w-6 rounded-md"
            style={{ backgroundColor: lt.color + '20' }}
          />
          {lt.name}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block h-3 w-6 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30" />
        Partial day
      </span>
    </div>
  );
}

// ── Summary stats ───────────────────────────────────────────────

function SummaryStats({ year, month }: { year: number; month: number }) {
  const daysInMonth = getDaysInMonth(year, month);
  const monthStart = formatDate(new Date(year, month, 1));
  const monthEnd = formatDate(new Date(year, month, daysInMonth));

  const activeBookings = BOOKINGS.filter(
    (b) => b.status !== 'cancelled' && b.startDate <= monthEnd && b.endDate >= monthStart,
  );

  const peopleOut = new Set(activeBookings.map((b) => b.userId)).size;
  const totalDays = activeBookings.reduce((sum, b) => sum + b.daysCount, 0);

  return (
    <div className="flex gap-3">
      <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] px-3.5 py-2">
        <div
          className="font-brand uppercase text-muted-foreground"
          style={{ fontSize: scaled(9), letterSpacing: '1.5px' }}
        >
          People out
        </div>
        <div
          className="mt-0.5 font-brand font-bold tabular-nums text-foreground"
          style={{ fontSize: scaled(16) }}
        >
          {peopleOut}
        </div>
      </div>
      <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] px-3.5 py-2">
        <div
          className="font-brand uppercase text-muted-foreground"
          style={{ fontSize: scaled(9), letterSpacing: '1.5px' }}
        >
          Total days
        </div>
        <div
          className="mt-0.5 font-brand font-bold tabular-nums text-foreground"
          style={{ fontSize: scaled(16) }}
        >
          {totalDays}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export function DevLeaveV2Page() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<'wallchart' | 'my-leave'>('wallchart');
  const [search, setSearch] = useState('');

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const TABS = [
    { id: 'wallchart' as const, label: 'Wallchart' },
    { id: 'my-leave' as const, label: 'My Leave' },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <div className="min-h-screen bg-background text-foreground">
          <DevToolbar />
          <div className="mx-auto max-w-[1400px] p-6">
            <div className="mb-6">
              <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
                Exploration 2 — Gantt Bar Wallchart
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Horizontal bars spanning leave dates. Visual duration at a glance. Summary stats.
                Partial days shown with dashed borders.
              </p>
            </div>

            <div>
              {/* Page header */}
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h1
                    className="font-brand font-semibold tracking-wide text-foreground"
                    style={{ fontSize: scaled(18) }}
                  >
                    Leave
                  </h1>
                  <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
                    Book time off and see who's out
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 rounded-md border border-border bg-primary px-3 py-1.5 font-brand font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  style={{ fontSize: scaled(12) }}
                >
                  <Plus style={{ width: scaled(14), height: scaled(14) }} />
                  Book time off
                </button>
              </div>

              {/* Tabs */}
              <div className="mb-5 flex gap-1 border-b border-border pb-px">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'mb-[-1px] flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-brand font-medium uppercase tracking-wider transition-colors',
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                    style={{ fontSize: scaled(11), letterSpacing: '1px' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'wallchart' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <MonthNavigator
                        year={year}
                        month={month}
                        onPrev={prevMonth}
                        onNext={nextMonth}
                        onToday={goToday}
                      />
                      <SummaryStats year={year} month={month} />
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search people..."
                        className="w-[200px] rounded-lg border border-border bg-muted/50 py-1.5 pl-8 pr-3 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
                        style={{ fontSize: scaled(11) }}
                      />
                    </div>
                  </div>

                  <GanttWallchart year={year} month={month} search={search} />

                  <div className="mt-3">
                    <Legend />
                  </div>
                </div>
              )}

              {activeTab === 'my-leave' && <MyLeaveList />}
            </div>
          </div>
        </div>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
