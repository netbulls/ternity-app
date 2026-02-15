import type { Column } from '@tanstack/react-table';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <span
        className={cn('font-brand', className)}
        style={{ fontSize: scaled(11), fontWeight: 600, letterSpacing: '0.5px' }}
      >
        {title}
      </span>
    );
  }

  return (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center gap-1 font-brand text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
      style={{ fontSize: scaled(11), fontWeight: 600, letterSpacing: '0.5px' }}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {title}
      {column.getIsSorted() === 'asc' && <ArrowUp className="h-3 w-3 text-primary" />}
      {column.getIsSorted() === 'desc' && <ArrowDown className="h-3 w-3 text-primary" />}
    </button>
  );
}
