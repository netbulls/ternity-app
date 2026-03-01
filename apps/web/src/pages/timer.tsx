import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { TimerBar } from '@/components/timer/timer-bar';
import { DayTimeline, calcTodaySeconds } from '@/components/timer/day-timeline';
import { WeekStrip } from '@/components/timer/week-strip';
import { DayGroup } from '@/components/entries/day-group';
import { ActiveEditProvider } from '@/components/entries/active-edit-context';
import { DraftEntryProvider } from '@/components/entries/draft-entry-context';
import { ManualEntryDialog } from '@/components/entries/manual-entry-dialog';
import { useEntries } from '@/hooks/use-entries';
import { Button } from '@/components/ui/button';
import { scaled } from '@/lib/scaled';
import { getWeekStart, getWeekEnd, shiftDays } from '@/lib/format';
import type { DayGroup as DayGroupType } from '@ternity/shared';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatLongDate(dateStr: string): string {
  const today = getToday();
  const yesterday = shiftDays(today, -1);
  const tomorrow = shiftDays(today, 1);

  const d = new Date(dateStr + 'T00:00:00');
  const formatted = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (dateStr === today) return `${formatted} — Today`;
  if (dateStr === yesterday) return `${formatted} — Yesterday`;
  if (dateStr === tomorrow) return `${formatted} — Tomorrow`;
  return formatted;
}

export function TimerPage() {
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getToday);

  const today = getToday();
  const isToday = selectedDate === today;

  // ── Week data (for the strip) ──
  const weekFrom = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekTo = useMemo(() => getWeekEnd(selectedDate), [selectedDate]);
  const { data: weekGroups, isLoading: weekLoading } = useEntries(weekFrom, weekTo);

  // ── Selected day data (from the week fetch) ──
  const selectedGroup: DayGroupType | null = useMemo(() => {
    if (!weekGroups || weekGroups.length === 0) return null;
    return weekGroups.find((g) => g.date === selectedDate) ?? null;
  }, [weekGroups, selectedDate]);

  const dayEntries = selectedGroup?.entries ?? [];

  // Calculate day-only seconds (segments clamped to day boundaries)
  const daySeconds = useMemo(
    () => calcTodaySeconds(dayEntries, selectedDate),
    [dayEntries, selectedDate],
  );

  // Build corrected group with day-only total
  const correctedGroup = useMemo<DayGroupType | null>(() => {
    if (!selectedGroup) return null;
    return { ...selectedGroup, totalSeconds: daySeconds };
  }, [selectedGroup, daySeconds]);

  // ── Week navigation ──
  const goToPrevWeek = useCallback(() => {
    setSelectedDate((d) => shiftDays(getWeekStart(d), -7));
  }, []);

  const goToNextWeek = useCallback(() => {
    setSelectedDate((d) => shiftDays(getWeekStart(d), 7));
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(getToday());
  }, []);

  // ── Keyboard navigation ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedDate((d) => shiftDays(d, -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedDate((d) => shiftDays(d, 1));
      } else if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSelectedDate(getToday());
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1
            className="font-brand font-semibold tracking-wide text-foreground"
            style={{ fontSize: scaled(18) }}
          >
            My Day
          </h1>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
            {formatLongDate(selectedDate)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setManualOpen(true)}
          style={{ fontSize: scaled(12) }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Manual Entry
        </Button>
      </div>

      {/* Week Strip */}
      <div className="mb-5">
        <WeekStrip
          selectedDate={selectedDate}
          weekGroups={weekGroups ?? []}
          isLoading={weekLoading}
          onSelectDate={setSelectedDate}
          onPrevWeek={goToPrevWeek}
          onNextWeek={goToNextWeek}
          onToday={goToToday}
        />
      </div>

      {/* Day Timeline */}
      <div className="mb-5">
        <DayTimeline date={selectedDate} entries={dayEntries} />
      </div>

      {/* Timer Bar — only show on today */}
      {isToday && <TimerBar />}

      {/* Day entries */}
      {weekLoading ? (
        <div className="py-10 text-center text-muted-foreground" style={{ fontSize: scaled(14) }}>
          Loading entries...
        </div>
      ) : correctedGroup ? (
        <ActiveEditProvider>
          <DraftEntryProvider>
            <DayGroup group={correctedGroup} />
          </DraftEntryProvider>
        </ActiveEditProvider>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div
            className="px-3.5 py-10 text-center text-muted-foreground"
            style={{ fontSize: scaled(14) }}
          >
            {isToday
              ? 'No entries yet today. Start the timer to begin tracking.'
              : 'No entries for this day.'}
          </div>
        </div>
      )}

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} />
    </div>
  );
}
