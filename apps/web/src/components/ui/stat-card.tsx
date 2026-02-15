import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  accent?: boolean;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  accent,
  onClick,
  selected,
  className,
}: StatCardProps) {
  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={cn(
        'p-3.5 text-left',
        onClick && 'cursor-pointer transition-colors hover:border-border',
        selected && 'border-primary',
        className,
      )}
    >
      <div
        className="font-brand uppercase text-muted-foreground"
        style={{ fontSize: scaled(10), letterSpacing: '2px' }}
      >
        {label}
      </div>
      <div
        className={cn('mt-1 font-brand', accent ? 'text-primary' : 'text-foreground')}
        style={{ fontSize: scaled(22), fontWeight: 700 }}
      >
        {value}
      </div>
      {subtitle && (
        <div
          className="mt-0.5 text-[hsl(var(--t-text-muted))]"
          style={{ fontSize: scaled(10) }}
        >
          {subtitle}
        </div>
      )}
    </Card>
  );
}
