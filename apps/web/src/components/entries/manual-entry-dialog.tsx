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
import { LabelSelector } from '@/components/timer/label-selector';
import { useCreateEntry } from '@/hooks/use-entries';
import { getDefaultProjectId } from '@/hooks/use-default-project';
import { formatDuration } from '@/lib/format';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualEntryDialog({ open, onOpenChange }: Props) {
  const createEntry = useCreateEntry();

  const today = new Date().toISOString().slice(0, 10);
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(getDefaultProjectId);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  const startIso = `${date}T${startTime}:00.000Z`;
  const endIso = `${date}T${endTime}:00.000Z`;
  const durationSec = Math.max(
    0,
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000,
  );

  const handleSubmit = () => {
    createEntry.mutate(
      {
        description,
        projectId,
        labelIds,
        startedAt: startIso,
        stoppedAt: endIso,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          // Reset form
          setDescription('');
          setProjectId(getDefaultProjectId());
          setLabelIds([]);
          setDate(today);
          setStartTime('09:00');
          setEndTime('10:00');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
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
          <Button onClick={handleSubmit} disabled={createEntry.isPending || durationSec <= 0}>
            {createEntry.isPending ? 'Creating...' : 'Create Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
