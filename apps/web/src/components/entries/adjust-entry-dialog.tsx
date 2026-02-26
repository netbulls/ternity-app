import { useState, useMemo } from 'react';
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
import { useAddAdjustment } from '@/hooks/use-entries';
import type { Entry } from '@ternity/shared';

interface Props {
  entry: Entry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParseResult {
  seconds: number;
  sign: 1 | -1;
}

const SHORTCUTS = [
  { label: '+5m', value: '+5m' },
  { label: '+15m', value: '+15m' },
  { label: '+30m', value: '+30m' },
  { label: '+1h', value: '+1h' },
  { label: '\u221215m', value: '-15m', negative: true },
  { label: '\u221230m', value: '-30m', negative: true },
];

/**
 * Parse a time adjustment string. Supported patterns:
 *   "30m", "+30m", "-1h", "1.5h", "\u22121h15m", "1:30" (h:m), "1:30:00" (h:m:s),
 *   "90" (minutes), "+90s", "2h 30m", "-45s", "0.25h"
 */
function parseTimeInput(raw: string): ParseResult | null {
  let str = raw.trim();
  if (!str) return null;

  // Normalize unicode minus sign
  str = str.replace(/\u2212/g, '-');

  // Determine sign
  let sign: 1 | -1 = 1;
  if (str.startsWith('+')) { sign = 1; str = str.slice(1).trim(); }
  else if (str.startsWith('-')) { sign = -1; str = str.slice(1).trim(); }

  // Pattern 1: h:m:s or h:m
  const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1]!);
    const m = parseInt(colonMatch[2]!);
    const s = colonMatch[3] ? parseInt(colonMatch[3]) : 0;
    if (m > 59 || s > 59) return null;
    return { seconds: h * 3600 + m * 60 + s, sign };
  }

  // Pattern 2: decimal hours (e.g. "1.5h", "0.25h")
  const decimalHMatch = str.match(/^(\d+\.\d+)\s*h$/i);
  if (decimalHMatch) {
    const hours = parseFloat(decimalHMatch[1]!);
    return { seconds: Math.round(hours * 3600), sign };
  }

  // Pattern 3: combinations of Nh, Nm, Ns (e.g. "1h30m", "1h 30m 15s", "30m", "45s")
  const unitMatch = str.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s(?:ec)?)?$/i);
  if (unitMatch && (unitMatch[1] || unitMatch[2] || unitMatch[3])) {
    const h = parseInt(unitMatch[1] ?? '0');
    const m = parseInt(unitMatch[2] ?? '0');
    const s = parseInt(unitMatch[3] ?? '0');
    return { seconds: h * 3600 + m * 60 + s, sign };
  }

  // Pattern 4: bare number = minutes
  const bareNum = str.match(/^(\d+)$/);
  if (bareNum) {
    return { seconds: parseInt(bareNum[1]!) * 60, sign };
  }

  return null;
}

function humanize(parsed: ParseResult): string | null {
  const s = parsed.seconds;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const verb = parsed.sign > 0 ? 'Adding' : 'Removing';
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
  if (sec > 0) parts.push(`${sec} second${sec > 1 ? 's' : ''}`);
  if (parts.length === 0) return null;
  return `${verb} ${parts.join(', ')}`;
}

