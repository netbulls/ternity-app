import { useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { formatDateLabel, formatDuration } from '@/lib/format';
import { EntryRow } from './entry-row';
import { DraftEntryRow } from './draft-entry-row';
import { useDraftEntry } from './draft-entry-context';
import type { DayGroup as DayGroupType } from '@ternity/shared';

interface Props {
  group: DayGroupType;
}

export function DayGroup({ group }: Props) {
  const { draft, openDraft, savedEntryId } = useDraftEntry();

  const handleAdd = useCallback(() => {
    openDraft(group.date);
  }, [openDraft, group.date]);

  // While the draft is transitioning to a saved entry, filter out the new entry
  // from the entries list to prevent a double-row (draft + entry simultaneously)
  const visibleEntries = useMemo(() => {
    if (savedEntryId && draft) {
      return group.entries.filter((e) => e.id !== savedEntryId);
    }
    return group.entries;
  }, [group.entries, savedEntryId, draft]);

  return (
    <div className="group/day mb-4">
      <div className="rounded-lg border border-border">
        {/* Date header */}
        <div
          className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-2"
          style={{ background: 'hsl(var(--muted) / 0.3)' }}
        >
          <div className="flex items-center gap-2">
            <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {formatDateLabel(group.date)}
            </span>
            <button
              className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-border text-muted-foreground opacity-0 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary group-hover/day:opacity-100"
              onClick={handleAdd}
              title="Add entry"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <span className="font-brand text-xs font-semibold tabular-nums text-foreground">
            {formatDuration(group.totalSeconds)}
          </span>
        </div>

        {/* Draft row (if draft belongs to this day) */}
        <AnimatePresence>
          {draft?.date === group.date && <DraftEntryRow key="draft" />}
        </AnimatePresence>

        {/* Entries */}
        {visibleEntries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
