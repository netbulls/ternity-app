import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import {
  Palmtree,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  CalendarDays,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// V3 — Card-per-Person Wallchart
// Instead of a grid or bars, each person gets a card showing their
// leave for the month. Cards are stacked vertically. Feels more like
// a list/feed. Good for small teams where you want detail per person.
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

function getLeaveType(id: string): LeaveType | undefined {
  return LEAVE_TYPES.find((lt) => lt.id === id);
}

// ── Components ──────────────────────────────────────────────────

function Avatar({ person, size = 32 }: { person: Person; size?: number }) {
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

function PersonCard({
  person,
  bookings,
  year,
  month,
}: {
  person: Person;
  bookings: LeaveBooking[];
  year: number;
  month: number;
}) {
  const totalDays = bookings.reduce((sum, b) => sum + b.daysCount, 0);
  const daysInMonth = getDaysInMonth(year, month);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-[hsl(var(--t-surface))] p-4"
    >
      {/* Person header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar person={person} size={36} />
          <div>
            <div className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              {person.name}
            </div>
            <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
              {person.role}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-brand font-bold text-foreground" style={{ fontSize: scaled(14) }}>
            {totalDays}
          </div>
          <div
            className="font-brand uppercase text-muted-foreground"
            style={{ fontSize: scaled(8), letterSpacing: '1px' }}
          >
            days off
          </div>
        </div>
      </div>

      {/* Mini month bar */}
      <div className="mb-3 flex gap-px rounded-md overflow-hidden">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(year, month, i + 1);
          const dateStr = formatDate(d);
          const dayOfWeek = d.getDay();
          const isWe = dayOfWeek === 0 || dayOfWeek === 6;
          const booking = bookings.find((b) => b.startDate <= dateStr && b.endDate >= dateStr);
          const lt = booking ? getLeaveType(booking.leaveTypeId) : null;
          const isToday = dateStr === formatDate(new Date());

          return (
            <div
              key={i}
              className={cn('h-2 flex-1', isToday && 'ring-1 ring-primary')}
              style={{
                backgroundColor: lt
                  ? lt.color + '40'
                  : isWe
                    ? 'hsl(var(--muted) / 0.3)'
                    : 'hsl(var(--muted) / 0.1)',
              }}
              title={`${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${lt ? ` — ${lt.name}` : ''}`}
            />
          );
        })}
      </div>

      {/* Booking details */}
      <div className="space-y-1.5">
        {bookings.map((booking) => {
          const lt = getLeaveType(booking.leaveTypeId);
          if (!lt) return null;
          const isPartial = booking.hours !== null;

          return (
            <div
              key={booking.id}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
              style={{ backgroundColor: lt.color + '08' }}
            >
              <div
                className="h-5 w-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: lt.color }}
              />
              <div className="flex flex-1 items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: scaled(11), color: lt.color }} className="font-medium">
                    {lt.name}
                  </span>
                  {isPartial && (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-brand"
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
                <span className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
                  {booking.startDate === booking.endDate
                    ? new Date(booking.startDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        day: 'numeric',
                      })
                    : `${new Date(booking.startDate).toLocaleDateString('en-US', { day: 'numeric' })}–${new Date(booking.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`}
                  {!isPartial && ` · ${booking.daysCount}d`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function EmptyPersonCard({ person }: { person: Person }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-[hsl(var(--t-surface))] px-4 py-3 opacity-40">
      <Avatar person={person} size={28} />
      <div className="font-medium text-foreground" style={{ fontSize: scaled(12) }}>
        {person.name}
      </div>
      <span className="ml-auto text-muted-foreground" style={{ fontSize: scaled(10) }}>
        No leave this month
      </span>
    </div>
  );
}

function WallchartCards({
  year,
  month,
  search,
  showAll,
}: {
  year: number;
  month: number;
  search: string;
  showAll: boolean;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const monthStart = formatDate(new Date(year, month, 1));
  const monthEnd = formatDate(new Date(year, month, daysInMonth));

  const peopleWithLeave = PEOPLE.map((person) => {
    const bookings = BOOKINGS.filter(
      (b) =>
        b.userId === person.id &&
        b.status !== 'cancelled' &&
        b.startDate <= monthEnd &&
        b.endDate >= monthStart,
    );
    return { person, bookings };
  }).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.person.name.toLowerCase().includes(q) || p.person.role.toLowerCase().includes(q);
  });

  const withLeave = peopleWithLeave.filter((p) => p.bookings.length > 0);
  const withoutLeave = peopleWithLeave.filter((p) => p.bookings.length === 0);

  // Summary
  const totalDaysOff = withLeave.reduce(
    (sum, p) => sum + p.bookings.reduce((s, b) => s + b.daysCount, 0),
    0,
  );

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Users
            style={{ width: scaled(14), height: scaled(14) }}
            className="text-muted-foreground"
          />
          <span className="font-brand text-muted-foreground" style={{ fontSize: scaled(11) }}>
            <span className="font-bold text-foreground">{withLeave.length}</span> people out
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays
            style={{ width: scaled(14), height: scaled(14) }}
            className="text-muted-foreground"
          />
          <span className="font-brand text-muted-foreground" style={{ fontSize: scaled(11) }}>
            <span className="font-bold text-foreground">{totalDaysOff}</span> total days
          </span>
        </div>
      </div>

      {/* Cards for people with leave */}
      <div className="space-y-2">
        {withLeave.map(({ person, bookings }) => (
          <PersonCard
            key={person.id}
            person={person}
            bookings={bookings}
            year={year}
            month={month}
          />
        ))}
      </div>

      {/* People without leave */}
      {showAll && withoutLeave.length > 0 && (
        <div className="mt-4">
          <div
            className="mb-2 font-brand uppercase tracking-wider text-muted-foreground/50"
            style={{ fontSize: scaled(9), fontWeight: 600 }}
          >
            Available all month
          </div>
          <div className="space-y-1">
            {withoutLeave.map(({ person }) => (
              <EmptyPersonCard key={person.id} person={person} />
            ))}
          </div>
        </div>
      )}
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
            <span
              className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-brand font-medium text-emerald-500"
              style={{ fontSize: scaled(9) }}
            >
              Confirmed
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export function DevLeaveV3Page() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<'wallchart' | 'my-leave'>('wallchart');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

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
          <div className="mx-auto max-w-[900px] p-6">
            <div className="mb-6">
              <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
                Exploration 3 — Card-per-Person
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Each person with leave gets a card showing their bookings for the month. Mini
                month-bar visualization. Detail-rich, good for small teams.
              </p>
            </div>

            <div>
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
                    <MonthNavigator
                      year={year}
                      month={month}
                      onPrev={prevMonth}
                      onNext={nextMonth}
                      onToday={goToday}
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowAll(!showAll)}
                        className={cn(
                          'rounded-full border px-3 py-1 font-brand font-medium transition-colors',
                          showAll
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground',
                        )}
                        style={{ fontSize: scaled(10) }}
                      >
                        Show all
                      </button>
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
                  </div>
                  <WallchartCards year={year} month={month} search={search} showAll={showAll} />
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