function formatAdj(seconds: number, sign: 1 | -1): string {
  const signChar = sign > 0 ? '+' : '\u2212';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${h > 0 ? String(m).padStart(2, '0') : String(m)}m`);
  if (s > 0 && h === 0) parts.push(`${m > 0 ? String(s).padStart(2, '0') : String(s)}s`);
  return `${signChar}${parts.join(' ') || '0s'}`;
}

export function AdjustEntryDialog({ entry, open, onOpenChange }: Props) {
  const addAdjustment = useAddAdjustment();

  const [rawInput, setRawInput] = useState('');
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const parsed = useMemo(() => parseTimeInput(rawInput), [rawInput]);
  const isEmpty = rawInput.trim() === '';
  const isValid = parsed !== null && parsed.seconds > 0;
  const isPositive = parsed?.sign === 1;

  // Sum all segment durations, including elapsed time for the running segment
  const completedTotal = entry.segments.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  const runningSegment = entry.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);
  const runningElapsed = runningSegment?.startedAt
    ? Math.max(0, Math.round((Date.now() - new Date(runningSegment.startedAt).getTime()) / 1000))
    : 0;
  const segmentsTotal = completedTotal + runningElapsed;
  const adjSeconds = isValid ? parsed.seconds * parsed.sign : 0;
  const exceedsTotal = isValid && !isPositive && parsed.seconds > segmentsTotal;
  const newTotal = Math.max(0, segmentsTotal + adjSeconds);

  const canSubmit = isValid && !exceedsTotal && note.trim().length > 0;

  const resetForm = () => {
    setRawInput('');
    setActiveShortcut(null);
    setNote('');
  };

  const handleSubmit = () => {
    if (!canSubmit || !parsed) return;

    const durationSeconds = parsed.seconds * parsed.sign;
    addAdjustment.mutate(
      { id: entry.id, durationSeconds, note: note.trim() },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      },
    );
  };

  const handleShortcut = (value: string) => {
    setRawInput(value);
    setActiveShortcut(value);
  };

  const projectLabel = entry.clientName
    ? `${entry.clientName} \u00b7 ${entry.projectName}`
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
          <DialogTitle>Adjust Time</DialogTitle>
          <div className="flex flex-col gap-0.5 pt-1">
            <span className="truncate text-[13px] font-medium text-foreground/90">
              {entry.description || 'No description'}
            </span>
            {projectLabel && (
              <span className="truncate text-primary" style={{ fontSize: scaled(11) }}>
                {projectLabel}
              </span>
            )}
            <span className="font-brand tabular-nums text-muted-foreground" style={{ fontSize: scaled(11) }}>
              Current: {formatDuration(segmentsTotal)}
            </span>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Main input */}
          <div>
            <input
              type="text"
              className={cn(
                'w-full rounded-lg border-2 bg-muted/40 px-4 py-3 text-center font-brand text-xl font-semibold tabular-nums text-foreground outline-none transition-all',
                'placeholder:font-normal placeholder:text-muted-foreground/25',
                isEmpty && 'border-border',
                !isEmpty && isValid && !exceedsTotal && isPositive && 'border-primary/50 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]',
                !isEmpty && isValid && !exceedsTotal && !isPositive && 'border-destructive/50 shadow-[0_0_0_3px_hsl(var(--destructive)/0.08)]',
                !isEmpty && isValid && exceedsTotal && 'border-destructive/30',
                !isEmpty && !isValid && 'border-destructive/30',
              )}
              style={{ fontSize: scaled(20), letterSpacing: '1px' }}
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setActiveShortcut(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleSubmit();
              }}
              placeholder="+30m, 1.5h, or −1h 15m"
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />

            {/* Parse feedback */}
            <div className="min-h-[22px] py-1.5 text-center" style={{ fontSize: scaled(12) }}>
              {isEmpty ? (
                <span className="text-muted-foreground/30">
                  Type a value like +30m or {'\u2212'}1h 15m
                </span>
              ) : isValid && exceedsTotal ? (
                <span className="italic text-destructive/60">
                  Cannot remove more than the current total
                </span>
              ) : isValid ? (
                <span className={isPositive ? 'text-primary' : 'text-destructive'}>
                  {humanize(parsed)}
                </span>
              ) : parsed?.seconds === 0 ? (
                <span className="text-muted-foreground/30">Enter a non-zero value</span>
              ) : (
                <span className="italic text-destructive/60">
                  Could not parse — try &quot;30m&quot;, &quot;+1h15m&quot;, &quot;1.5h&quot;, or &quot;1:30&quot;
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
                Adjustment
              </div>
              <div
                className={cn(
                  'mt-1 font-brand font-bold tabular-nums',
                  !isValid && 'text-muted-foreground/30',
                  isValid && isPositive && 'text-primary',
                  isValid && !isPositive && 'text-destructive',
                )}
                style={{ fontSize: scaled(20), minWidth: '100px' }}
              >
                {isValid ? formatAdj(parsed.seconds, parsed.sign) : '\u2014'}
              </div>
            </div>
            <div className="flex-1 rounded-lg border border-border/30 bg-muted/30 px-3 py-3 text-center">
              <div
                className="font-brand uppercase tracking-widest text-muted-foreground/50"
                style={{ fontSize: scaled(9) }}
              >
                New Total
              </div>
              <div
                className="mt-1 font-brand font-bold tabular-nums text-foreground"
                style={{ fontSize: scaled(20), minWidth: '100px' }}
              >
                {formatDuration(isValid ? newTotal : segmentsTotal)}
              </div>
            </div>
          </div>

          {/* Shortcut chips */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {SHORTCUTS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={cn(
                  'rounded-full border px-2.5 py-1 font-body tabular-nums transition-all',
                  activeShortcut === s.value
                    ? s.negative
                      ? 'border-destructive bg-destructive/8 text-destructive'
                      : 'border-primary bg-primary/8 text-primary'
                    : 'border-border/60 text-muted-foreground/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary',
                  s.negative && activeShortcut !== s.value && 'hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive',
                )}
                style={{ fontSize: scaled(10) }}
                onClick={() => handleShortcut(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Reason */}
          <div className="grid gap-2">
            <Label htmlFor="adjust-note">Reason</Label>
            <Input
              id="adjust-note"
              placeholder="Why are you adjusting this entry?"
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
          <Button onClick={handleSubmit} disabled={!canSubmit || addAdjustment.isPending}>
            {addAdjustment.isPending
              ? 'Applying...'
              : canSubmit
                ? `Apply ${formatAdj(parsed!.seconds, parsed!.sign)}`
                : 'Apply Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
