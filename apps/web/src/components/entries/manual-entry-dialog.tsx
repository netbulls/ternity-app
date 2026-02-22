import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProjectSelector } from '@/components/timer/project-selector';
import { LabelSelector } from '@/components/timer/label-selector';
import { useCreateEntry, useAddAdjustment } from '@/hooks/use-entries';
import { getDefaultProjectId } from '@/hooks/use-default-project';
import { formatDuration, orgTimeToISO } from '@/lib/format';
import type { Entry } from '@ternity/shared';

interface CreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create';
  entry?: never;
}

interface AdjustProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'adjust';
  entry: Entry;
}

type Props = CreateProps | AdjustProps;

export function ManualEntryDialog({ open, onOpenChange, mode = 'create', entry }: Props) {
  const createEntry = useCreateEntry();
  const addAdjustment = useAddAdjustment();
  const isAdjust = mode === 'adjust';

  const today = new Date().toISOString().slice(0, 10);
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(getDefaultProjectId);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [note, setNote] = useState('');

  // Pre-populate fields when opening in adjust mode
  useEffect(() => {
    if (open && isAdjust && entry) {
      setDescription(entry.description);
      setProjectId(entry.projectId);
      setLabelIds(entry.labels?.map((l) => l.id) ?? []);
    }
  }, [open, isAdjust, entry]);

  const dateParts = date.split('-').map(Number);
  const year = dateParts[0] ?? 2026;
  const month = (dateParts[1] ?? 1) - 1;
  const day = dateParts[2] ?? 1;
  const sp = startTime.split(':').map(Number);
  const ep = endTime.split(':').map(Number);
  const startIso = orgTimeToISO(year, month, day, sp[0] ?? 0, sp[1] ?? 0);
  // Cross-midnight: if end time < start time, end is next day
  const endDay = endTime < startTime ? day + 1 : day;
  const endIso = orgTimeToISO(year, month, endDay, ep[0] ?? 0, ep[1] ?? 0);
  const durationSec = Math.max(
    0,
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000,
  );

  const isPending = isAdjust ? addAdjustment.isPending : createEntry.isPending;

  const resetForm = () => {
    setDescription('');
    setProjectId(getDefaultProjectId());
    setLabelIds([]);
    setDate(today);
    setStartTime('09:00');
    setEndTime('10:00');
    setNote('');
  };

  const handleSubmit = () => {
    if (isAdjust && entry) {
      addAdjustment.mutate(
        {
          id: entry.id,
          durationSeconds: durationSec,
          note,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            resetForm();
          },
        },
      );
    } else {
      createEntry.mutate(
        {
          description,
          projectId,
          labelIds,
          startedAt: startIso,
          stoppedAt: endIso,
          note,
          source: 'manual_dialog',
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            resetForm();
          },
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isAdjust ? 'Add Adjustment' : 'Add Manual Entry'}</DialogTitle>
          {isAdjust && entry && (
            <p className="text-sm text-muted-foreground truncate">
              {entry.description || 'No description'}
              {entry.projectName && (
                <span className="ml-1.5">
                  &middot;{' '}
                  <span
                    className="inline-block h-2 w-2 rounded-full align-middle mr-1"
                    style={{ backgroundColor: entry.projectColor ?? '#00D4AA' }}
                  />
                  {entry.projectName}
                </span>
              )}
            </p>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!isAdjust && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="What did you work on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="note">Reason</Label>
                <Input
                  id="note"
                  placeholder="Why are you adding this manually?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="grid gap-2">
                  <Label>Project</Label>
                  <ProjectSelector value={projectId} onChange={(id) => setProjectId(id)} />
                </div>
                <div className="grid gap-2">
                  <Label>Labels</Label>
                  <LabelSelector value={labelIds} onChange={setLabelIds} />
                </div>
              </div>
            </>
          )}

          {isAdjust && (
            <div className="grid gap-2">
              <Label htmlFor="adjust-note">Reason</Label>
              <Input
                id="adjust-note"
                placeholder="Why are you adding this adjustment?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="start">Start Time</Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">End Time</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {durationSec > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              Duration: <span className="font-brand font-semibold text-foreground">{formatDuration(durationSec)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || durationSec <= 0 || !note.trim()}>
            {isPending
              ? (isAdjust ? 'Adding...' : 'Creating...')
              : (isAdjust ? 'Add Adjustment' : 'Create Entry')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
