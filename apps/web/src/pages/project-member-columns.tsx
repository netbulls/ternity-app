import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { SelectPopover } from '@/components/ui/select-popover';
import { scaled } from '@/lib/scaled';
import { UserAvatar } from '@/components/ui/user-avatar';
import type { ProjectMemberRow } from '@ternity/shared';

export function getProjectMemberColumns(opts: {
  onToggleAssign: (row: ProjectMemberRow) => void;
  onRoleChange: (row: ProjectMemberRow, role: string) => void;
}): ColumnDef<ProjectMemberRow>[] {
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
        const member = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <UserAvatar user={member} size="md" />
            <div className="flex flex-col">
              <span className="font-medium text-foreground" style={{ fontSize: scaled(12) }}>
                {member.displayName}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                {member.email || '\u00A0'}
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

    // Role (dropdown, only enabled when assigned)
    {
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => {
        const member = row.original;
        return (
          <SelectPopover
            value={member.assigned ? member.role : 'user'}
            onChange={(v) => opts.onRoleChange(member, v)}
            items={[
              { value: 'user', label: 'Member' },
              { value: 'manager', label: 'Manager' },
            ]}
            disabled={!member.assigned}
            compact
          />
        );
      },
    },

    // Assigned (toggle switch)
    {
      id: 'assigned',
      accessorKey: 'assigned',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned" />,
      cell: ({ row }) => {
        const member = row.original;
        return (
          <Switch checked={member.assigned} onCheckedChange={() => opts.onToggleAssign(member)} />
        );
      },
    },
  ];
}
