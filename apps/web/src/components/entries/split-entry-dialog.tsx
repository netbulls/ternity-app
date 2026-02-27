import { useState, useMemo, useEffect } from 'react';
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
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatDuration } from '@/lib/format';
import { useSplitEntry } from '@/hooks/use-entries';
import { ProjectSelector } from '@/components/timer/project-selector';
import type { Entry } from '@ternity/shared';

interface Props {
  entry: Entry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParseResult {
  seconds: number;
}

/**
 * Parse a time duration string. Supported patterns:
 *   "30m", "+30m", "-1h", "1.5h", "1h30m", "1:30" (h:m), "1:30:00" (h:m:s),
 *   "90" (minutes), "+90s", "2h 30m", "45s", "0.25h"
 */
function parseTimeInput(raw: string): ParseResult | null {
  let str = raw.trim();
  if (!str) return null;

  // Normalize unicode minus sign
  str = str.replace(/\u2212/g, '-');

  // Remove leading + sign (splits are always positive)
  if (str.startsWith('+')) str = str.slice(1).trim();

  // Pattern 1: h:m:s or h:m
  const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1]!);
    const m = parseInt(colonMatch[2]!);
    const s = colonMatch[3] ? parseInt(colonMatch[3]) : 0;
    if (m > 59 || s > 59) return null;
    return { seconds: h * 3600 + m * 60 + s };
  }

  // Pattern 2: decimal hours (e.g. "1.5h", "0.25h")
  const decimalHMatch = str.match(/^(\d+\.\d+)\s*h$/i);
  if (decimalHMatch) {
    const hours = parseFloat(decimalHMatch[1]!);
    return { seconds: Math.round(hours * 3600) };
  }

  // Pattern 3: combinations of Nh, Nm, Ns (e.g. "1h30m", "1h 30m 15s", "30m", "45s")
  const unitMatch = str.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s(?:ec)?)?$/i);
  if (unitMatch && (unitMatch[1] || unitMatch[2] || unitMatch[3])) {
    const h = parseInt(unitMatch[1] ?? '0');
    const m = parseInt(unitMatch[2] ?? '0');
    const s = parseInt(unitMatch[3] ?? '0');
    return { seconds: h * 3600 + m * 60 + s };
  }

  // Pattern 4: bare number = minutes
  const bareNum = str.match(/^(\d+)$/);
  if (bareNum) {
    return { seconds: parseInt(bareNum[1]!) * 60 };
  }

  return null;
}

function humanize(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
  if (sec > 0 && h === 0) parts.push(`${sec} second${sec > 1 ? 's' : ''}`);
  if (parts.length === 0) return '0 seconds';
  return parts.join(', ');
}

