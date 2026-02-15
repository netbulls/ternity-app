import { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEntries } from '@/hooks/use-entries';
import { useImpersonation } from '@/providers/impersonation-provider';
import { DayGroup } from '@/components/entries/day-group';
import { ManualEntryDialog } from '@/components/entries/manual-entry-dialog';
import { Button } from '@/components/ui/button';
import { ProjectSelector } from '@/components/timer/project-selector';
import { LabelSelector } from '@/components/timer/label-selector';
import {
  formatDuration,
  formatDateRange,
  getWeekStart,
  getWeekEnd,
  shiftDays,
} from '@/lib/format';
import type { DayGroup as DayGroupType } from '@ternity/shared';

type ViewMode = 'day' | 'week';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function EntriesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorDate, setAnchorDate] = useState(getToday);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([]);
  const [manualOpen, setManualOpen] = useState(false);

  const { targetDisplayName } = useImpersonation();

  // Compute date range from view mode + anchor
  const { from, to } = useMemo(() => {
    if (viewMode === 'day') {
      return { from: anchorDate, to: anchorDate };
    }
    return { from: getWeekStart(anchorDate), to: getWeekEnd(anchorDate) };
  }, [viewMode, anchorDate]);

  const { data: dayGroups, isLoading } = useEntries(from, to);

  // Client-side filtering by project and label
  const filteredGroups = useMemo(() => {
    if (!dayGroups) return [];
    if (!filterProjectId && filterLabelIds.length === 0) return dayGroups;

    const result: DayGroupType[] = [];
    for (const group of dayGroups) {
      const filtered = group.entries.filter((entry) => {
        if (filterProjectId && entry.projectId !== filterProjectId) return false;
        if (
          filterLabelIds.length > 0 &&
          !filterLabelIds.some((lid) => entry.labels.some((l) => l.id === lid))
        )
          return false;
        return true;
      });
      if (filtered.length > 0) {
        const totalSeconds = filtered.reduce(
          (sum, e) => sum + (e.durationSeconds ?? 0),
          0,
        );
        result.push({ date: group.date, totalSeconds, entries: filtered });
      }
    }
    return result;
  }, [dayGroups, filterProjectId, filterLabelIds]);

  // Grand total for the period
  const periodTotal = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.totalSeconds, 0),
    [filteredGroups],
  );

  // Navigation
  const goBack = useCallback(() => {
    const days = viewMode === 'day' ? -1 : -7;
    setAnchorDate((d) => shiftDays(d, days));
  }, [viewMode]);

  const goForward = useCallback(() => {
    const days = viewMode === 'day' ? 1 : 7;
    setAnchorDate((d) => shiftDays(d, days));
  }, [viewMode]);

  const goToday = useCallback(() => {
    setAnchorDate(getToday());
  }, []);

  const isCurrentPeriod =
    viewMode === 'day'
      ? anchorDate === getToday()
      : getWeekStart(anchorDate) === getWeekStart(getToday());

  const hasFilters = filterProjectId !== null || filterLabelIds.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
            Entries
          </h1>
          {targetDisplayName && (
            <p className="text-xs text-primary">
              Viewing as {targetDisplayName}
            </p>
          )}
        </div>
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

      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex rounded-lg border border-border">
          <button
            className={cn(
              'px-3 py-1.5 text-xs transition-colors',
              viewMode === 'day'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setViewMode('day')}
          >
            Day
          </button>
          <button
            className={cn(
              'px-3 py-1.5 text-xs transition-colors',
              viewMode === 'week'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            onClick={goToday}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
              isCurrentPeriod
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-accent',
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatDateRange(from, to)}
          </button>

          <button
            onClick={goForward}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <ProjectSelector
            value={filterProjectId}
            onChange={(id) => setFilterProjectId(id)}
          />
          <LabelSelector
            value={filterLabelIds}
            onChange={setFilterLabelIds}
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setFilterProjectId(null);
              setFilterLabelIds([]);
            }}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}

        {/* Period total */}
        <div className="ml-auto">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-2">
            Total
          </span>
          <span className="font-brand text-sm font-semibold text-foreground tabular-nums">
            {formatDuration(periodTotal)}
          </span>
        </div>
      </div>

      {/* Entries list */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Loading entries...
        </div>
      ) : filteredGroups.length > 0 ? (
        <div>
          {filteredGroups.map((group) => (
            <DayGroup key={group.date} group={group} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="px-3.5 py-10 text-center text-sm text-muted-foreground">
            {hasFilters
              ? 'No entries match the current filters.'
              : 'No entries for this period.'}
          </div>
        </div>
      )}

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} />
    </div>
  );
}
