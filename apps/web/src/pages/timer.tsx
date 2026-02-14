import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { StatsRow } from '@/components/stats/stats-row';
import { TimerBar } from '@/components/timer/timer-bar';
import { DayGroup } from '@/components/entries/day-group';
import { ManualEntryDialog } from '@/components/entries/manual-entry-dialog';
import { useEntries } from '@/hooks/use-entries';
import { Button } from '@/components/ui/button';

export function TimerPage() {
  const [manualOpen, setManualOpen] = useState(false);

  // Date range: last 7 days
  const { from, to } = useMemo(() => {
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 6);
    return {
      from: fromDate.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  }, []);

  const { data: dayGroups, isLoading } = useEntries(from, to);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">Today</h1>
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

      {/* Entries grouped by day */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Loading entries...
        </div>
      ) : dayGroups && dayGroups.length > 0 ? (
        <div>
          {dayGroups.map((group) => (
            <DayGroup key={group.date} group={group} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="px-3.5 py-10 text-center text-sm text-muted-foreground">
            No entries this week. Start the timer to begin tracking.
          </div>
        </div>
      )}

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} />
    </div>
  );
}
