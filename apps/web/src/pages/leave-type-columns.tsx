import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, CheckCircle2, XCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { SelectPopover } from '@/components/ui/select-popover';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import type { AdminLeaveType, LeaveTypeGroup, LeaveVisibility } from '@/hooks/use-leave';

export function getLeaveTypeColumns(opts: {
  groups: LeaveTypeGroup[];
  onEdit: (lt: AdminLeaveType) => void;
  onToggleActive: (lt: AdminLeaveType) => void;
  onChangeVisibility: (lt: AdminLeaveType, visibility: LeaveVisibility) => void;
  onChangeGroup: (lt: AdminLeaveType, groupId: string | null) => void;
}): ColumnDef<AdminLeaveType>[] {
  return [
    // Select
    {
      id: 'select',
      size: 40,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
    },

    // Name with color swatch
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      size: 220,
      cell: ({ row }) => {
        const lt = row.original;
        return (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: lt.color ?? '#6B7280' }}
            />
            <span className={cn('truncate', !lt.active && 'text-muted-foreground line-through')}>
              {lt.name}
            </span>
          </div>
        );
      },
    },

    // Group
    {
      accessorKey: 'groupId',
      header: 'Group',
      size: 180,
      cell: ({ row }) => {
        const lt = row.original;
        return (
          <SelectPopover
            value={lt.groupId ?? ''}
            onChange={(v) => opts.onChangeGroup(lt, v || null)}
            items={[
              { value: '', label: 'No group' },
              ...opts.groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
            placeholder="No group"
            compact
          />
        );
      },
    },

    // Active
    {
      accessorKey: 'active',
      header: 'Status',
      size: 100,
      cell: ({ row }) => {
        const lt = row.original;
        return lt.active ? (
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
        );
      },
    },

    // Visibility
    {
      accessorKey: 'visibility',
      header: 'Visibility',
      size: 150,
      cell: ({ row }) => {
        const lt = row.original;
        return (
          <SelectPopover
            value={lt.visibility}
            onChange={(v) => opts.onChangeVisibility(lt, v as LeaveVisibility)}
            items={[
              { value: 'all', label: 'All' },
              { value: 'contractor', label: 'B2B only' },
              { value: 'employee', label: 'Employee only' },
            ]}
            compact
          />
        );
      },
    },

    // Days per year
    {
      accessorKey: 'daysPerYear',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Days/Year" />,
      size: 90,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.daysPerYear}</span>
      ),
    },

    // Deducted
    {
      accessorKey: 'deducted',
      header: 'Deducted',
      size: 90,
      cell: ({ row }) => (
        <span className={row.original.deducted ? 'text-foreground' : 'text-muted-foreground'}>
          {row.original.deducted ? 'Yes' : 'No'}
        </span>
      ),
    },

    // Actions
    {
      id: 'actions',
      size: 44,
      enableSorting: false,
      cell: ({ row }) => {
        const lt = row.original;
        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuItem onClick={() => opts.onEdit(lt)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {lt.active ? (
                  <DropdownMenuItem
                    onClick={() => opts.onToggleActive(lt)}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="mr-2 h-3.5 w-3.5" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => opts.onToggleActive(lt)}>
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    Activate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

// ── Group Columns ────────────────────────────────────────────────────────

export function getGroupColumns(opts: {
  onRename: (group: LeaveTypeGroup) => void;
  onDelete: (group: LeaveTypeGroup) => void;
}): ColumnDef<LeaveTypeGroup>[] {
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

    // Group (color swatch + name)
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Group" />,
      cell: ({ row }) => {
        const group = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: group.color }}
            />
            <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              {group.name}
            </span>
          </div>
        );
      },
    },

    // Types count
    {
      accessorKey: 'typeCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Types" className="justify-end" />
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            'block text-right font-brand font-semibold',
            row.original.typeCount === 0 && 'opacity-30',
          )}
          style={{ fontSize: scaled(13), letterSpacing: '0.5px' }}
        >
          {row.original.typeCount}
        </span>
      ),
    },

    // Active types count
    {
      accessorKey: 'activeTypeCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Active" className="justify-end" />
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            'block text-right font-brand font-semibold',
            row.original.activeTypeCount === 0 && 'opacity-30',
          )}
          style={{ fontSize: scaled(13), letterSpacing: '0.5px' }}
        >
          {row.original.activeTypeCount}
        </span>
      ),
    },

    // Actions
    {
      id: 'actions',
      size: 44,
      enableSorting: false,
      cell: ({ row }) => {
        const group = row.original;
        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuItem onClick={() => opts.onRename(group)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => opts.onDelete(group)}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
