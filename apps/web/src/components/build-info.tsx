import { ORG_TIMEZONE } from '@ternity/shared';
import { cn } from '@/lib/utils';

function formatBuildTime(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleString('en-GB', {
      timeZone: ORG_TIMEZONE,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(',', '');
}

const ENV_BADGE_COLORS: Record<string, string> = {
  local: 'bg-amber-500/15 text-amber-400',
  dev: 'bg-blue-400/15 text-blue-400',
  prod: 'bg-primary/15 text-primary',
};

export function BuildInfo({ className }: { className?: string }) {
  const envName = import.meta.env.VITE_ENV_NAME || 'unknown';
  const badgeColor = ENV_BADGE_COLORS[envName] ?? 'bg-muted text-muted-foreground';

  return (
    <div
      className={cn('flex items-baseline justify-center gap-1.5 font-brand', className)}
      style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))' }}
    >
      <span className={cn('shrink-0 rounded px-1.5 py-px font-semibold uppercase', badgeColor)}>
        {envName}
      </span>
      <span className="shrink-0 font-semibold text-muted-foreground/50">{__APP_VERSION__}</span>
      <span className="shrink-0 whitespace-nowrap text-muted-foreground/30">
        {formatBuildTime(__BUILD_TIME__)}
      </span>
    </div>
  );
}
