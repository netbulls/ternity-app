import { useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatDuration, getWeekStart, shiftDays } from '@/lib/format';
import { calcTodaySeconds } from '@/components/timer/day-timeline';
import type { DayGroup } from '@ternity/shared';

interface WeekDay {
  date: string; // YYYY-MM-DD
  dayName: string; // Mon, Tue, ...
  dateNum: string; // 1, 2, ...
  totalSeconds: number;
  isToday: boolean;
  isOff: boolean; // weekend
}

interface WeekStripProps {
  /** Currently selected date (YYYY-MM-DD) */
  selectedDate: string;
  /** Week entries — array of DayGroups for the visible week */
  weekGroups: DayGroup[];
  /** Loading state for the week data */
  isLoading?: boolean;
  /** Daily target in seconds (default 8h = 28800) */
  dailyTarget?: number;
  onSelectDate: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function buildWeekDays(selectedDate: string, weekGroups: DayGroup[]): WeekDay[] {
  const monday = getWeekStart(selectedDate);
  const today = getToday();

  // Build a lookup of entries by date, and compute day-clamped seconds
  // (entry.totalDurationSeconds may include time from other days for cross-midnight entries)
  const clampedSecondsByDate = new Map<string, number>();
  for (const g of weekGroups) {
    clampedSecondsByDate.set(g.date, calcTodaySeconds(g.entries, g.date));
  }

  const days: WeekDay[] = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const date = shiftDays(monday, i);
    const d = new Date(date + 'T12:00:00');
    const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
    days.push({
      date,
      dayName: dayNames[i]!,
      dateNum: String(d.getDate()),
      totalSeconds: clampedSecondsByDate.get(date) ?? 0,
      isToday: date === today,
      isOff: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }

  return days;
}

export function WeekStrip({
  selectedDate,
  weekGroups,
  isLoading,
  dailyTarget = 28800,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onToday,
}: WeekStripProps) {
  const today = getToday();
  const isOnToday = selectedDate === today;

  const days = useMemo(() => buildWeekDays(selectedDate, weekGroups), [selectedDate, weekGroups]);

  // Week total
  const weekTotal = useMemo(() => days.reduce((sum, d) => sum + d.totalSeconds, 0), [days]);

  // Week range label
  const rangeLabel = useMemo(() => {
    const mon = days[0]!;
    const sun = days[6]!;
    const monDate = new Date(mon.date + 'T12:00:00');
    const sunDate = new Date(sun.date + 'T12:00:00');
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(monDate)} – ${fmt(sunDate)}`;
  }, [days]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Let parent handle global keyboard — this is just for button accessibility
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
    }
  }, []);

  return (
    <div
      className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))]"
      style={{ padding: `${scaled(10)} ${scaled(14)} ${scaled(14)}` }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: scaled(10), minHeight: scaled(24) }}
      >
        <span
          className="font-brand font-semibold uppercase text-muted-foreground"
          style={{ fontSize: scaled(10), letterSpacing: '2px' }}
        >
          Week Overview
        </span>

        <div className="flex items-center gap-2">
          {/* Prev week */}
          <button
            onClick={onPrevWeek}
            aria-label="Previous week"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft style={{ width: scaled(14), height: scaled(14) }} />
          </button>

          {/* Range label */}
          <span
            className="font-brand tabular-nums text-muted-foreground"
            style={{ fontSize: scaled(11) }}
          >
            {rangeLabel}
          </span>

          {/* Next week */}
          <button
            onClick={onNextWeek}
            aria-label="Next week"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronRight style={{ width: scaled(14), height: scaled(14) }} />
          </button>

          {/* Today badge */}
          <button
            onClick={onToday}
            disabled={isOnToday}
            className={cn(
              'rounded-md px-2.5 py-1 font-brand font-semibold uppercase tracking-wider transition-colors',
              isOnToday
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
              isOnToday && 'opacity-50 cursor-default',
            )}
            style={{ fontSize: scaled(11) }}
          >
            Today
          </button>

          {/* Week total */}
          <span
            className="font-brand font-bold tabular-nums text-primary"
            style={{ fontSize: scaled(12) }}
          >
            {formatDuration(weekTotal)}
          </span>
        </div>
      </div>

      {/* Day chips */}
      <div className="grid grid-cols-7" style={{ gap: scaled(5) }}>
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const pct =
            day.isOff || dailyTarget === 0
              ? 0
              : Math.min(100, Math.round((day.totalSeconds / dailyTarget) * 100));

          return (
            <button
              key={day.date}
              onClick={() => onSelectDate(day.date)}
              onKeyDown={handleKeyDown}
              className={cn(
                'relative rounded-lg border px-1.5 text-center transition-all',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-muted hover:border-primary/50',
                day.isOff && !isSelected && 'opacity-45',
              )}
              style={{ paddingTop: scaled(8), paddingBottom: scaled(10) }}
            >
              {/* Day name */}
              <span className="block font-brand font-semibold" style={{ fontSize: scaled(10) }}>
                {day.dayName}
              </span>

              {/* Date number */}
              <span
                className="block text-muted-foreground"
                style={{ fontSize: scaled(9), marginTop: '1px' }}
              >
                {day.dateNum}
              </span>

              {/* Hours */}
              <span
                className={cn(
                  'block font-brand font-bold tabular-nums',
                  day.totalSeconds > 0 ? 'text-primary' : 'text-muted-foreground',
                )}
                style={{ fontSize: scaled(11), marginTop: scaled(5) }}
              >
                {isLoading ? '...' : formatDuration(day.totalSeconds)}
              </span>

              {/* Progress bar */}
              <div
                className="mx-auto overflow-hidden rounded-full bg-border"
                style={{ height: '3px', marginTop: scaled(5) }}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Today dot */}
              {day.isToday && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary"
                  style={{ width: '4px', height: '4px' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
