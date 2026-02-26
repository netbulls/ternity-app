import { useState } from 'react';
import { ArrowDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useElapsedSeconds } from '@/hooks/use-timer';
import { formatDuration } from '@/lib/format';
import { scaled } from '@/lib/scaled';
import { cn } from '@/lib/utils';
import type { Entry } from '@ternity/shared';

interface SwitchTimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stoppingEntry: Entry;
  startingEntry: Entry;
  onConfirm: (dontAskAgain: boolean) => void;
}

export function SwitchTimerDialog({
  open,
  onOpenChange,
  stoppingEntry,
  startingEntry,
  onConfirm,
}: SwitchTimerDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Live ticking for the stopping entry
  const completedDuration = stoppingEntry.segments
    .filter((s) => s.durationSeconds != null)
    .reduce((sum, s) => sum + s.durationSeconds!, 0);
  const runningSegment = stoppingEntry.segments.find(
    (s) => s.type === 'clocked' && !s.stoppedAt,
  );
  const elapsed = useElapsedSeconds(
    runningSegment?.startedAt ?? null,
    open, // tick only while dialog is open
    completedDuration,
  );

  const handleConfirm = () => {
    onConfirm(dontAskAgain);
    setDontAskAgain(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setDontAskAgain(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch timer</DialogTitle>
          <DialogDescription>
            Another timer is running. Switch to the new entry?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 overflow-hidden py-1">
          {/* Stopping card */}
          <div className="w-full rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className="font-medium uppercase tracking-wider text-destructive/70"
                style={{ fontSize: scaled(9) }}
              >
                Stopping
              </span>
            </div>
            <p
              className={cn(
                'mt-1 truncate text-foreground',
                !stoppingEntry.description && 'italic text-muted-foreground',
              )}
              style={{ fontSize: scaled(13) }}
            >
              {stoppingEntry.description || 'No description'}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {stoppingEntry.projectColor && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stoppingEntry.projectColor }}
                  />
                )}
                <span
                  className="truncate text-muted-foreground"
                  style={{ fontSize: scaled(11) }}
                >
                  {stoppingEntry.clientName
                    ? `${stoppingEntry.clientName} · ${stoppingEntry.projectName}`
                    : stoppingEntry.projectName || 'No project'}
                </span>
              </div>
              <span
                className="shrink-0 font-brand font-semibold tabular-nums text-destructive"
                style={{ fontSize: scaled(13) }}
              >
                {formatDuration(elapsed)}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/50">
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Starting card */}
          <div className="w-full rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className="font-medium uppercase tracking-wider text-primary/70"
                style={{ fontSize: scaled(9) }}
              >
                Starting
              </span>
            </div>
            <p
              className={cn(
                'mt-1 truncate text-foreground',
                !startingEntry.description && 'italic text-muted-foreground',
              )}
              style={{ fontSize: scaled(13) }}
            >
              {startingEntry.description || 'No description'}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {startingEntry.projectColor && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: startingEntry.projectColor }}
                  />
                )}
                <span
                  className="truncate text-muted-foreground"
                  style={{ fontSize: scaled(11) }}
                >
                  {startingEntry.clientName
                    ? `${startingEntry.clientName} · ${startingEntry.projectName}`
                    : startingEntry.projectName || 'No project'}
                </span>
              </div>
              <span
                className="shrink-0 font-brand font-semibold tabular-nums text-foreground"
                style={{ fontSize: scaled(13) }}
              >
                {formatDuration(startingEntry.totalDurationSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Don't ask again */}
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked === true)}
          />
          <span className="text-[12px] text-muted-foreground">
            Don&apos;t ask again
          </span>
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Switch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
