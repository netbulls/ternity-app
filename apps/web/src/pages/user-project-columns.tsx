import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { SelectPopover } from '@/components/ui/select-popover';
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
          <SelectPopover
            value={project.assigned ? project.role : 'user'}
            onChange={(v) => opts.onRoleChange(project, v)}
            items={[
              { value: 'user', label: 'Member' },
              { value: 'manager', label: 'Manager' },
            ]}
            disabled={!project.assigned}
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
        const project = row.original;
        return (
          <Switch checked={project.assigned} onCheckedChange={() => opts.onToggleAssign(project)} />
        );
      },
    },
  ];
}
