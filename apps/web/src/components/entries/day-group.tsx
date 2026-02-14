import { formatDateLabel, formatDuration } from '@/lib/format';
import { EntryRow } from './entry-row';
import type { DayGroup as DayGroupType } from '@ternity/shared';

interface Props {
  group: DayGroupType;
}

export function DayGroup({ group }: Props) {
  return (
    <div className="mb-4">
      {/* Date header */}
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] font-semibold text-foreground">
          {formatDateLabel(group.date)}
        </span>
        <span className="font-brand text-[12px] font-semibold text-muted-foreground tabular-nums">
          {formatDuration(group.totalSeconds)}
        </span>
      </div>

      {/* Entries */}
      <div className="overflow-hidden rounded-lg border border-border">
        {group.entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
