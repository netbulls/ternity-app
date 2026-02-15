import type { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  entityName?: string;
  suffix?: string;
}

export function DataTablePagination<TData>({
  table,
  entityName = 'row',
  suffix,
}: DataTablePaginationProps<TData>) {
  const totalRows = table.getFilteredRowModel().rows.length;
  if (totalRows === 0) return null;

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();

  const showingFrom = pageIndex * pageSize + 1;
  const showingTo = Math.min((pageIndex + 1) * pageSize, totalRows);

  const plural = totalRows === 1 ? entityName : `${entityName}s`;

  return (
    <div className="flex min-h-12 items-center justify-between border-t border-border bg-muted/15 px-3.5 py-2.5">
      <span className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
        Showing {showingFrom}–{showingTo} of {totalRows} {plural}
        {suffix && ` ${suffix}`}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors',
              !table.getCanPreviousPage()
                ? 'opacity-30'
                : 'hover:bg-muted/30 hover:text-foreground',
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {Array.from({ length: pageCount }, (_, i) => {
            // Show first, last, and pages within ±1 of current
            if (
              i === 0 ||
              i === pageCount - 1 ||
              (i >= pageIndex - 1 && i <= pageIndex + 1)
            ) {
              return (
                <button
                  key={i}
                  onClick={() => table.setPageIndex(i)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors',
                    i === pageIndex
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                  )}
                >
                  {i + 1}
                </button>
              );
            }
            // Show ellipsis
            if (i === pageIndex - 2 || i === pageIndex + 2) {
              return (
                <span
                  key={i}
                  className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground"
                >
                  ...
                </span>
              );
            }
            return null;
          })}
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors',
              !table.getCanNextPage()
                ? 'opacity-30'
                : 'hover:bg-muted/30 hover:text-foreground',
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
