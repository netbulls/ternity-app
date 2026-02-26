import { Calendar, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { formatDateRange, formatDuration } from '@/lib/format';
import { scaled } from '@/lib/scaled';

export type DateView = 'day' | 'week';

interface Props {
  view: DateView;
  onViewChange: (view: DateView) => void;
  from: string;
  to: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  totalSeconds: number;
  onlyIncomplete?: boolean;
  onToggleIncomplete?: () => void;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
}

export function DateNavBar({
  view,
  onViewChange,
  from,
  to,
  onPrev,
  onNext,
  onToday,
  totalSeconds,
  onlyIncomplete,
  onToggleIncomplete,
  showDeleted,
  onToggleDeleted,
}: Props) {
  const label = formatDateRange(from, to);

  return (
    <div className="mb-4 flex items-center gap-3">
      {/* Day / Week toggle */}
      <div className="flex overflow-hidden rounded-md border border-border">
        <ToggleButton
          active={view === 'day'}
          onClick={() => onViewChange('day')}
        >
          Day
        </ToggleButton>
        <ToggleButton
          active={view === 'week'}
          onClick={() => onViewChange('week')}
        >
          Week
        </ToggleButton>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-1">
        <NavButton onClick={onPrev} aria-label="Previous">
          <ChevronLeft className="h-3.5 w-3.5" />
        </NavButton>

        <button
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent"
          style={{ fontSize: scaled(12) }}
          onClick={onToday}
          title="Go to today"
        >
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-brand font-semibold tracking-wide">
            {label}
          </span>
        </button>

        <NavButton onClick={onNext} aria-label="Next">
          <ChevronRight className="h-3.5 w-3.5" />
        </NavButton>
      </div>

      {/* Incomplete filter */}
      {onToggleIncomplete && (
        <button
          className={cn(
            'rounded-md px-2.5 py-1 font-brand text-[11px] font-semibold uppercase tracking-wider transition-colors',
            onlyIncomplete
              ? 'bg-amber-500/10 text-amber-500'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={onToggleIncomplete}
        >
          Incomplete
        </button>
      )}

      {/* Deleted filter */}
      {onToggleDeleted && (
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-brand text-[11px] font-semibold uppercase tracking-wider transition-colors',
            showDeleted
              ? 'bg-destructive/10 text-destructive'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={onToggleDeleted}
        >
          <Trash2 className="h-3 w-3" />
          Deleted
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Period total */}
      <div className={cn('flex items-center gap-2', showDeleted && 'opacity-40')}>
        <span
          className="font-brand text-muted-foreground uppercase"
          style={{ fontSize: scaled(9), letterSpacing: '1.5px' }}
        >
          Total
        </span>
        <motion.span
          key={totalSeconds}
          initial={{ opacity: 0.5, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="font-brand text-sm font-bold tabular-nums text-foreground"
        >
          {formatDuration(totalSeconds)}
        </motion.span>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        'relative px-3 py-1 font-brand text-[11px] font-semibold uppercase tracking-wider transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NavButton({
  onClick,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
