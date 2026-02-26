import { motion } from 'motion/react';
import { Timer, Pencil, Plus, Minus, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatTime, formatDuration } from '@/lib/format';
import { useElapsedSeconds } from '@/hooks/use-timer';
import type { Entry, Segment } from '@ternity/shared';

/** Like formatDuration but shows seconds when under 1 minute */
function formatBlockDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 60) return `${abs}s`;
  return formatDuration(abs);
}

/** Always includes seconds — used for running segments */
function formatLiveDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

interface TimeBlockDrawerProps {
  entry: Entry;
  onMoveBlock: (segmentId: string) => void;
}

/** Parse move-adjustment notes: "moved:{segmentId}:{description}" */
function parseMoveNote(note: string | null): { segmentId: string; targetName: string } | null {
  if (!note) return null;
  const match = note.match(/^moved:([^:]+)(?::(.*))?$/);
  if (!match) return null;
  return { segmentId: match[1]!, targetName: match[2] ?? '' };
}

function BlockRow({ segment, isLast, canMove, isMoved, movedToName, onMove }: {
  segment: Segment;
  isLast: boolean;
  canMove: boolean;
  isMoved: boolean;
  movedToName?: string;
  onMove: () => void;
}) {
  const isAdjustment = !segment.startedAt;
  const isRunning = segment.type === 'clocked' && !segment.stoppedAt;
  const liveElapsed = useElapsedSeconds(segment.startedAt, isRunning);
  const displayDuration = segment.durationSeconds ?? (isRunning ? liveElapsed : null);
  const isNegative = (displayDuration ?? 0) < 0;
  const isClocked = segment.type === 'clocked';

  return (
    <div className={cn(
      'group/block relative grid items-center gap-2',
      isMoved && 'opacity-50',
    )} style={{
      gridTemplateColumns: '16px 1fr auto auto',
      padding: '7px 0',
    }}>
      {/* Timeline connector line */}
      {!isLast && (
        <div
          className="absolute left-[7px] top-[26px] bottom-[-7px] w-px bg-border"
        />
      )}

      {/* Timeline dot */}
      <div className="flex justify-center">
        {isAdjustment ? (
          <div className="relative z-[1] flex h-2 w-2 items-center justify-center">
            {isNegative ? (
              <Minus className="h-2.5 w-2.5 text-muted-foreground/40" />
            ) : (
              <Plus className="h-2.5 w-2.5 text-muted-foreground/40" />
            )}
          </div>
        ) : (
          <div
            className={cn(
              'relative z-[1] h-2 w-2 rounded-full border-2 bg-background',
              isMoved
                ? 'border-muted-foreground/30 border-dashed'
                : isClocked
                  ? 'border-primary'
                  : 'border-muted-foreground/40 border-dashed',
            )}
          />
        )}
      </div>

      {/* Time info */}
      <div style={{ fontSize: scaled(11) }}>
        {isAdjustment ? (
          <span className="text-muted-foreground">
            {segment.note || 'Adjustment'}
          </span>
        ) : (
          <span className="text-muted-foreground">
            <span className={cn('font-medium', isMoved ? 'text-muted-foreground line-through' : 'text-foreground')}>
              {formatTime(segment.startedAt!)}
            </span>
            <span className="mx-1 opacity-40">–</span>
            <span className={cn('font-medium', isMoved ? 'text-muted-foreground line-through' : 'text-foreground')}>
              {segment.stoppedAt ? formatTime(segment.stoppedAt) : 'now'}
            </span>
            {isMoved ? (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-border/50 px-1 py-px text-muted-foreground/60" style={{ fontSize: scaled(9) }}>
                <ArrowUpRight className="h-2 w-2" />
                {movedToName || 'Moved'}
              </span>
            ) : isClocked ? (
              <Timer className="ml-1.5 inline h-2.5 w-2.5 text-primary/50" />
            ) : (
              <Pencil className="ml-1.5 inline h-2.5 w-2.5 text-muted-foreground/40" />
            )}
          </span>
        )}
      </div>

      {/* Duration */}
      <span
        className={cn(
          'font-brand text-right font-semibold tabular-nums',
          isMoved ? 'text-muted-foreground/40 line-through' : isNegative ? 'text-destructive/70' : 'text-foreground',
        )}
        style={{ fontSize: scaled(11), minWidth: '44px' }}
      >
        {displayDuration != null
          ? (isNegative ? '−' : '') + (isRunning ? formatLiveDuration(displayDuration) : formatBlockDuration(displayDuration))
          : '—'}
      </span>

      {/* Move action — hover only, non-adjustment, non-moved, completed or running segments */}
      <div>
        {canMove && !isMoved && !isAdjustment && (segment.stoppedAt || isRunning) ? (
          <button
            onClick={onMove}
            className="whitespace-nowrap rounded border border-border bg-background px-2 py-0.5 text-muted-foreground opacity-0 transition-all hover:border-primary/50 hover:text-primary group-hover/block:opacity-100"
            style={{ fontSize: scaled(10) }}
          >
            Move to new entry
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function DrawerFooter({ entry, blockCount }: { entry: Entry; blockCount: number }) {
  const runningSegment = entry.segments.find(
    (s) => s.type === 'clocked' && !s.stoppedAt,
  );
  const liveElapsed = useElapsedSeconds(
    runningSegment?.startedAt ?? null,
    !!runningSegment,
  );

  // Sum completed durations + live elapsed for running segment
  const completedTotal = entry.segments
    .filter((s) => s.durationSeconds != null)
    .reduce((sum, s) => sum + s.durationSeconds!, 0);
  const total = completedTotal + (runningSegment ? liveElapsed : 0);

  return (
    <div
      className="mt-1 flex items-center gap-2 border-t border-border/30 pt-2 text-muted-foreground/50"
      style={{ fontSize: scaled(10) }}
    >
      <span className="font-brand">
        {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
      </span>
      <span className="opacity-30">·</span>
      <span className="font-brand font-semibold text-foreground/50">
        {formatDuration(total)}
      </span>
    </div>
  );
}

export function TimeBlockDrawer({ entry, onMoveBlock }: TimeBlockDrawerProps) {
  const isDeleted = !entry.isActive;

  // Build maps from move-adjustment notes: segmentId → target name, and filter set
  const movedSegmentIds = new Set<string>();
  const movedToNames = new Map<string, string>();
  for (const seg of entry.segments) {
    const move = parseMoveNote(seg.note);
    if (move) {
      movedSegmentIds.add(move.segmentId);
      movedToNames.set(move.segmentId, move.targetName);
    }
  }

  // Filter out move-adjustment segments (note starts with "moved:")
  const visibleSegments = entry.segments.filter(
    (s) => !parseMoveNote(s.note),
  );

  // Only allow move on entries with 2+ non-moved segments (completed or running)
  const movableSegments = visibleSegments.filter(
    (s) => s.startedAt && !movedSegmentIds.has(s.id),
  );
  const canMoveBlocks = !isDeleted && movableSegments.length > 1;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-3" style={{ paddingLeft: '34px' }}>
        <div className="flex flex-col">
          {visibleSegments.map((segment, i) => (
            <BlockRow
              key={segment.id}
              segment={segment}
              isLast={i === visibleSegments.length - 1}
              canMove={canMoveBlocks}
              isMoved={movedSegmentIds.has(segment.id)}
              movedToName={movedToNames.get(segment.id)}
              onMove={() => onMoveBlock(segment.id)}
            />
          ))}
        </div>

        <DrawerFooter entry={entry} blockCount={visibleSegments.length} />
      </div>
    </motion.div>
  );
}
