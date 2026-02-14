import type { Table } from '@tanstack/react-table';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

interface DataTableBulkActionsProps<TData> {
  table: Table<TData>;
  entityName?: string;
  children: React.ReactNode;
}

export function DataTableBulkActions<TData>({
  table,
  entityName = 'row',
  children,
}: DataTableBulkActionsProps<TData>) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  if (selectedCount === 0) return null;

  const plural = selectedCount === 1 ? entityName : `${entityName}s`;

  return (
    <div
      className={cn(
        'fixed bottom-7 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2',
        'rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-xl',
      )}
    >
      <span
        className="whitespace-nowrap px-2 font-brand font-medium text-foreground"
        style={{ fontSize: scaled(12), letterSpacing: '0.5px' }}
      >
        {selectedCount} {plural} selected
      </span>
      <div className="h-6 w-px bg-border" />
      {children}
      <div className="h-6 w-px bg-border" />
      <button
        onClick={() => table.toggleAllRowsSelected(false)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
