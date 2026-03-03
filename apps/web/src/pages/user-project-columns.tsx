import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { scaled } from '@/lib/scaled';
import type { UserProjectRow } from '@ternity/shared';

export function getUserProjectColumns(opts: {
  onToggleAssign: (row: UserProjectRow) => void;
  onRoleChange: (row: UserProjectRow, role: string) => void;
}): ColumnDef<UserProjectRow>[] {
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

    // Project (color swatch + name)
    {
      accessorKey: 'projectName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Project" />,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded"
              style={{ backgroundColor: project.projectColor }}
            />
            <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              {project.projectName}
            </span>
          </div>
        );
      },
    },

    // Client
    {
      accessorKey: 'clientName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
          {row.original.clientName || 'No client'}
        </span>
      ),
    },

    // Role (dropdown, only enabled when assigned)
    {
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <select
            value={project.assigned ? project.role : 'user'}
            disabled={!project.assigned}
            onChange={(e) => opts.onRoleChange(project, e.target.value)}
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
        const project = row.original;
        return (
          <Switch checked={project.assigned} onCheckedChange={() => opts.onToggleAssign(project)} />
        );
      },
    },
  ];
}
