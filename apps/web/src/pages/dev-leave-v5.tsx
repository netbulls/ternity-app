import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Palmtree, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// V5 — Split View: My Leave sidebar + Wallchart main
// Left panel shows personal bookings, upcoming, and "Book time off"
// inline form. Right panel is the wallchart grid. Both visible at once.
// No tabs — everything on one screen.
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

function getBookingsForUserOnDate(userId: string, dateStr: string): LeaveBooking[] {
  return BOOKINGS.filter(
    (b) =>
      b.userId === userId &&
      b.status !== 'cancelled' &&
      b.startDate <= dateStr &&
      b.endDate >= dateStr,
  );
}

// ── Components ──────────────────────────────────────────────────

function Avatar({ person, size = 24 }: { person: Person; size?: number }) {
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

// ── My Leave Sidebar ────────────────────────────────────────────

function MyLeaveSidebar() {
  const myBookings = BOOKINGS.filter((b) => b.userId === 'u1' && b.status !== 'cancelled');
  const upcoming = myBookings.filter((b) => b.endDate >= formatDate(new Date()));
  const past = myBookings.filter((b) => b.endDate < formatDate(new Date()));
  const totalDaysThisYear = myBookings.reduce((sum, b) => sum + b.daysCount, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Book time off button */}
      <button
        className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 font-brand font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        style={{ fontSize: scaled(12) }}
      >
        <Plus style={{ width: scaled(14), height: scaled(14) }} />
        Book time off
      </button>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] p-2.5">
          <div
            className="font-brand uppercase text-muted-foreground"
            style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}
          >
            Days used
          </div>
          <div
            className="mt-0.5 font-brand font-bold tabular-nums text-foreground"
            style={{ fontSize: scaled(16) }}
          >
            {totalDaysThisYear}
          </div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] p-2.5">
          <div
            className="font-brand uppercase text-muted-foreground"
            style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}
          >
            Upcoming
          </div>
          <div
            className="mt-0.5 font-brand font-bold tabular-nums text-foreground"
            style={{ fontSize: scaled(16) }}
          >
            {upcoming.length}
          </div>
        </div>
      </div>

      {/* Upcoming bookings */}
      {upcoming.length > 0 && (
        <div className="mb-4">
          <div
            className="mb-2 font-brand uppercase tracking-wider text-muted-foreground/50"
            style={{ fontSize: scaled(9), fontWeight: 600 }}
          >
            Upcoming
          </div>
          <div className="space-y-1.5">
            {upcoming.map((booking) => {
              const lt = getLeaveType(booking.leaveTypeId);
              if (!lt) return null;
              const isPartial = booking.hours !== null;
              return (
                <div
                  key={booking.id}
                  className="group flex items-start gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/30"
                >
                  <div
                    className="mt-1 h-4 w-0.5 shrink-0 rounded-full"
                    style={{ backgroundColor: lt.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-medium text-foreground"
                        style={{ fontSize: scaled(11) }}
                      >
                        {lt.name}
                      </span>
                      {isPartial && (
                        <span
                          className="rounded-full px-1 py-px font-brand"
                          style={{
                            fontSize: scaled(8),
                            backgroundColor: lt.color + '15',
                            color: lt.color,
                          }}
                        >
                          {booking.hours}h
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground" style={{ fontSize: scaled(9) }}>
                      {booking.startDate === booking.endDate
                        ? new Date(booking.startDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })
                        : `${new Date(booking.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(booking.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </div>
                    {booking.note && (
                      <div
                        className="mt-0.5 truncate text-[hsl(var(--t-text-muted))]"
                        style={{ fontSize: scaled(9) }}
                      >
                        {booking.note}
                      </div>
                    )}
                  </div>
                  <button className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:text-destructive">
                    <X style={{ width: scaled(12), height: scaled(12) }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past bookings */}
      {past.length > 0 && (
        <div>
          <div
            className="mb-2 font-brand uppercase tracking-wider text-muted-foreground/50"
            style={{ fontSize: scaled(9), fontWeight: 600 }}
          >
            Past
          </div>
          <div className="space-y-1">
            {past.map((booking) => {
              const lt = getLeaveType(booking.leaveTypeId);
              if (!lt) return null;
              return (
                <div
                  key={booking.id}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 opacity-50"
                >
                  <div
                    className="h-3 w-0.5 shrink-0 rounded-full"
                    style={{ backgroundColor: lt.color }}
                  />
                  <span className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
                    {lt.name} ·{' '}
                    {new Date(booking.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Wallchart Grid ──────────────────────────────────────────────

function WallchartGrid({ year, month, search }: { year: number; month: number; search: string }) {
  const daysInMonth = getDaysInMonth(year, month);
  const cellSize = 28;

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return {
      date: d,
      dateStr: formatDate(d),
      dayNum: i + 1,
      dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      isWeekend: isWeekend(d),
      isHoliday: isHoliday(formatDate(d)),
      isToday: formatDate(d) === formatDate(new Date()),
    };
  });

  const mondayPositions = days.filter((d) => d.date.getDay() === 1).map((d) => d.dayNum);

  const filtered = PEOPLE.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div style={{ minWidth: `${160 + daysInMonth * cellSize}px` }}>
        {/* Header */}
        <div className="flex border-b border-border bg-muted/10">
          <div className="shrink-0 border-r border-border px-3 py-1.5" style={{ width: 160 }} />
          {days.map((day) => (
            <div
              key={day.dayNum}
              className={cn(
                'flex shrink-0 flex-col items-center justify-end py-1',
                day.isWeekend && 'bg-muted/25',
                day.isHoliday && !day.isWeekend && 'bg-amber-500/5',
                day.isToday && 'bg-primary/5',
                mondayPositions.includes(day.dayNum) && 'border-l border-border/40',
              )}
              style={{ width: cellSize }}
            >
              <span
                className={cn(
                  'font-brand',
                  day.isToday ? 'text-primary' : 'text-muted-foreground/30',
                )}
                style={{ fontSize: scaled(7) }}
              >
                {day.dayName}
              </span>
              <span
                className={cn(
                  'font-brand font-semibold',
                  day.isWeekend || day.isHoliday
                    ? 'text-muted-foreground/20'
                    : day.isToday
                      ? 'rounded-full bg-primary px-1 text-primary-foreground'
                      : 'text-foreground/60',
                )}
                style={{ fontSize: scaled(8) }}
              >
                {day.dayNum}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {filtered.map((person) => (
          <div
            key={person.id}
            className="flex border-b border-border/30 last:border-b-0 hover:bg-muted/5"
          >
            <div
              className="flex shrink-0 items-center gap-2 border-r border-border px-2.5 py-1"
              style={{ width: 160 }}
            >
              <Avatar person={person} size={20} />
              <span className="truncate text-foreground" style={{ fontSize: scaled(10) }}>
                {person.name.split(' ')[0]}{' '}
                {person.name
                  .split(' ')
                  .slice(1)
                  .map((n) => n[0])
                  .join('')}
              </span>
            </div>
            {days.map((day) => {
              const bookings = getBookingsForUserOnDate(person.id, day.dateStr);
              const booking = bookings[0];
              const lt = booking ? getLeaveType(booking.leaveTypeId) : null;
              const isPartial = booking?.hours !== null && booking?.hours !== undefined;
              const isStart = booking?.startDate === day.dateStr;
              const isEnd = booking?.endDate === day.dateStr;
              const isSingle = isStart && isEnd;

              return (
                <div
                  key={day.dayNum}
                  className={cn(
                    'flex shrink-0 items-center justify-center',
                    day.isWeekend && 'bg-muted/12',
                    day.isHoliday && !day.isWeekend && 'bg-amber-500/5',
                    day.isToday && !booking && 'bg-primary/5',
                    mondayPositions.includes(day.dayNum) && 'border-l border-border/20',
                  )}
                  style={{ width: cellSize, height: cellSize }}
                  title={
                    booking && lt
                      ? `${lt.name}${isPartial ? ` (${booking.hours}h)` : ''} — ${booking.startDate} to ${booking.endDate}`
                      : undefined
                  }
                >
                  {booking && lt && (
                    <div
                      className={cn(
                        'flex h-[20px] items-center justify-center',
                        isSingle
                          ? 'w-[20px] rounded'
                          : isStart
                            ? 'w-full rounded-l'
                            : isEnd
                              ? 'w-full rounded-r'
                              : 'w-full',
                        isPartial && 'border border-dashed',
                      )}
                      style={{
                        backgroundColor: lt.color + (isPartial ? '15' : '25'),
                        borderColor: isPartial ? lt.color + '35' : undefined,
                      }}
                    >
                      {isPartial && (
                        <span
                          className="font-brand font-bold"
                          style={{ fontSize: scaled(7), color: lt.color }}
                        >
                          {booking.hours}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/20 px-3 py-1.5"
      style={{ fontSize: scaled(8) }}
    >
      <span
        className="font-brand uppercase tracking-wider text-muted-foreground/50"
        style={{ fontWeight: 600 }}
      >
        Legend
      </span>
      {LEAVE_TYPES.map((lt) => (
        <span key={lt.id} className="flex items-center gap-1 text-muted-foreground">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{ backgroundColor: lt.color + '25' }}
          />
          {lt.name}
        </span>
      ))}
      <span className="flex items-center gap-1 text-muted-foreground">
        <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-muted-foreground/30 bg-muted/20" />
        Partial
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export function DevLeaveV5Page() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
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

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <div className="min-h-screen bg-background text-foreground">
          <DevToolbar />
          <div className="mx-auto max-w-[1500px] p-6">
            <div className="mb-6">
              <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
                Exploration 5 — Split View
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                My Leave sidebar + Wallchart main area. No tabs — everything visible at once.
                Personal bookings, stats, and booking action always accessible alongside team view.
              </p>
            </div>

            <div>
              {/* Page header */}
              <div className="mb-5">
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

              {/* Split layout */}
              <div className="flex gap-5">
                {/* Left sidebar — My Leave */}
                <div
                  className="shrink-0 rounded-lg border border-border bg-[hsl(var(--t-surface))] p-4"
                  style={{ width: 260 }}
                >
                  <div
                    className="mb-3 font-brand font-semibold uppercase tracking-wider text-foreground"
                    style={{ fontSize: scaled(10), letterSpacing: '1.5px' }}
                  >
                    My Leave
                  </div>
                  <MyLeaveSidebar />
                </div>

                {/* Right — Wallchart */}
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex items-center justify-between">
                    <MonthNavigator
                      year={year}
                      month={month}
                      onPrev={prevMonth}
                      onNext={nextMonth}
                      onToday={goToday}
                    />
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search people..."
                        className="w-[180px] rounded-lg border border-border bg-muted/50 py-1.5 pl-8 pr-3 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
                        style={{ fontSize: scaled(11) }}
                      />
                    </div>
                  </div>
                  <WallchartGrid year={year} month={month} search={search} />
                  <div className="mt-2">
                    <Legend />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