export function SplitEntryDialog({ entry, open, onOpenChange }: Props) {
  const splitEntry = useSplitEntry();

  const [rawInput, setRawInput] = useState('');
  const [note, setNote] = useState('');
  const [description, setDescription] = useState(entry.description ?? '');
  const [projectId, setProjectId] = useState<string | null>(entry.projectId ?? null);

  // Reset form fields when entry changes or dialog opens
  useEffect(() => {
    if (open) {
      setDescription(entry.description ?? '');
      setProjectId(entry.projectId ?? null);
    }
  }, [open, entry.description, entry.projectId]);

  const parsed = useMemo(() => parseTimeInput(rawInput), [rawInput]);
  const isEmpty = rawInput.trim() === '';
  const isValid = parsed !== null && parsed.seconds > 0;

  // Calculate total duration from entry segments
  const completedTotal = entry.segments.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  const runningSegment = entry.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);
  const runningElapsed = runningSegment?.startedAt
    ? Math.max(0, Math.round((Date.now() - new Date(runningSegment.startedAt).getTime()) / 1000))
    : 0;
  const totalDuration = completedTotal + runningElapsed;

  // Calculate what happens after split
  const exceedsTotal = isValid && parsed.seconds >= totalDuration;
  const remainingAfterSplit = Math.max(0, totalDuration - (parsed?.seconds ?? 0));

  const canSubmit = isValid && !exceedsTotal;

  const resetForm = () => {
    setRawInput('');
    setNote('');
    setDescription(entry.description ?? '');
    setProjectId(entry.projectId ?? null);
  };

  const handleSubmit = () => {
    if (!canSubmit || !parsed) return;

    // Only send description/projectId if they differ from the original
    const descChanged = description !== (entry.description ?? '');
    const projChanged = projectId !== (entry.projectId ?? null);

    splitEntry.mutate(
      {
        entryId: entry.id,
        durationSeconds: parsed.seconds,
        note: note.trim() || undefined,
        description: descChanged ? description : undefined,
        projectId: projChanged ? projectId : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      },
    );
  };

  const originalProjectLabel = entry.clientName
    ? `${entry.clientName} · ${entry.projectName}`
    : entry.projectName;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split Off Time</DialogTitle>
          <div className="flex flex-col gap-0.5 pt-1">
            <span className="truncate text-[13px] font-medium text-foreground/90">
              {entry.description || 'No description'}
            </span>
            {originalProjectLabel && (
              <span className="truncate text-primary" style={{ fontSize: scaled(11) }}>
                {originalProjectLabel}
              </span>
            )}
            <span
              className="font-brand tabular-nums text-muted-foreground"
              style={{ fontSize: scaled(11) }}
            >
              Current: {formatDuration(totalDuration)}
            </span>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Duration input */}
          <div>
            <input
              type="text"
              className={cn(
                'w-full rounded-lg border-2 bg-muted/40 px-4 py-3 text-center font-brand text-xl font-semibold tabular-nums text-foreground outline-none transition-all',
                'placeholder:font-normal placeholder:text-muted-foreground/25',
                isEmpty && 'border-border',
                !isEmpty &&
                  isValid &&
                  !exceedsTotal &&
                  'border-primary/50 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]',
                !isEmpty && isValid && exceedsTotal && 'border-destructive/30',
                !isEmpty && !isValid && 'border-destructive/30',
              )}
              style={{ fontSize: scaled(20), letterSpacing: '1px' }}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleSubmit();
              }}
              placeholder="30m, 1.5h, or 1h 30m"
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />

            {/* Parse feedback */}
            <div className="min-h-[22px] py-1.5 text-center" style={{ fontSize: scaled(12) }}>
              {isEmpty ? (
                <span className="text-muted-foreground/30">
                  Type time to split off — e.g. 30m or 1.5h
                </span>
              ) : isValid && exceedsTotal ? (
                <span className="italic text-destructive/60">
                  Cannot split {formatDuration(parsed.seconds)} — entry is only{' '}
                  {formatDuration(totalDuration)}
                </span>
              ) : isValid ? (
                <span className="text-primary">Split off {humanize(parsed.seconds)}</span>
              ) : (
                <span className="italic text-destructive/60">
                  Could not parse — try &quot;30m&quot;, &quot;1.5h&quot;, or &quot;1:30&quot;
                </span>
              )}
            </div>
          </div>

          {/* Result cards */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg border border-border/30 bg-muted/30 px-3 py-3 text-center">
              <div
                className="font-brand uppercase tracking-widest text-muted-foreground/50"
                style={{ fontSize: scaled(9) }}
              >
                Split Off
              </div>
              <div
                className={cn(
                  'mt-1 font-brand font-bold tabular-nums',
                  !isValid && 'text-muted-foreground/30',
                  isValid && !exceedsTotal && 'text-primary',
                  isValid && exceedsTotal && 'text-destructive',
                )}
                style={{ fontSize: scaled(20), minWidth: '100px' }}
              >
                {isValid ? formatDuration(parsed.seconds) : '—'}
              </div>
            </div>
            <div className="flex-1 rounded-lg border border-border/30 bg-muted/30 px-3 py-3 text-center">
              <div
                className="font-brand uppercase tracking-widest text-muted-foreground/50"
                style={{ fontSize: scaled(9) }}
              >
                Original Will Be
              </div>
              <div
                className="mt-1 font-brand font-bold tabular-nums text-foreground"
                style={{ fontSize: scaled(20), minWidth: '100px' }}
              >
                {formatDuration(isValid && !exceedsTotal ? remainingAfterSplit : totalDuration)}
              </div>
            </div>
          </div>

          {/* New entry details */}
          <div className="grid gap-3">
            <div
              className="font-brand uppercase tracking-widest text-muted-foreground/50"
              style={{ fontSize: scaled(9) }}
            >
              New Entry Details
            </div>
            <div className="grid gap-2">
              <Label htmlFor="split-description">Description</Label>
              <Input
                id="split-description"
                placeholder="What was this time for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleSubmit();
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>Project</Label>
              <ProjectSelector value={projectId} onChange={(id) => setProjectId(id)} />
            </div>
          </div>

          {/* Reason */}
          <div className="grid gap-2">
            <Label htmlFor="split-note">Reason (optional)</Label>
            <Input
              id="split-note"
              placeholder="Why are you splitting this entry?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleSubmit();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || splitEntry.isPending}>
            {splitEntry.isPending
              ? 'Splitting...'
              : canSubmit
                ? `Split Off ${formatDuration(parsed!.seconds)}`
                : 'Split Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
