import { useNavigate } from 'react-router-dom';
import { scaled } from '@/lib/scaled';
import type { DashboardData } from '@ternity/shared';

interface AttentionCardsProps {
  attention: DashboardData['attention'];
}

export function AttentionCards({ attention }: AttentionCardsProps) {
  const navigate = useNavigate();

  const weekFormatted = formatHM(attention.weekTotalSeconds);
  const lowDayFormatted = attention.lowDay
    ? formatHM(attention.lowDay.totalSeconds)
    : null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* No Project */}
      <button
        onClick={() => navigate('/')}
        className="cursor-pointer rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] p-3.5 text-left transition-colors hover:border-[hsl(var(--primary)/0.3)]"
        style={{ borderLeft: '3px solid hsl(35, 100%, 60%)' }}
      >
        <div
          className="font-brand uppercase tracking-[1.5px] text-muted-foreground"
          style={{ fontSize: scaled(9), marginBottom: scaled(6) }}
        >
          No Project
        </div>
        <div
          className="font-brand font-bold tabular-nums"
          style={{ fontSize: scaled(20), color: 'hsl(35, 100%, 60%)' }}
        >
          {attention.noProjectCount}
        </div>
        <div
          className="text-muted-foreground"
          style={{ fontSize: scaled(10), marginTop: scaled(4) }}
        >
          entries this week without a project
        </div>
        <div
          className="text-[hsl(var(--primary))] underline underline-offset-2"
          style={{ fontSize: scaled(10), marginTop: scaled(8) }}
        >
          Fix in entries →
        </div>
      </button>

      {/* This Week */}
      <button
        onClick={() => navigate('/')}
        className="cursor-pointer rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] p-3.5 text-left transition-colors hover:border-[hsl(var(--primary)/0.3)]"
        style={{ borderLeft: '3px solid hsl(152, 60%, 50%)' }}
      >
        <div
          className="font-brand uppercase tracking-[1.5px] text-muted-foreground"
          style={{ fontSize: scaled(9), marginBottom: scaled(6) }}
        >
          This Week
        </div>
        <div
          className="font-brand font-bold tabular-nums"
          style={{ fontSize: scaled(20), color: 'hsl(152, 60%, 50%)' }}
        >
          {weekFormatted}
        </div>
        <div
          className="text-muted-foreground"
          style={{ fontSize: scaled(10), marginTop: scaled(4) }}
        >
          of 40h target ({attention.weekPercentage}%)
        </div>
        <div
          className="text-[hsl(var(--primary))] underline underline-offset-2"
          style={{ fontSize: scaled(10), marginTop: scaled(8) }}
        >
          View entries →
        </div>
      </button>

      {/* Low Day */}
      <button
        onClick={() => navigate('/')}
        className="cursor-pointer rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] p-3.5 text-left transition-colors hover:border-[hsl(var(--primary)/0.3)]"
        style={{ borderLeft: '3px solid hsl(var(--primary))' }}
      >
        <div
          className="font-brand uppercase tracking-[1.5px] text-muted-foreground"
          style={{ fontSize: scaled(9), marginBottom: scaled(6) }}
        >
          Low Day
        </div>
        <div
          className="font-brand font-bold tabular-nums text-foreground"
          style={{ fontSize: scaled(20) }}
        >
          {attention.lowDay?.dayLabel ?? '—'}
        </div>
        <div
          className="text-muted-foreground"
          style={{ fontSize: scaled(10), marginTop: scaled(4) }}
        >
          {attention.lowDay
            ? `only ${lowDayFormatted} logged`
            : 'no entries yet'}
        </div>
        <div
          className="text-[hsl(var(--primary))] underline underline-offset-2"
          style={{ fontSize: scaled(10), marginTop: scaled(8) }}
        >
          {attention.lowDay
            ? `Check ${attention.lowDay.dayLabel} →`
            : 'View entries →'}
        </div>
      </button>
    </div>
  );
}

/** Format seconds as "H:MM" (compact, no leading zero for hours) */
function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}
