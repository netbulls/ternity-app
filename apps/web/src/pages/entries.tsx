import { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useEntries } from '@/hooks/use-entries';
import { useImpersonation } from '@/providers/impersonation-provider';
import { DayGroup } from '@/components/entries/day-group';
import { ActiveEditProvider } from '@/components/entries/active-edit-context';
import { DraftEntryProvider } from '@/components/entries/draft-entry-context';
import { ManualEntryDialog } from '@/components/entries/manual-entry-dialog';
import { Button } from '@/components/ui/button';
import { ProjectSelector } from '@/components/timer/project-selector';
import { TagSelector } from '@/components/timer/tag-selector';
import {
  formatDuration,
  formatDateRange,
  getWeekStart,
  getWeekEnd,
  getMonthStart,
  getMonthEnd,
  shiftDays,
  shiftMonths,
} from '@/lib/format';
import { usePreferences } from '@/providers/preferences-provider';
import { scaled } from '@/lib/scaled';
import { useSearchParams } from 'react-router-dom';
import type { DayGroup as DayGroupType } from '@ternity/shared';

type ViewMode = 'day' | 'week' | 'month';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function EntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorDate, setAnchorDate] = useState(getToday);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [onlyIncomplete, setOnlyIncomplete] = useState(
    () => searchParams.get('filter') === 'incomplete',
  );
  const [showDeleted, setShowDeleted] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  // Clear the URL param after reading it so it doesn't stick around
  useEffect(() => {
    if (searchParams.has('filter')) {
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { tagsEnabled } = usePreferences();
  const { targetDisplayName } = useImpersonation();

  // Compute date range from view mode + anchor
  const { from, to } = useMemo(() => {
    if (viewMode === 'day') {
      return { from: anchorDate, to: anchorDate };
    }
    if (viewMode === 'month') {
      return { from: getMonthStart(anchorDate), to: getMonthEnd(anchorDate) };
    }
    return { from: getWeekStart(anchorDate), to: getWeekEnd(anchorDate) };
  }, [viewMode, anchorDate]);

  const { data: dayGroups, isLoading } = useEntries(from, to, showDeleted);

  // Client-side filtering by project, label, and incomplete
  const filteredGroups = useMemo(() => {
    if (!dayGroups) return [];
    if (!filterProjectId && filterTagIds.length === 0 && !onlyIncomplete) return dayGroups;

    const result: DayGroupType[] = [];
    for (const group of dayGroups) {
      const filtered = group.entries.filter((entry) => {
        if (onlyIncomplete && entry.projectId && entry.description) return false;
        if (filterProjectId && entry.projectId !== filterProjectId) return false;
        if (
          filterTagIds.length > 0 &&
          !filterTagIds.some((tid) => entry.tags.some((t) => t.id === tid))
        )
          return false;
        return true;
      });
      if (filtered.length > 0) {
        const totalSeconds = filtered.reduce((sum, e) => sum + e.totalDurationSeconds, 0);
        result.push({ date: group.date, totalSeconds, entries: filtered });
      }
    }
    return result;
  }, [dayGroups, filterProjectId, filterTagIds, onlyIncomplete]);

  // Grand total for the period
  const periodTotal = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.totalSeconds, 0),
    [filteredGroups],
  );

  // Navigation
  const goBack = useCallback(() => {
    if (viewMode === 'month') {
      setAnchorDate((d) => shiftMonths(d, -1));
    } else {
      setAnchorDate((d) => shiftDays(d, viewMode === 'day' ? -1 : -7));
    }
  }, [viewMode]);

  const goForward = useCallback(() => {
    if (viewMode === 'month') {
      setAnchorDate((d) => shiftMonths(d, 1));
    } else {
      setAnchorDate((d) => shiftDays(d, viewMode === 'day' ? 1 : 7));
    }
  }, [viewMode]);

  const goToday = useCallback(() => {
    setAnchorDate(getToday());
  }, []);

  const handleViewChange = useCallback((v: ViewMode) => {
    setViewMode(v);
    setAnchorDate(getToday());
  }, []);

  const hasFilters =
    filterProjectId !== null || filterTagIds.length > 0 || showDeleted || onlyIncomplete;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1
            className="font-brand font-semibold tracking-wide text-foreground"
            style={{ fontSize: scaled(18) }}
          >
            Entries
          </h1>
          {targetDisplayName ? (
            <p className="mt-0.5 text-primary" style={{ fontSize: scaled(12) }}>
              Viewing as {targetDisplayName}
            </p>
          ) : (
            <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
              Browse and manage time entries
            </p>
          )}
        </div>
        {!showDeleted && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setManualOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Manual Entry
          </Button>
        )}
      </div>

      {/* Controls row */}
      <div className="mb-4 flex items-center gap-3">
        {/* Day / Week / Month toggle */}
        <div className="flex overflow-hidden rounded-md border border-border">
          {(['day', 'week', 'month'] as const).map((v) => (
            <button
              key={v}
              className={cn(
                'relative py-1 text-center font-brand font-semibold uppercase tracking-wider transition-colors',
                viewMode === v
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              style={{ fontSize: scaled(11), minWidth: scaled(56) }}
              onClick={() => handleViewChange(v)}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            aria-label="Previous"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <button
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent"
            style={{ fontSize: scaled(12) }}
            onClick={goToday}
            title="Go to today"
          >
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-brand font-semibold tracking-wide">
              {formatDateRange(from, to)}
            </span>
          </button>

          <button
            onClick={goForward}
            aria-label="Next"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filters */}
        <ProjectSelector
          value={filterProjectId}
          onChange={(id) => setFilterProjectId(id)}
          triggerClassName="font-brand font-semibold tracking-wide"
        />
        {tagsEnabled && (
          <TagSelector
            value={filterTagIds}
            onChange={setFilterTagIds}
            triggerClassName="font-brand font-semibold tracking-wide"
          />
        )}

        <button
          onClick={() => {
            setOnlyIncomplete((v) => !v);
            setShowDeleted(false);
          }}
          className={cn(
            'rounded-md px-2.5 py-1 font-brand font-semibold uppercase tracking-wider transition-colors',
            onlyIncomplete
              ? 'bg-amber-500/10 text-amber-500'
              : 'text-muted-foreground hover:text-foreground',
          )}
          style={{ fontSize: scaled(11) }}
        >
          Incomplete
        </button>

        <button
          onClick={() => {
            setShowDeleted((d) => !d);
            setOnlyIncomplete(false);
          }}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-brand font-semibold uppercase tracking-wider transition-colors',
            showDeleted
              ? 'bg-destructive/10 text-destructive'
              : 'text-muted-foreground hover:text-foreground',
          )}
          style={{ fontSize: scaled(11) }}
        >
          <Trash2 className="h-3 w-3" />
          Deleted
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              setFilterProjectId(null);
              setFilterTagIds([]);
              setShowDeleted(false);
              setOnlyIncomplete(false);
            }}
            className="text-muted-foreground hover:text-foreground"
            style={{ fontSize: scaled(10) }}
          >
            Clear filters
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Period total */}
        <div className={cn('flex items-center gap-2', showDeleted && 'opacity-40')}>
          <span
            className="font-brand uppercase text-muted-foreground"
            style={{ fontSize: scaled(9), letterSpacing: '1.5px' }}
          >
            Total
          </span>
          <motion.span
            key={periodTotal}
            initial={{ opacity: 0.5, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="font-brand font-bold tabular-nums text-foreground"
            style={{ fontSize: scaled(13) }}
          >
            {formatDuration(periodTotal)}
          </motion.span>
        </div>
      </div>

      {/* Deleted entries banner */}
      {showDeleted && (
        <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
          Showing deleted entries. These entries are excluded from stats and timers.
        </div>
      )}

      {/* Entries list */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading entries...</div>
      ) : filteredGroups.length > 0 ? (
        <ActiveEditProvider>
          <DraftEntryProvider>
            <div>
              {filteredGroups.map((group) => (
                <DayGroup key={group.date} group={group} />
              ))}
            </div>
          </DraftEntryProvider>
        </ActiveEditProvider>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="px-3.5 py-10 text-center text-sm text-muted-foreground">
            {hasFilters ? 'No entries match the current filters.' : 'No entries for this period.'}
          </div>
        </div>
      )}

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} />
    </div>
  );
}
