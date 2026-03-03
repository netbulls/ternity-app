import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { scaled } from '@/lib/scaled';
import type { ProjectMemberRow } from '@ternity/shared';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

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
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.displayName}
                className="h-8 w-8 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]"
                style={{ fontSize: '11px' }}
              >
                {getInitials(member.displayName)}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
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
          <select
            value={member.assigned ? member.role : 'user'}
            disabled={!member.assigned}
            onChange={(e) => opts.onRoleChange(member, e.target.value)}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary disabled:cursor-not-allowed disabled:opacity-30"
            style={{ fontSize: scaled(11) }}
          >
            <option value="user">Member</option>
            <option value="manager">Manager</option>
          </select>
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
