import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { formatDateLabel, formatDuration } from '@/lib/format';
import { useCreateEntry } from '@/hooks/use-entries';
import { EntryRow } from './entry-row';
import type { DayGroup as DayGroupType, Entry } from '@ternity/shared';

interface Props {
  group: DayGroupType;
}

export function DayGroup({ group }: Props) {
  const [newEntryId, setNewEntryId] = useState<string | null>(null);
  const createEntry = useCreateEntry();

  const handleAdd = useCallback(() => {
    const timestamp = `${group.date}T09:00:00`;
    createEntry.mutate(
      {
        description: '',
        projectId: null,
        labelIds: [],
        startedAt: timestamp,
        stoppedAt: timestamp,
      },
      {
        onSuccess: (entry: Entry) => {
          setNewEntryId(entry.id);
        },
      },
    );
  }, [createEntry, group.date]);

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

        {/* Entries */}
        {group.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            autoEdit={entry.id === newEntryId}
            onAutoEditConsumed={() => setNewEntryId(null)}
          />
        ))}
      </div>
    </div>
  );
}
