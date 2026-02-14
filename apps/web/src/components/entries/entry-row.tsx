import { useState, useCallback } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateEntry, useDeleteEntry } from '@/hooks/use-entries';
import { useElapsedSeconds } from '@/hooks/use-timer';
import { formatTime, formatDuration } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Entry } from '@ternity/shared';

interface Props {
  entry: Entry;
}

export function EntryRow({ entry }: Props) {
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(entry.description);

  const isRunning = !entry.stoppedAt;
  const elapsed = useElapsedSeconds(entry.startedAt, isRunning);

  const durationStr = isRunning
    ? formatDuration(elapsed)
    : formatDuration(entry.durationSeconds ?? 0);

  const timeRange = isRunning
    ? `${formatTime(entry.startedAt)} – now`
    : `${formatTime(entry.startedAt)} – ${formatTime(entry.stoppedAt!)}`;

  const handleSaveDescription = useCallback(() => {
    setEditing(false);
    if (editValue !== entry.description) {
      updateEntry.mutate({ id: entry.id, description: editValue });
    }
  }, [editValue, entry.description, entry.id, updateEntry]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveDescription();
    if (e.key === 'Escape') {
      setEditValue(entry.description);
      setEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0',
        isRunning && 'border-l-2 border-l-primary bg-primary/5',
      )}
    >
      {/* Description + project + labels */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              className="flex-1 bg-transparent text-[13px] text-foreground outline-none ring-1 ring-primary rounded px-1.5 py-0.5"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSaveDescription}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <span
              className="cursor-pointer text-[13px] text-foreground truncate hover:text-primary"
              onClick={() => {
                setEditValue(entry.description);
                setEditing(true);
              }}
            >
              {entry.description || <span className="text-muted-foreground italic">No description</span>}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {entry.projectName && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.projectColor ?? '#00D4AA' }}
              />
              {entry.projectName}
            </span>
          )}
          {entry.labels.map((label) => (
            <Badge
              key={label.id}
              variant="outline"
              className="h-[18px] px-1.5 text-[10px]"
            >
              {label.color && (
                <span
                  className="mr-1 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
              )}
              {label.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* Time range + duration */}
      <div className="flex items-center gap-4 text-right shrink-0">
        <span className="text-[11px] text-muted-foreground">{timeRange}</span>
        <span
          className={cn(
            'font-brand text-sm font-semibold tabular-nums',
            isRunning ? 'text-primary' : 'text-foreground',
          )}
        >
          {durationStr}
        </span>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setEditValue(entry.description);
              setEditing(true);
            }}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => deleteEntry.mutate(entry.id)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
