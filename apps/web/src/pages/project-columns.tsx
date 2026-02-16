import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, CheckCircle2, XCircle, Building2 } from 'lucide-react';
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
import { formatNumber } from '@/lib/format';
import type { AdminProject, AdminClient } from '@/hooks/use-admin-projects';

// ── Project Columns ─────────────────────────────────────────────────────

export function getProjectColumns(opts: {
  onEdit: (project: AdminProject) => void;
  onActivate: (project: AdminProject) => void;
  onDeactivate: (project: AdminProject) => void;
  onClientClick?: (clientId: string, clientName: string) => void;
  showClient?: boolean;
}): ColumnDef<AdminProject>[] {
  const cols: ColumnDef<AdminProject>[] = [
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
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Project" />,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded"
              style={{ backgroundColor: project.color }}
            />
            <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              {project.name}
            </span>
          </div>
        );
      },
    },
  ];

  // Client column (optional — hidden in drill-down view)
  if (opts.showClient !== false) {
    cols.push({
      accessorKey: 'clientName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
      cell: ({ row }) => {
        const project = row.original;
        return opts.onClientClick ? (
          <button
            onClick={() => opts.onClientClick!(project.clientId, project.clientName)}
            className="text-primary hover:underline"
            style={{ fontSize: scaled(13) }}
          >
            {project.clientName}
          </button>
        ) : (
          <span className="text-muted-foreground" style={{ fontSize: scaled(13) }}>
            {project.clientName}
          </span>
        );
      },
    });
  }

  cols.push(
    // Status
    {
      accessorKey: 'isActive',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) =>
        row.original.isActive ? (
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
        const project = row.original;
        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuItem onClick={() => opts.onEdit(project)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {project.isActive ? (
                  <DropdownMenuItem
                    onClick={() => opts.onDeactivate(project)}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="mr-2 h-3.5 w-3.5" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => opts.onActivate(project)}>
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
  );

  return cols;
}

// ── Client Columns ──────────────────────────────────────────────────────

export function getClientColumns(opts: {
  onRename: (client: AdminClient) => void;
  onActivate: (client: AdminClient) => void;
  onDeactivate: (client: AdminClient) => void;
  onClientClick: (client: AdminClient) => void;
}): ColumnDef<AdminClient>[] {
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

    // Client (building icon + name)
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
      cell: ({ row }) => {
        const client = row.original;
        return (
          <button
            onClick={() => opts.onClientClick(client)}
            className="flex items-center gap-2.5 text-left hover:text-primary"
          >
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              {client.name}
            </span>
          </button>
        );
      },
    },

    // Status
    {
      accessorKey: 'isActive',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) =>
        row.original.isActive ? (
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

    // Projects count
    {
      accessorKey: 'projectCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Projects" className="justify-end" />
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            'block text-right font-brand font-semibold',
            row.original.projectCount === 0 && 'opacity-30',
          )}
          style={{ fontSize: scaled(13), letterSpacing: '0.5px' }}
        >
          {formatNumber(row.original.projectCount)}
        </span>
      ),
    },

    // Entries count
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
        const client = row.original;
        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuItem onClick={() => opts.onRename(client)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {client.isActive ? (
                  <DropdownMenuItem
                    onClick={() => opts.onDeactivate(client)}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="mr-2 h-3.5 w-3.5" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => opts.onActivate(client)}>
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
