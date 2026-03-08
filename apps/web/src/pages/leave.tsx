import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Palmtree,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
  Loader2,
  Calendar,
  CalendarDays,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import { SelectPopover } from '@/components/ui/select-popover';
import {
  useLeaveTypes,
  useHolidays,
  useWallchart,
  useMyLeave,
  useBookLeave,
  useUpdateLeave,
  useCancelLeave,
  type LeaveBooking,
  type LeaveType,
  type WallchartUser,
} from '@/hooks/use-leave';
import { useWorkingHours } from '@/hooks/use-working-hours';
import { DEFAULT_WEEKLY_WORKING_HOURS, type WorkingDayKey } from '@ternity/shared';
import { useImpersonation } from '@/providers/impersonation-provider';

// ── Helpers ─────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Count working days between two YYYY-MM-DD dates (inclusive), excluding weekends and holidays */
function countWorkingDays(
  startDate: string,
  endDate: string,
  holidays: Record<string, string>,
): number {
  let count = 0;
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (current <= end) {
    const dateStr = formatDateStr(current);
    if (!isWeekend(current) && !(dateStr in holidays)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/** Get the actual working days for a booking (ignores stored daysCount from Timetastic sync) */
function getBookingWorkingDays(
  booking: { startDate: string; endDate: string; hours: number | null },
  holidays: Record<string, string>,
): number {
  if (booking.hours !== null && booking.hours !== undefined) {
    return booking.hours / 8;
  }
  return countWorkingDays(booking.startDate, booking.endDate, holidays);
}

/** Get the day-of-week key for a YYYY-MM-DD string */
function getWeekdayKey(dateStr: string): WorkingDayKey {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  const keys: WorkingDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return keys[day]!;
}

/** Parse "HH:MM" to minutes since midnight */
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + (m ?? 0);
}

/** Format minutes since midnight to "HH:MM" */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Generate time slot options from start to end (exclusive) in 30-min steps */
function generateTimeSlots(startMins: number, endMins: number): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let m = startMins; m < endMins; m += 30) {
    const time = minutesToTime(m);
    slots.push({ value: time, label: time });
  }
  return slots;
}

/** Generate duration options in 0.5h steps from 0.5 up to maxHours */
function generateDurationOptions(maxHours: number): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let h = 0.5; h <= maxHours; h += 0.5) {
    const hours = Math.floor(h);
    const mins = (h % 1) * 60;
    const label = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    opts.push({ value: String(h), label });
  }
  return opts;
}

type ViewMode = 'month' | 'week';

interface DayInfo {
  date: Date;
  dateStr: string;
  dayNum: number;
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isToday: boolean;
}

/** Get the Monday of the week containing the given date */
function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday = go back 6, otherwise go back to Monday
  result.setDate(result.getDate() + diff);
  return result;
}

/** Build days array for a week starting from Monday */
function getWeekDays(monday: Date, holidays: Record<string, string>): DayInfo[] {
  const todayStr = formatDateStr(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = formatDateStr(d);
    return {
      date: d,
      dateStr,
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      isWeekend: isWeekend(d),
      isHoliday: dateStr in holidays,
      isToday: dateStr === todayStr,
    };
  });
}

/** Build days array for a full month */
function getMonthDays(year: number, month: number, holidays: Record<string, string>): DayInfo[] {
  const daysInMonth = getDaysInMonth(year, month);
  const todayStr = formatDateStr(new Date());
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const dateStr = formatDateStr(d);
    return {
      date: d,
      dateStr,
      dayNum: i + 1,
      dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      isWeekend: isWeekend(d),
      isHoliday: dateStr in holidays,
      isToday: dateStr === todayStr,
    };
  });
}

// ── Planned vs Ad Hoc ──────────────────────────────────────────
// Planned = booked 24h+ before the start date
// Ad hoc = booked less than 24h before

type BookingCategory = 'planned' | 'adhoc';

const CATEGORY_COLORS: Record<BookingCategory, string> = {
  planned: '#00D4AA', // brand teal
  adhoc: '#F59E0B', // amber/yellow
};

const CATEGORY_LABELS: Record<BookingCategory, string> = {
  planned: 'Planned',
  adhoc: 'Ad hoc',
};

function getBookingCategory(booking: LeaveBooking): BookingCategory {
  if (!booking.createdAt) return 'adhoc';
  const created = new Date(booking.createdAt);
  const start = new Date(booking.startDate + 'T00:00:00');
  const diffMs = start.getTime() - created.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= 24 ? 'planned' : 'adhoc';
}

// ── Month Navigator ─────────────────────────────────────────────

