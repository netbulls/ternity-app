import { useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { StatsRow } from '@/components/stats/stats-row';
import { TimerBar } from '@/components/timer/timer-bar';
import { DateNavBar, type DateView } from '@/components/timer/date-nav-bar';
import { DayGroup } from '@/components/entries/day-group';
import { ActiveEditProvider } from '@/components/entries/active-edit-context';
import { DraftEntryProvider } from '@/components/entries/draft-entry-context';
import { ManualEntryDialog } from '@/components/entries/manual-entry-dialog';
import { useEntries } from '@/hooks/use-entries';
import { getWeekStart, getWeekEnd, shiftDays } from '@/lib/format';
import { Button } from '@/components/ui/button';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function TimerPage() {
  const [manualOpen, setManualOpen] = useState(false);
  const [view, setView] = useState<DateView>('week');
  const [anchor, setAnchor] = useState(todayStr);

  // Compute from/to based on view + anchor
  const { from, to } = useMemo(() => {
    if (view === 'day') {
      return { from: anchor, to: anchor };
    }
    return { from: getWeekStart(anchor), to: getWeekEnd(anchor) };
  }, [view, anchor]);

  const handlePrev = useCallback(() => {
    setAnchor((a) => shiftDays(a, view === 'day' ? -1 : -7));
  }, [view]);

  const handleNext = useCallback(() => {
    setAnchor((a) => shiftDays(a, view === 'day' ? 1 : 7));
  }, [view]);

  const handleToday = useCallback(() => {
    setAnchor(todayStr());
  }, []);

  const handleViewChange = useCallback((v: DateView) => {
    setView(v);
    // Reset anchor to today when switching views
    setAnchor(todayStr());
  }, []);

  const { data: dayGroups, isLoading } = useEntries(from, to);

  // Total seconds across all groups
  const totalSeconds = useMemo(
    () => (dayGroups ?? []).reduce((sum, g) => sum + g.totalSeconds, 0),
    [dayGroups],
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
          Timer &amp; Entries
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setManualOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Manual Entry
          </Button>
        </div>
      </div>

      <StatsRow />
      <TimerBar />

      <DateNavBar
        view={view}
        onViewChange={handleViewChange}
        from={from}
        to={to}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        totalSeconds={totalSeconds}
      />

      {/* Entries grouped by day */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Loading entries...
        </div>
      ) : dayGroups && dayGroups.length > 0 ? (
        <ActiveEditProvider>
          <DraftEntryProvider>
            <div>
              {dayGroups.map((group) => (
                <DayGroup key={group.date} group={group} />
              ))}
            </div>
          </DraftEntryProvider>
        </ActiveEditProvider>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="px-3.5 py-10 text-center text-sm text-muted-foreground">
            No entries for this period. Start the timer to begin tracking.
          </div>
        </div>
      )}

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} />
    </div>
  );
}
