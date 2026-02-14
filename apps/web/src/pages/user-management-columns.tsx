import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, UserCheck, UserX, List } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatRelativeTime, formatNumber } from '@/lib/format';
import type { AdminUser } from '@/hooks/use-admin-users';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getUserColumns(opts: {
  onActivate: (user: AdminUser) => void;
  onDeactivate: (user: AdminUser) => void;
}): ColumnDef<AdminUser>[] {
  return [
    // Select
    {
      id: 'select',
      size: 40,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? 'indeterminate'
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
    },

    // User (name + email)
    {
      accessorKey: 'displayName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]"
              style={{ fontSize: '11px' }}
            >
              {getInitials(user.displayName)}
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
                {user.displayName}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                {user.email || '\u00A0'}
              </span>
            </div>
          </div>
        );
      },
    },

    // Status
    {
      accessorKey: 'active',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) =>
        row.original.active ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(152_60%_50%/0.12)] px-2 py-0.5 font-medium text-[hsl(152,60%,50%)]"
            style={{ fontSize: scaled(11) }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(152,60%,50%)]" />
            Active
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 font-medium text-muted-foreground"
            style={{ fontSize: scaled(11) }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground opacity-50" />
            Inactive
          </span>
        ),
    },

    // Role
    {
      accessorKey: 'globalRole',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => (
        <span
          className="rounded-full border border-border px-2 py-0.5 font-medium text-muted-foreground"
          style={{ fontSize: scaled(10) }}
        >
          {row.original.globalRole === 'admin' ? 'Admin' : 'User'}
        </span>
      ),
    },

    // Last Active
    {
      accessorKey: 'lastEntryAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Active" />,
      sortingFn: (rowA, rowB, columnId) => {
        const a = rowA.getValue<string | null>(columnId);
        const b = rowB.getValue<string | null>(columnId);
        const aTime = a ? new Date(a).getTime() : 0;
        const bTime = b ? new Date(b).getTime() : 0;
        return aTime - bTime;
      },
      cell: ({ row }) => {
        const val = row.original.lastEntryAt;
        return val ? (
          <span className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
            {formatRelativeTime(val)}
          </span>
        ) : (
          <span
            className="italic text-muted-foreground opacity-40"
            style={{ fontSize: scaled(12) }}
          >
            Never
          </span>
        );
      },
    },

    // Entries
    {
      accessorKey: 'entryCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Entries" className="justify-end" />
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            'block text-right font-brand font-semibold',
            row.original.entryCount === 0 && 'opacity-30',
          )}
          style={{ fontSize: scaled(13), letterSpacing: '0.5px' }}
        >
          {formatNumber(row.original.entryCount)}
        </span>
      ),
    },

    // Actions
    {
      id: 'actions',
      size: 44,
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                {user.active ? (
                  <DropdownMenuItem
                    onClick={() => opts.onDeactivate(user)}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserX className="mr-2 h-3.5 w-3.5" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => opts.onActivate(user)}>
                    <UserCheck className="mr-2 h-3.5 w-3.5" />
                    Activate
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => window.open(`/entries?userId=${user.id}`, '_self')}
                >
                  <List className="mr-2 h-3.5 w-3.5" />
                  View entries
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
