import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type Table as TanStackTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** External table instance — consumer manages state */
  table?: TanStackTable<TData>;
  isLoading?: boolean;
  emptyMessage?: string;
  showPagination?: boolean;
  entityName?: string;
  paginationSuffix?: string;
  pageSize?: number;
  rowClassName?: (row: TData) => string | undefined;
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  table: externalTable,
  isLoading,
  emptyMessage = 'No results',
  showPagination = true,
  entityName,
  paginationSuffix,
  pageSize = 10,
  rowClassName,
  className,
}: DataTableProps<TData, TValue>) {
  // Internal state — only used when no external table is provided
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const internalTable = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const table = externalTable ?? internalTable;
  const colCount = columns.length;

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      <Table className="border-collapse" style={{ fontSize: scaled(13) }}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="border-b border-border bg-muted/30 px-3.5 py-2.5"
                  style={header.column.getSize() !== 150 ? { width: header.column.getSize() } : undefined}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={colCount}
                className="py-12 text-center text-muted-foreground"
                style={{ fontSize: scaled(13) }}
              >
                Loading...
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={colCount}
                className="py-12 text-center text-muted-foreground"
                style={{ fontSize: scaled(13) }}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={cn(
                  'border-b border-border/50 last:border-b-0 hover:bg-muted/30',
                  rowClassName?.(row.original),
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3.5 py-2.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {showPagination && !isLoading && table.getRowModel().rows.length > 0 && (
        <DataTablePagination
          table={table}
          entityName={entityName}
          suffix={paginationSuffix}
        />
      )}
    </div>
  );
}
