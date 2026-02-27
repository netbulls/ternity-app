import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { TimerBar } from '@/components/timer/timer-bar';
import { DayTimeline, calcTodaySeconds } from '@/components/timer/day-timeline';
import { DayGroup } from '@/components/entries/day-group';
import { ActiveEditProvider } from '@/components/entries/active-edit-context';
import { DraftEntryProvider } from '@/components/entries/draft-entry-context';
import { ManualEntryDialog } from '@/components/entries/manual-entry-dialog';
import { useEntries } from '@/hooks/use-entries';
import { Button } from '@/components/ui/button';
import { scaled } from '@/lib/scaled';
import type { DayGroup as DayGroupType } from '@ternity/shared';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TimerPage() {
  const [manualOpen, setManualOpen] = useState(false);
  const today = todayStr();

  // Fetch only today's entries
  const { data: dayGroups, isLoading } = useEntries(today, today);

  // Get today's group (should be at most 1 since from === to === today)
  const todayGroup: DayGroupType | null = useMemo(() => {
    if (!dayGroups || dayGroups.length === 0) return null;
    return dayGroups[0] ?? null;
  }, [dayGroups]);

  // All entries for today (for the timeline)
  const todayEntries = todayGroup?.entries ?? [];

  // Calculate today-only seconds (segments clamped to today's boundaries)
  const todaySeconds = useMemo(() => calcTodaySeconds(todayEntries, today), [todayEntries, today]);

  // Build a corrected day group with today-only total for the DayGroup header
  const correctedGroup = useMemo<DayGroupType | null>(() => {
    if (!todayGroup) return null;
    return { ...todayGroup, totalSeconds: todaySeconds };
  }, [todayGroup, todaySeconds]);

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
            {formatLongDate(today)}
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setManualOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Manual Entry
        </Button>
      </div>

      {/* Day Timeline */}
      <div className="mb-5">
        <DayTimeline date={today} entries={todayEntries} />
      </div>

      {/* Timer Bar */}
      <TimerBar />

      {/* Today's entries */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading entries...</div>
      ) : correctedGroup ? (
        <ActiveEditProvider>
          <DraftEntryProvider>
            <DayGroup group={correctedGroup} />
          </DraftEntryProvider>
        </ActiveEditProvider>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="px-3.5 py-10 text-center text-sm text-muted-foreground">
            No entries yet today. Start the timer to begin tracking.
          </div>
        </div>
      )}

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} />
    </div>
  );
}