function MonthNavigator({
  onPrev,
  onNext,
  onToday,
  label,
}: {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  label: string;
}) {
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

// ── Cell Tooltip ────────────────────────────────────────────────

function CellTooltip({
  bookings,
  position,
  holidays,
}: {
  bookings: LeaveBooking[];
  position: { top: number; left: number };
  holidays: Record<string, string>;
}) {
  // Use the first booking for the shared date header
  const first = bookings[0]!;
  const allPartial = bookings.every((b) => b.hours !== null);
  const allSameDay = bookings.every(
    (b) => b.startDate === first.startDate && b.endDate === first.endDate,
  );

  const formatDateRange = (b: LeaveBooking) =>
    b.startDate === b.endDate
      ? new Date(b.startDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
      : `${new Date(b.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(b.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, calc(-100% - 6px))',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        className="flex flex-col rounded-lg border border-border bg-popover px-3 py-2 shadow-lg"
      >
        {/* Shared date header when all bookings are on the same day */}
        {allSameDay && (
          <div className="mb-1 text-muted-foreground" style={{ fontSize: scaled(10) }}>
            {formatDateRange(first)}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {bookings.map((booking) => {
            const isPartial = booking.hours !== null;
            const category = getBookingCategory(booking);
            const catColor = CATEGORY_COLORS[category];
            const days = getBookingWorkingDays(booking, holidays);
            return (
              <div key={booking.id}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: catColor }} />
                  <span className="font-medium text-foreground" style={{ fontSize: scaled(11) }}>
                    {CATEGORY_LABELS[category]}
                  </span>
                  {isPartial && (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-brand font-medium"
                      style={{
                        fontSize: scaled(8),
                        backgroundColor: catColor + '15',
                        color: catColor,
                      }}
                    >
                      {booking.startHour ? `${booking.startHour} · ` : ''}
                      {booking.hours}h
                    </span>
                  )}
                  {!isPartial && (
                    <span className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
                      {days} day{days !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {/* Per-booking date line only when bookings span different date ranges */}
                {!allSameDay && (
                  <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(10) }}>
                    {formatDateRange(booking)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total line when multiple partial bookings */}
        {bookings.length > 1 && allPartial && (
          <div
            className="mt-1 border-t border-border pt-1 font-brand font-semibold text-foreground"
            style={{ fontSize: scaled(10) }}
          >
            Total: {bookings.reduce((sum, b) => sum + (b.hours ?? 0), 0)}h
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Wallchart Grid ──────────────────────────────────────────────

function WallchartGrid({
  currentUserId,
  days,
  holidays,
  onEditBooking,
  onSelectRange,
  rangeFrom,
  rangeTo,
  search,
  teamFilter,
  users,
  viewMode,
}: {
  currentUserId: string | null;
  days: DayInfo[];
  holidays: Record<string, string>;
  onEditBooking: (booking: LeaveBooking) => void;
  onSelectRange: (startDate: string, endDate: string) => void;
  rangeFrom: string;
  rangeTo: string;
  search: string;
  teamFilter: string;
  users: WallchartUser[];
  viewMode: ViewMode;
}) {
  const [hover, setHover] = useState<{
    bookings: LeaveBooking[];
    pos: { top: number; left: number };
  } | null>(null);

  // Drag-select state for booking a range on own row
  const [dragState, setDragState] = useState<{
    userId: string;
    startIdx: number;
    endIdx: number;
  } | null>(null);
  const isDragging = useRef(false);

  // Cancel drag if mouse released outside the grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setDragState(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const filtered = useMemo(() => {
    let result = users;
    if (teamFilter) {
      result = result.filter((u) => u.teamId === teamFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) => u.displayName.toLowerCase().includes(q));
    }
    return result;
  }, [users, search, teamFilter]);

  const getBookingsForUserOnDate = (user: WallchartUser, dateStr: string): LeaveBooking[] => {
    return user.bookings.filter(
      (b) => b.status !== 'cancelled' && b.startDate <= dateStr && b.endDate >= dateStr,
    );
  };

  const getUserRangeBookings = (user: WallchartUser): LeaveBooking[] => {
    return user.bookings.filter(
      (b) => b.status !== 'cancelled' && b.startDate <= rangeTo && b.endDate >= rangeFrom,
    );
  };

  const isWeek = viewMode === 'week';
  const personColW = 220;
  const daysColW = 50;
  const monthCellW = 28;
  const rowH = 40;
  // For week view, cells flex to fill; for month, fixed width with scroll
  const monthMinWidth = personColW + daysColW + days.length * monthCellW;

  // Sticky columns: person + days stay fixed, day cells scroll behind them
  const stickyPerson = 'sticky left-0 z-10 bg-background';
  const stickyDays = 'sticky z-10 bg-background';
  const stickyPersonHeader = 'sticky left-0 z-20 bg-background';
  const stickyDaysHeader = 'sticky z-20 bg-background';

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div style={isWeek ? undefined : { minWidth: `${monthMinWidth}px` }}>
        {/* Header */}
        <div className="flex border-b border-border bg-muted/10">
          <div
            className={cn(
              'flex shrink-0 items-center border-r border-border px-3',
              stickyPersonHeader,
            )}
            style={{ width: personColW, height: isWeek ? undefined : rowH }}
          >
            <span
              className="font-brand font-semibold uppercase tracking-wider text-muted-foreground/50"
              style={{ fontSize: scaled(9) }}
            >
              Team
            </span>
          </div>
          <div
            className={cn(
              'flex shrink-0 items-center justify-center border-r border-border px-2',
              stickyDaysHeader,
            )}
            style={{ width: daysColW, left: personColW, height: isWeek ? undefined : rowH }}
          >
            <span
              className="font-brand font-semibold uppercase tracking-wider text-muted-foreground/50"
              style={{ fontSize: scaled(9) }}
            >
              Days
            </span>
          </div>
          {days.map((day, dayIdx) => (
            <div
              key={day.dateStr}
              className={cn(
                'flex items-center justify-center',
                isWeek ? 'min-w-0 flex-1 flex-col py-1' : 'min-w-0 flex-1',
                isWeek && dayIdx < days.length - 1 && 'border-r border-border/30',
                day.isWeekend && 'bg-muted/15',
                day.isHoliday && !day.isWeekend && 'bg-amber-500/5',
                day.isToday && 'bg-primary/5',
              )}
              style={isWeek ? undefined : { minWidth: monthCellW, height: rowH }}
            >
              {isWeek ? (
                <>
                  <span
                    className={cn(
                      'font-brand',
                      day.isToday ? 'text-primary' : 'text-muted-foreground/30',
                    )}
                    style={{ fontSize: scaled(9) }}
                  >
                    {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span
                    className={cn(
                      'mt-px font-brand font-semibold',
                      day.isWeekend || day.isHoliday
                        ? 'text-muted-foreground/20'
                        : day.isToday
                          ? 'rounded-full bg-primary px-1 text-primary-foreground'
                          : 'text-foreground/60',
                    )}
                    style={{ fontSize: scaled(11) }}
                  >
                    {day.dayNum}
                  </span>
                </>
              ) : (
                <span
                  className={cn(
                    'font-brand font-semibold uppercase',
                    day.isToday
                      ? 'text-primary'
                      : day.isWeekend
                        ? 'text-muted-foreground/20'
                        : 'text-muted-foreground/40',
                  )}
                  style={{ fontSize: scaled(9) }}
                >
                  {day.dayName}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Rows */}
        {filtered.map((user) => {
          const userBookings = getUserRangeBookings(user);
          // Separate full-day and partial-hour totals for compact display
          let fullDays = 0;
          let partialHours = 0;
          for (const b of userBookings) {
            if (b.hours !== null && b.hours !== undefined) {
              partialHours += b.hours;
            } else {
              fullDays += countWorkingDays(b.startDate, b.endDate, holidays);
            }
          }
          // Roll over every 8 partial hours into a full day
          if (partialHours >= 8) {
            fullDays += Math.floor(partialHours / 8);
            partialHours = partialHours % 8;
          }
          const hasTotal = fullDays > 0 || partialHours > 0;
          const isOwnRow = currentUserId === user.id;

          return (
            <div key={user.id} className="flex hover:bg-muted/5">
              <div
                className={cn(
                  'flex shrink-0 items-center gap-2.5 border-r border-border px-3 py-1',
                  stickyPerson,
                )}
                style={{ width: personColW }}
              >
                <UserAvatar user={user} size="md" />
                <div className="flex min-w-0 flex-col">
                  <span
                    className="truncate font-medium text-foreground"
                    style={{ fontSize: scaled(12) }}
                  >
                    {user.displayName}
                  </span>
                  {user.teamName && (
                    <span
                      className="truncate text-muted-foreground"
                      style={{ fontSize: scaled(11) }}
                    >
                      {user.teamName}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center border-r border-border px-2',
                  stickyDays,
                )}
                style={{ width: daysColW, left: personColW }}
              >
                {hasTotal && (
                  <span
                    className="font-brand font-bold tabular-nums text-foreground"
                    style={{ fontSize: scaled(10) }}
                  >
                    {fullDays > 0 && <>{fullDays}d</>}
                    {partialHours > 0 && <>{partialHours}h</>}
                  </span>
                )}
              </div>
              {days.map((day, dayIdx) => {
                // Weekends and holidays never show leave — they're not working days
                const isNonWorking = day.isWeekend || day.isHoliday;
                const bookings = isNonWorking ? [] : getBookingsForUserOnDate(user, day.dateStr);
                const booking = bookings[0];
                const isPartial = booking?.hours !== null && booking?.hours !== undefined;
                const totalHours =
                  bookings.length > 0 && bookings.every((b) => b.hours !== null)
                    ? bookings.reduce((sum, b) => sum + (b.hours ?? 0), 0)
                    : null;

                // Determine visual rounding by checking adjacent working days on the grid
                let isVisualStart = false;
                let isVisualEnd = false;
                if (booking) {
                  let prevHasSame = false;
                  for (let i = dayIdx - 1; i >= 0; i--) {
                    const prev = days[i]!;
                    if (prev.isWeekend || prev.isHoliday) continue;
                    prevHasSame =
                      prev.dateStr >= booking.startDate && prev.dateStr <= booking.endDate;
                    break;
                  }
                  let nextHasSame = false;
                  for (let i = dayIdx + 1; i < days.length; i++) {
                    const next = days[i]!;
                    if (next.isWeekend || next.isHoliday) continue;
                    nextHasSame =
                      next.dateStr >= booking.startDate && next.dateStr <= booking.endDate;
                    break;
                  }
                  isVisualStart = !prevHasSame;
                  isVisualEnd = !nextHasSame;
                }
                const isSingle = isVisualStart && isVisualEnd;

                // Drag-select highlight for own row
                const isDragSelected =
                  isOwnRow &&
                  dragState?.userId === user.id &&
                  !isNonWorking &&
                  (() => {
                    const lo = Math.min(dragState.startIdx, dragState.endIdx);
                    const hi = Math.max(dragState.startIdx, dragState.endIdx);
                    return dayIdx >= lo && dayIdx <= hi;
                  })();

                return (
                  <div
                    key={day.dateStr}
                    className={cn(
                      'relative flex items-center justify-center self-stretch',
                      isWeek ? 'min-w-0 flex-1' : 'min-w-0 flex-1',
                      isWeek && dayIdx < days.length - 1 && 'border-r border-border/30',
                      day.isWeekend && 'bg-muted/15',
                      day.isHoliday && !day.isWeekend && 'bg-amber-500/5',
                      day.isToday && 'bg-primary/5',
                      isOwnRow && !isNonWorking && !booking && 'cursor-crosshair',
                      isOwnRow && booking && 'cursor-pointer',
                    )}
                    style={isWeek ? undefined : { minWidth: monthCellW }}
                    onMouseEnter={(e) => {
                      // Continue drag selection
                      if (isDragging.current && dragState?.userId === user.id) {
                        setDragState((prev) => (prev ? { ...prev, endIdx: dayIdx } : null));
                      }
                      if (bookings.length > 0) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHover({
                          bookings,
                          pos: { top: rect.top, left: rect.left + rect.width / 2 },
                        });
                      }
                    }}
                    onMouseLeave={() => setHover(null)}
                    onMouseDown={(e) => {
                      if (!isOwnRow || isNonWorking || e.button !== 0) return;
                      // Click on existing booking — will handle on mouseup (to distinguish from drag)
                      if (!booking) {
                        isDragging.current = true;
                        setDragState({ userId: user.id, startIdx: dayIdx, endIdx: dayIdx });
                        e.preventDefault(); // prevent text selection
                      }
                    }}
                    onMouseUp={() => {
                      if (!isOwnRow) return;
                      if (booking && !isDragging.current) {
                        // Click on existing booking → edit
                        onEditBooking(booking);
                        setHover(null);
                      } else if (isDragging.current && dragState) {
                        // Finish drag selection → open dialog with range
                        const lo = Math.min(dragState.startIdx, dragState.endIdx);
                        const hi = Math.max(dragState.startIdx, dragState.endIdx);
                        // Collect working day date strings from selection
                        const selectedDates = days
                          .slice(lo, hi + 1)
                          .filter((d) => !d.isWeekend && !d.isHoliday)
                          .map((d) => d.dateStr);
                        if (selectedDates.length > 0) {
                          onSelectRange(
                            selectedDates[0]!,
                            selectedDates[selectedDates.length - 1]!,
                          );
                        }
                        isDragging.current = false;
                        setDragState(null);
                      }
                    }}
                  >
                    {/* Drag selection highlight */}
                    {isDragSelected && (
                      <div className="absolute inset-x-0 inset-y-[4px] z-[1] rounded-sm bg-primary/15" />
                    )}
                    {/* Day number inside each cell (month view only, hidden for partial bookings — hours label shown instead) */}
                    {!isWeek && !isPartial && (
                      <span
                        className={cn(
                          'absolute inset-0 z-[2] flex items-center justify-center font-brand font-semibold tabular-nums',
                          booking
                            ? 'text-foreground/60'
                            : day.isWeekend || day.isHoliday
                              ? 'text-muted-foreground/20'
                              : day.isToday
                                ? 'text-primary'
                                : 'text-muted-foreground/40',
                        )}
                        style={{ fontSize: scaled(9) }}
                      >
                        {day.dayNum}
                      </span>
                    )}
                    {booking &&
                      (() => {
                        const catColor = CATEGORY_COLORS[getBookingCategory(booking)];
                        // Week view + partial: horizontal proportional bars (left→right = start→end of day)
                        if (isWeek && isPartial) {
                          const WORK_DAY_H = 8;
                          const WORK_START = 8.5; // 08:30
                          return bookings.map((b) => {
                            const bCatColor = CATEGORY_COLORS[getBookingCategory(b)];
                            const bHours = b.hours ?? WORK_DAY_H;
                            let startDecimal = WORK_START;
                            if (b.startHour) {
                              const [hh, mm] = b.startHour.split(':').map(Number);
                              startDecimal = hh! + mm! / 60;
                            }
                            const leftPct = ((startDecimal - WORK_START) / WORK_DAY_H) * 100;
                            const widthPct = (bHours / WORK_DAY_H) * 100;
                            return (
                              <div
                                key={b.id}
                                className="absolute inset-y-[4px] z-[1] rounded-sm border border-dashed"
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${Math.max(widthPct, 4)}%`,
                                  backgroundColor: bCatColor + '20',
                                  borderColor: bCatColor + '50',
                                }}
                              />
                            );
                          });
                        }
                        // Full-day or month view: single bar spanning the cell
                        return (
                          <div
                            className={cn(
                              'absolute inset-x-0 inset-y-[4px] z-[1] flex items-center justify-center',
                              isSingle
                                ? 'rounded-md'
                                : isVisualStart
                                  ? 'rounded-l-md'
                                  : isVisualEnd
                                    ? 'rounded-r-md'
                                    : '',
                              isPartial && 'border border-dashed',
                            )}
                            style={{
                              backgroundColor: catColor + (isPartial ? '15' : '25'),
                              borderColor: isPartial ? catColor + '40' : undefined,
                            }}
                          >
                            {isPartial && (
                              <span
                                className="z-[2] font-brand font-bold"
                                style={{ fontSize: scaled(7), color: catColor }}
                              >
                                {totalHours ?? booking.hours}h
                              </span>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Footer — people out per day */}
        <div className="flex border-t border-border bg-muted/10">
          <div
            className={cn(
              'flex shrink-0 items-center border-r border-border px-3',
              stickyPersonHeader,
            )}
            style={{ width: personColW, height: isWeek ? undefined : rowH }}
          >
            <span
              className="font-brand font-semibold uppercase tracking-wider text-muted-foreground/40"
              style={{ fontSize: scaled(9) }}
            >
              People out
            </span>
          </div>
          <div
            className={cn(
              'flex shrink-0 items-center justify-center border-r border-border px-2',
              stickyDaysHeader,
            )}
            style={{ width: daysColW, left: personColW, height: isWeek ? undefined : rowH }}
          />
          {days.map((day, dayIdx) => {
            const isNonWorking = day.isWeekend || day.isHoliday;
            const count = isNonWorking
              ? 0
              : filtered.filter((u) => getBookingsForUserOnDate(u, day.dateStr).length > 0).length;
            return (
              <div
                key={day.dateStr}
                className={cn(
                  'flex items-center justify-center',
                  isWeek ? 'min-w-0 flex-1' : 'min-w-0 flex-1',
                  isWeek && dayIdx < days.length - 1 && 'border-r border-border/30',
                  day.isWeekend && 'bg-muted/15',
                  day.isHoliday && !day.isWeekend && 'bg-amber-500/5',
                  day.isToday && 'bg-primary/5',
                )}
                style={isWeek ? undefined : { minWidth: monthCellW, height: rowH }}
              >
                {count > 0 && (
                  <span
                    className={cn(
                      'font-brand font-bold tabular-nums',
                      count >= 3
                        ? 'text-destructive'
                        : count >= 2
                          ? 'text-amber-500'
                          : 'text-muted-foreground',
                    )}
                    style={{ fontSize: scaled(9) }}
                  >
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating tooltip — portaled to body to avoid overflow clipping */}
      {createPortal(
        <AnimatePresence>
          {hover && (
            <CellTooltip bookings={hover.bookings} position={hover.pos} holidays={holidays} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// ── Legend ───────────────────────────────────────────────────────

function Legend() {
  return (
    <div
      className="flex flex-wrap items-center gap-5 rounded-lg border border-border bg-muted/20 px-4 py-2"
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
          className="inline-block h-3 w-5 rounded-sm"
          style={{ backgroundColor: CATEGORY_COLORS.planned + '25' }}
        />
        Planned
        <span className="text-muted-foreground/40">(24h+)</span>
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className="inline-block h-3 w-5 rounded-sm"
          style={{ backgroundColor: CATEGORY_COLORS.adhoc + '25' }}
        />
        Ad hoc
        <span className="text-muted-foreground/40">(&lt;24h)</span>
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-muted-foreground/30 bg-muted/20" />
        Partial
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block h-3 w-5 rounded-sm bg-muted/30" />
        Weekend
      </span>
    </div>
  );
}

// ── My Leave List ───────────────────────────────────────────────

function MyLeaveList({
  leaveTypesMap,
  holidays,
}: {
  leaveTypesMap: Map<string, LeaveType>;
  holidays: Record<string, string>;
}) {
  const now = new Date();
  const { data: bookings, isLoading } = useMyLeave(now.getFullYear());
  const cancelLeave = useCancelLeave();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeBookings = bookings?.filter((b) => b.status !== 'cancelled') ?? [];

  if (activeBookings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 py-12 text-center">
        <Palmtree className="mx-auto h-8 w-8 text-muted-foreground/30" />
        <p className="mt-3 text-muted-foreground" style={{ fontSize: scaled(13) }}>
          No leave booked yet
        </p>
        <p className="mt-1 text-muted-foreground/60" style={{ fontSize: scaled(11) }}>
          Use the "Book time off" button to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeBookings.map((booking) => {
        const leaveType = leaveTypesMap.get(booking.leaveTypeId);
        if (!leaveType) return null;
        const isPartial = booking.hours !== null;
        const category = getBookingCategory(booking);
        const catColor = CATEGORY_COLORS[category];
        const isPast = booking.endDate < formatDateStr(now);

        return (
          <motion.div
            key={booking.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--t-surface))] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full" style={{ backgroundColor: catColor }} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
                    {leaveType.name}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 font-brand font-medium"
                    style={{
                      fontSize: scaled(9),
                      backgroundColor: catColor + '15',
                      color: catColor,
                    }}
                  >
                    {CATEGORY_LABELS[category]}
                  </span>
                  {isPartial && (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-brand font-medium"
                      style={{
                        fontSize: scaled(9),
                        backgroundColor: catColor + '15',
                        color: catColor,
                      }}
                    >
                      {booking.startHour ? `${booking.startHour} · ` : ''}
                      {booking.hours}h
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  {booking.startDate === booking.endDate
                    ? new Date(booking.startDate + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : `${new Date(booking.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(booking.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  {!isPartial &&
                    (() => {
                      const d = getBookingWorkingDays(booking, holidays);
                      return ` · ${d} day${d !== 1 ? 's' : ''}`;
                    })()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-brand font-medium text-emerald-500"
                style={{ fontSize: scaled(9) }}
              >
                {booking.status === 'autoconfirmed'
                  ? 'Confirmed'
                  : booking.status === 'approved'
                    ? 'Approved'
                    : booking.status === 'pending'
                      ? 'Pending'
                      : booking.status}
              </span>
              {!isPast && (
                <button
                  onClick={() => cancelLeave.mutate(booking.id)}
                  disabled={cancelLeave.isPending}
                  className="rounded-md p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                  title="Cancel booking"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Book Time Off Dialog ────────────────────────────────────────

function BookTimeOffDialog({
  open,
  onClose,
  leaveTypes,
  employmentType,
  editBooking,
  prefillDates,
}: {
  open: boolean;
  onClose: () => void;
  leaveTypes: LeaveType[];
  employmentType: 'contractor' | 'employee';
  /** When set, dialog is in edit mode for this booking */
  editBooking?: LeaveBooking | null;
  /** Pre-fill start/end dates (from drag-select) */
  prefillDates?: { startDate: string; endDate: string } | null;
}) {
  const isContractor = employmentType === 'contractor';
  const contractorDefaultType = leaveTypes.find((lt) => lt.isContractorDefault);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [hours, setHours] = useState(0.5);
  const [startHourValue, setStartHourValue] = useState('');
  const [note, setNote] = useState('');
  const bookLeave = useBookLeave();
  const updateLeave = useUpdateLeave();
  const cancelLeave = useCancelLeave();
  const { data: workingHours } = useWorkingHours();

  const isEdit = !!editBooking;
  const mutation = isEdit ? updateLeave : bookLeave;

  // Derive schedule for the selected date
  const schedule = useMemo(() => {
    if (!startDate) return null;
    const wh = workingHours ?? DEFAULT_WEEKLY_WORKING_HOURS;
    const dayKey = getWeekdayKey(startDate);
    const daySched = wh[dayKey];
    if (!daySched || !daySched.enabled) return null;
    return daySched;
  }, [startDate, workingHours]);

  // Available start times (30-min steps within work hours, leaving at least 30min for duration)
  const startTimeOptions = useMemo(() => {
    if (!schedule) return [];
    const startMins = timeToMinutes(schedule.start);
    const endMins = timeToMinutes(schedule.end) - 30; // must leave room for at least 0.5h
    return generateTimeSlots(startMins, endMins + 1); // +1 so we include endMins itself
  }, [schedule]);

  // Available durations (based on selected start time → work end)
  const durationOptions = useMemo(() => {
    if (!schedule || !startHourValue) return [];
    const startMins = timeToMinutes(startHourValue);
    const endMins = timeToMinutes(schedule.end);
    const maxHours = Math.max(0, (endMins - startMins) / 60);
    return generateDurationOptions(maxHours);
  }, [schedule, startHourValue]);

  // Auto-select first start time when schedule changes and no value is set
  useEffect(() => {
    if (isPartial && startTimeOptions.length > 0 && !startHourValue) {
      setStartHourValue(startTimeOptions[0]!.value);
    }
  }, [isPartial, startTimeOptions, startHourValue]);

  // Clamp hours if selected duration exceeds available after start time changes
  useEffect(() => {
    if (durationOptions.length > 0) {
      const maxAvailable = Number(durationOptions[durationOptions.length - 1]!.value);
      if (hours > maxAvailable) {
        setHours(maxAvailable);
      }
      // If current hours is not in valid options, snap to first
      const valid = durationOptions.some((o) => Number(o.value) === hours);
      if (!valid) {
        setHours(Number(durationOptions[0]!.value));
      }
    }
  }, [durationOptions, hours]);

  // Pre-fill form when dialog opens with editBooking or prefillDates
  useEffect(() => {
    if (!open) return;
    const defaultTypeId = isContractor && contractorDefaultType ? contractorDefaultType.id : '';
    if (editBooking) {
      setLeaveTypeId(editBooking.leaveTypeId);
      setStartDate(editBooking.startDate);
      setEndDate(editBooking.endDate);
      setIsPartial(editBooking.hours !== null && editBooking.hours !== undefined);
      setHours(editBooking.hours ?? 0.5);
      setStartHourValue(editBooking.startHour ?? '');
      setNote(editBooking.note ?? '');
    } else if (prefillDates) {
      setLeaveTypeId(defaultTypeId);
      setStartDate(prefillDates.startDate);
      setEndDate(prefillDates.endDate);
      setIsPartial(false);
      setHours(0.5);
      setStartHourValue('');
      setNote('');
    } else {
      setLeaveTypeId(defaultTypeId);
      setStartDate('');
      setEndDate('');
      setIsPartial(false);
      setHours(0.5);
      setStartHourValue('');
      setNote('');
    }
  }, [open, editBooking, prefillDates, isContractor, contractorDefaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveTypeId || !startDate) return;

    try {
      if (isEdit) {
        await updateLeave.mutateAsync({
          id: editBooking.id,
          leaveTypeId,
          startDate,
          endDate: isPartial ? startDate : endDate || startDate,
          hours: isPartial ? hours : undefined,
          startHour: isPartial ? startHourValue : undefined,
          note: note.trim() || undefined,
        });
      } else {
        await bookLeave.mutateAsync({
          leaveTypeId,
          startDate,
          endDate: isPartial ? startDate : endDate || startDate,
          ...(isPartial ? { hours, startHour: startHourValue } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      }
      onClose();
    } catch {
      // Error is displayed via mutation.error
    }
  };

  const handleDelete = async () => {
    if (!editBooking) return;
    try {
      await cancelLeave.mutateAsync(editBooking.id);
      onClose();
    } catch {
      // Error displayed via mutation.error
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="mx-4 w-full max-w-md rounded-xl border border-border bg-popover p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(16) }}>
            {isEdit ? 'Edit booking' : 'Book time off'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Leave type — hidden for contractors (auto-assigned) */}
          {!isContractor && (
            <div>
              <label
                className="mb-1 block font-brand text-muted-foreground"
                style={{ fontSize: scaled(11) }}
              >
                Leave type
              </label>
              <SelectPopover
                value={leaveTypeId}
                onChange={setLeaveTypeId}
                items={leaveTypes.map((lt) => ({ value: lt.id, label: lt.name }))}
                placeholder="Select..."
                searchable={leaveTypes.length > 8}
                searchPlaceholder="Search leave types..."
                fullWidth
              />
            </div>
          )}

          {/* Partial toggle */}
          <label
            className="flex items-center gap-2 text-muted-foreground"
            style={{ fontSize: scaled(11) }}
          >
            <input
              type="checkbox"
              checked={isPartial}
              onChange={(e) => {
                setIsPartial(e.target.checked);
                if (e.target.checked) {
                  setEndDate(startDate);
                  if (!startHourValue && startTimeOptions.length > 0) {
                    setStartHourValue(startTimeOptions[0]!.value);
                  }
                }
              }}
              className="rounded"
            />
            <span className="font-brand">Partial day</span>
          </label>

          {/* Date(s) */}
          {isPartial ? (
            <div>
              <label
                className="mb-1 block font-brand text-muted-foreground"
                style={{ fontSize: scaled(11) }}
              >
                Date
              </label>
              <DatePicker
                value={startDate}
                onChange={(v) => {
                  setStartDate(v);
                  setEndDate(v);
                }}
                placeholder="Pick a date"
              />
            </div>
          ) : (
            <div>
              <label
                className="mb-1 block font-brand text-muted-foreground"
                style={{ fontSize: scaled(11) }}
              >
                Date range
              </label>
              <DateRangePicker
                from={startDate || new Date().toISOString().slice(0, 10)}
                to={endDate || new Date().toISOString().slice(0, 10)}
                onChange={(from, to) => {
                  setStartDate(from);
                  setEndDate(to);
                }}
              />
            </div>
          )}

          {/* Start time + Duration for partial */}
          {isPartial && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1 block font-brand text-muted-foreground"
                  style={{ fontSize: scaled(11) }}
                >
                  Start time
                </label>
                <SelectPopover
                  value={startHourValue}
                  onChange={(v) => setStartHourValue(v)}
                  items={startTimeOptions}
                  placeholder="Select..."
                  fullWidth
                />
              </div>
              <div>
                <label
                  className="mb-1 block font-brand text-muted-foreground"
                  style={{ fontSize: scaled(11) }}
                >
                  Duration
                </label>
                <SelectPopover
                  value={String(hours)}
                  onChange={(v) => setHours(Number(v))}
                  items={durationOptions}
                  placeholder="Select..."
                  fullWidth
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label
              className="mb-1 block font-brand text-muted-foreground"
              style={{ fontSize: scaled(11) }}
            >
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for leave..."
              className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
              style={{ fontSize: scaled(12) }}
            />
          </div>

          {/* Error */}
          {(mutation.error || cancelLeave.error) && (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
              style={{ fontSize: scaled(11) }}
            >
              {(mutation.error ?? cancelLeave.error) instanceof Error
                ? (mutation.error ?? cancelLeave.error)?.message
                : 'Failed to save'}
            </div>
          )}

          {/* Actions */}
          <div className={cn('flex gap-3', isEdit ? 'flex-row' : 'flex-col')}>
            <button
              type="submit"
              disabled={mutation.isPending || cancelLeave.isPending || !leaveTypeId || !startDate}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-brand font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50',
                isEdit ? 'flex-1' : 'w-full',
              )}
              style={{ fontSize: scaled(13) }}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mutation.isPending
                ? isEdit
                  ? 'Saving...'
                  : 'Booking...'
                : isEdit
                  ? 'Save changes'
                  : 'Confirm booking'}
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={mutation.isPending || cancelLeave.isPending}
                className="flex items-center justify-center gap-2 rounded-lg border border-destructive/30 px-4 py-2.5 font-brand font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                style={{ fontSize: scaled(13) }}
              >
                {cancelLeave.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {cancelLeave.isPending ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export function LeavePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(now));
  const [activeTab, setActiveTab] = useState<'wallchart' | 'my-leave'>('wallchart');
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<LeaveBooking | null>(null);
  const [prefillDates, setPrefillDates] = useState<{ startDate: string; endDate: string } | null>(
    null,
  );
  const { effectiveUserId } = useImpersonation();

  // Compute date range based on view mode
  const { from, to } = useMemo(() => {
    if (viewMode === 'week') {
      const sunday = new Date(weekStart);
      sunday.setDate(weekStart.getDate() + 6);
      return { from: formatDateStr(weekStart), to: formatDateStr(sunday) };
    }
    const daysInMonth = getDaysInMonth(year, month);
    return {
      from: formatDateStr(new Date(year, month, 1)),
      to: formatDateStr(new Date(year, month, daysInMonth)),
    };
  }, [viewMode, year, month, weekStart]);

  // Data fetching
  const { data: leaveTypesResponse } = useLeaveTypes();
  const leaveTypesData = leaveTypesResponse?.types;
  const employmentType = leaveTypesResponse?.employmentType;
  const { data: holidays } = useHolidays(viewMode === 'week' ? weekStart.getFullYear() : year);
  const { data: wallchartData, isLoading: wallchartLoading } = useWallchart(from, to);

  // Build days array based on view mode
  const days = useMemo(() => {
    const h = holidays ?? {};
    if (viewMode === 'week') {
      return getWeekDays(weekStart, h);
    }
    return getMonthDays(year, month, h);
  }, [viewMode, year, month, weekStart, holidays]);

  // Build leave types map
  const leaveTypesMap = useMemo(() => {
    const map = new Map<string, LeaveType>();
    if (wallchartData?.leaveTypes) {
      for (const lt of wallchartData.leaveTypes) {
        map.set(lt.id, lt);
      }
    } else if (leaveTypesData) {
      for (const lt of leaveTypesData) {
        map.set(lt.id, lt);
      }
    }
    return map;
  }, [wallchartData?.leaveTypes, leaveTypesData]);

  // Distinct teams for filter dropdown
  const teamFilterItems = useMemo(() => {
    if (!wallchartData?.users) return [];
    const seen = new Map<string, { name: string; color: string | null }>();
    for (const u of wallchartData.users) {
      if (u.teamId && u.teamName && !seen.has(u.teamId)) {
        seen.set(u.teamId, {
          name: u.teamName,
          color: u.teamColor,
        });
      }
    }
    return [
      { value: '', label: 'All Teams' },
      ...Array.from(seen.entries())
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([id, t]) => ({
          value: id,
          label: t.name,
          color: t.color ?? undefined,
        })),
    ];
  }, [wallchartData?.users]);

  // Navigation
  const prevPeriod = useCallback(() => {
    if (viewMode === 'week') {
      setWeekStart((ws) => {
        const prev = new Date(ws);
        prev.setDate(ws.getDate() - 7);
        return prev;
      });
    } else {
      setMonth((m) => {
        if (m === 0) {
          setYear((y) => y - 1);
          return 11;
        }
        return m - 1;
      });
    }
  }, [viewMode]);

  const nextPeriod = useCallback(() => {
    if (viewMode === 'week') {
      setWeekStart((ws) => {
        const next = new Date(ws);
        next.setDate(ws.getDate() + 7);
        return next;
      });
    } else {
      setMonth((m) => {
        if (m === 11) {
          setYear((y) => y + 1);
          return 0;
        }
        return m + 1;
      });
    }
  }, [viewMode]);

  const goToday = useCallback(() => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setWeekStart(getMonday(today));
  }, []);

  // Navigator label
  const navLabel = useMemo(() => {
    if (viewMode === 'week') {
      const sunday = new Date(weekStart);
      sunday.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = sunday.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${startStr} – ${endStr}`;
    }
    return new Date(year, month).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [viewMode, year, month, weekStart]);

  // Keyboard left/right arrow navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevPeriod();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextPeriod();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [prevPeriod, nextPeriod]);

  const TABS = [
    { id: 'wallchart' as const, label: 'Wallchart' },
    { id: 'my-leave' as const, label: 'My Leave' },
  ];

  return (
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
        <Button
          variant="subtle"
          size="compact"
          onClick={() => {
            setEditBooking(null);
            setPrefillDates(null);
            setBookDialogOpen(true);
          }}
          style={{ fontSize: scaled(11) }}
        >
          <Plus />
          Book time off
        </Button>
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

      {/* Wallchart Tab */}
      {activeTab === 'wallchart' && (
        <div>
          {/* Controls row */}
          <div className="mb-4 flex items-center gap-3">
            {/* Period navigation */}
            <MonthNavigator
              onPrev={prevPeriod}
              onNext={nextPeriod}
              onToday={goToday}
              label={navLabel}
            />
            {/* View mode toggle */}
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                onClick={() => setViewMode('week')}
                className={cn(
                  'flex items-center gap-1 border-r border-border px-2.5 py-1.5 font-brand text-muted-foreground transition-colors',
                  viewMode === 'week'
                    ? 'bg-primary/[0.08] font-semibold text-foreground'
                    : 'hover:bg-muted/30',
                )}
                style={{ fontSize: scaled(11) }}
                title="Week view"
              >
                <Calendar className="h-3 w-3" />
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 font-brand text-muted-foreground transition-colors',
                  viewMode === 'month'
                    ? 'bg-primary/[0.08] font-semibold text-foreground'
                    : 'hover:bg-muted/30',
                )}
                style={{ fontSize: scaled(11) }}
                title="Month view"
              >
                <CalendarDays className="h-3 w-3" />
                Month
              </button>
            </div>
            {/* Team filter */}
            {teamFilterItems.length > 1 && (
              <SelectPopover
                value={teamFilter}
                onChange={setTeamFilter}
                items={teamFilterItems}
                placeholder="All Teams"
                searchable={teamFilterItems.length > 8}
                searchPlaceholder="Search teams..."
                compact
                width={200}
              />
            )}
            {/* Search */}
            <div className="flex max-w-[280px] flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-[7px]">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people..."
                className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                style={{ fontSize: scaled(12), border: 'none' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {wallchartLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : wallchartData ? (
            <>
              <WallchartGrid
                currentUserId={effectiveUserId}
                days={days}
                holidays={holidays ?? {}}
                onEditBooking={(booking) => {
                  setEditBooking(booking);
                  setPrefillDates(null);
                  setBookDialogOpen(true);
                }}
                onSelectRange={(startDate, endDate) => {
                  setEditBooking(null);
                  setPrefillDates({ startDate, endDate });
                  setBookDialogOpen(true);
                }}
                rangeFrom={from}
                rangeTo={to}
                search={search}
                teamFilter={teamFilter}
                users={wallchartData.users}
                viewMode={viewMode}
              />
              <div className="mt-3">
                <Legend />
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* My Leave Tab */}
      {activeTab === 'my-leave' && (
        <MyLeaveList leaveTypesMap={leaveTypesMap} holidays={holidays ?? {}} />
      )}

      {/* Book Time Off Dialog */}
      <AnimatePresence>
        {bookDialogOpen && (
          <BookTimeOffDialog
            open={bookDialogOpen}
            onClose={() => {
              setBookDialogOpen(false);
              setEditBooking(null);
              setPrefillDates(null);
            }}
            leaveTypes={leaveTypesData ?? []}
            employmentType={employmentType ?? 'contractor'}
            editBooking={editBooking}
            prefillDates={prefillDates}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
