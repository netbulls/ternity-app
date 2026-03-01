import { useState } from 'react';
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
import { TagSelector } from '@/components/timer/tag-selector';
import { useCreateEntry } from '@/hooks/use-entries';
import { getPreference, usePreferences } from '@/providers/preferences-provider';
import { formatDuration, orgTimeToISO } from '@/lib/format';
import { scaled } from '@/lib/scaled';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualEntryDialog({ open, onOpenChange }: Props) {
  const createEntry = useCreateEntry();
  const { tagsEnabled } = usePreferences();

  const today = new Date().toISOString().slice(0, 10);
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(() =>
    getPreference('defaultProjectId'),
  );
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [note, setNote] = useState('');

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

  const resetForm = () => {
    setDescription('');
    setProjectId(getPreference('defaultProjectId'));
    setTagIds([]);
    setDate(today);
    setStartTime('09:00');
    setEndTime('10:00');
    setNote('');
  };

  const handleSubmit = () => {
    createEntry.mutate(
      {
        description,
        projectId,
        tagIds,
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (durationSec > 0 && note.trim()) handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add Manual Entry</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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
              {tagsEnabled && (
                <div className="grid gap-2">
                  <Label>Tags</Label>
                  <TagSelector value={tagIds} onChange={setTagIds} />
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
              <div className="text-center text-muted-foreground" style={{ fontSize: scaled(14) }}>
                Duration:{' '}
                <span className="font-brand font-semibold text-foreground">
                  {formatDuration(durationSec)}
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEntry.isPending || durationSec <= 0 || !note.trim()}
            >
              {createEntry.isPending ? 'Creating...' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
