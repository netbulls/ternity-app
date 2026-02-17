import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  type RowSelectionState,
  type Table as TanStackTable,
} from '@tanstack/react-table';
import {
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  X,
  ArrowLeft,
  Building2,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatNumber } from '@/lib/format';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableBulkActions } from '@/components/ui/data-table-bulk-actions';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useAdminProjects,
  useAdminClients,
  useActivateProject,
  useDeactivateProject,
  useBulkActivateProjects,
  useBulkDeactivateProjects,
  useActivateClient,
  useDeactivateClient,
  useBulkActivateClients,
  useBulkDeactivateClients,
  useUpdateClient,
  type AdminProject,
  type AdminClient,
} from '@/hooks/use-admin-projects';
import { getProjectColumns, getClientColumns } from '@/pages/project-columns';
import { ProjectDialog } from '@/pages/project-dialog';
import { Input } from '@/components/ui/input';

type Scope = 'projects' | 'clients';
type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 15;

export function ProjectsPage() {
  // ── Top-level state ─────────────────────────────────────────────────
  const [scope, setScope] = useState<Scope>('projects');
  const [drilldownClient, setDrilldownClient] = useState<AdminClient | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Dialog state
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AdminProject | null>(null);
  const [renameClientDialog, setRenameClientDialog] = useState<AdminClient | null>(null);
  const [renameClientName, setRenameClientName] = useState('');

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'project' | 'client';
    action: 'deactivate';
    ids: string[];
    names: string[];
    affectedProjects?: AdminProject[];
  } | null>(null);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // ── Data ────────────────────────────────────────────────────────────
  const { data: allProjects, isLoading: projectsLoading } = useAdminProjects();
  const { data: allClients, isLoading: clientsLoading } = useAdminClients();

  // Mutations
  const activateProject = useActivateProject();
  const deactivateProject = useDeactivateProject();
  const bulkActivateProjects = useBulkActivateProjects();
  const bulkDeactivateProjects = useBulkDeactivateProjects();
  const activateClient = useActivateClient();
  const deactivateClient = useDeactivateClient();
  const bulkActivateClients = useBulkActivateClients();
  const bulkDeactivateClients = useBulkDeactivateClients();
  const updateClient = useUpdateClient();

  // ── Search debounce ─────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  // Reset selection when filters change
  useEffect(() => {
    setRowSelection({});
  }, [statusFilter, debouncedSearch, scope, drilldownClient]);

  // ── Stats ───────────────────────────────────────────────────────────
  const projectStats = useMemo(() => {
    if (!allProjects) return { total: 0, active: 0, inactive: 0 };
    const items = drilldownClient
      ? allProjects.filter((p) => p.clientId === drilldownClient.id)
      : allProjects;
    const total = items.length;
    const active = items.filter((p) => p.isActive).length;
    return { total, active, inactive: total - active };
  }, [allProjects, drilldownClient]);

  const clientStats = useMemo(() => {
    if (!allClients) return { total: 0, active: 0, inactive: 0 };
    const total = allClients.length;
    const active = allClients.filter((c) => c.isActive).length;
    return { total, active, inactive: total - active };
  }, [allClients]);

  const stats = scope === 'projects' || drilldownClient ? projectStats : clientStats;

  // ── Filtered data ───────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!allProjects) return [];
    let items = allProjects;
    if (drilldownClient) {
      items = items.filter((p) => p.clientId === drilldownClient.id);
    }
    if (statusFilter !== 'all') {
      items = items.filter((p) => (statusFilter === 'active' ? p.isActive : !p.isActive));
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q),
      );
    }
    return items;
  }, [allProjects, statusFilter, debouncedSearch, drilldownClient]);

  const filteredClients = useMemo(() => {
    if (!allClients) return [];
    let items = allClients;
    if (statusFilter !== 'all') {
      items = items.filter((c) => (statusFilter === 'active' ? c.isActive : !c.isActive));
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter((c) => c.name.toLowerCase().includes(q));
    }
    return items;
  }, [allClients, statusFilter, debouncedSearch]);

  // ── Project actions ─────────────────────────────────────────────────
  const handleEditProject = useCallback((project: AdminProject) => {
    setEditingProject(project);
    setProjectDialogOpen(true);
  }, []);

  const handleActivateProject = useCallback(
    (project: AdminProject) => activateProject.mutate(project.id),
    [activateProject],
  );

  const handleDeactivateProject = useCallback((project: AdminProject) => {
    setConfirmDialog({
      type: 'project',
      action: 'deactivate',
      ids: [project.id],
      names: [project.name],
    });
  }, []);

  const handleClientClick = useCallback(
    (clientId: string, _clientName: string) => {
      const client = allClients?.find((c) => c.id === clientId);
      if (client) {
        setDrilldownClient(client);
        setScope('projects');
        setStatusFilter('active');
        setSearchQuery('');
        setDebouncedSearch('');
      }
    },
    [allClients],
  );

  // ── Client actions ──────────────────────────────────────────────────
  const handleClientDrilldown = useCallback((client: AdminClient) => {
    setDrilldownClient(client);
    setScope('projects');
    setStatusFilter('active');
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

  const handleRenameClient = useCallback((client: AdminClient) => {
    setRenameClientDialog(client);
    setRenameClientName(client.name);
  }, []);

  const handleActivateClient = useCallback(
    (client: AdminClient) => activateClient.mutate(client.id),
    [activateClient],
  );

  const handleDeactivateClient = useCallback(
    (client: AdminClient) => {
      const affected = allProjects?.filter(
        (p) => p.clientId === client.id && p.isActive,
      ) ?? [];
      setConfirmDialog({
        type: 'client',
        action: 'deactivate',
        ids: [client.id],
        names: [client.name],
        affectedProjects: affected,
      });
    },
    [allProjects],
  );

  // ── Column definitions ──────────────────────────────────────────────
  const projectColumns = useMemo(
    () =>
      getProjectColumns({
        onEdit: handleEditProject,
        onActivate: handleActivateProject,
        onDeactivate: handleDeactivateProject,
        onClientClick: drilldownClient ? undefined : handleClientClick,
        showClient: !drilldownClient,
      }),
    [handleEditProject, handleActivateProject, handleDeactivateProject, handleClientClick, drilldownClient],
  );

  const clientColumns = useMemo(
    () =>
      getClientColumns({
        onRename: handleRenameClient,
        onActivate: handleActivateClient,
        onDeactivate: handleDeactivateClient,
        onClientClick: handleClientDrilldown,
      }),
    [handleRenameClient, handleActivateClient, handleDeactivateClient, handleClientDrilldown],
  );

  // ── Table instances ─────────────────────────────────────────────────
  const projectTable = useReactTable({
    data: filteredProjects,
    columns: projectColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const clientTable = useReactTable({
    data: filteredClients,
    columns: clientColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  // Cast to unknown table type for bulk actions (which only reads selection state)
  const activeTable = (scope === 'clients' && !drilldownClient ? clientTable : projectTable) as TanStackTable<unknown>;

  // ── Selection ───────────────────────────────────────────────────────
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const clearSelection = useCallback(() => setRowSelection({}), []);

  // ── Bulk actions ────────────────────────────────────────────────────
  const handleBulkActivate = useCallback(() => {
    if (scope === 'clients' && !drilldownClient) {
      bulkActivateClients.mutate(selectedIds, { onSuccess: () => clearSelection() });
    } else {
      bulkActivateProjects.mutate(selectedIds, { onSuccess: () => clearSelection() });
    }
  }, [scope, drilldownClient, selectedIds, bulkActivateProjects, bulkActivateClients, clearSelection]);

  const handleBulkDeactivate = useCallback(() => {
    if (scope === 'clients' && !drilldownClient) {
      const names = allClients
        ?.filter((c) => selectedIds.includes(c.id))
        .map((c) => c.name) ?? [];
      const affected = allProjects?.filter(
        (p) => selectedIds.includes(p.clientId) && p.isActive,
      ) ?? [];
      setConfirmDialog({
        type: 'client',
        action: 'deactivate',
        ids: selectedIds,
        names,
        affectedProjects: affected,
      });
    } else {
      const names = (drilldownClient ? filteredProjects : allProjects ?? [])
        .filter((p) => selectedIds.includes(p.id))
        .map((p) => p.name);
      setConfirmDialog({
        type: 'project',
        action: 'deactivate',
        ids: selectedIds,
        names,
      });
    }
  }, [scope, drilldownClient, selectedIds, allClients, allProjects, filteredProjects]);

  // ── Confirm execution ───────────────────────────────────────────────
  const executeConfirm = useCallback(() => {
    if (!confirmDialog) return;
    const { type, ids } = confirmDialog;
    const onSettled = () => {
      clearSelection();
      setConfirmDialog(null);
    };

    if (type === 'project') {
      if (ids.length === 1) {
        deactivateProject.mutate(ids[0]!, { onSettled });
      } else {
        bulkDeactivateProjects.mutate(ids, { onSettled });
      }
    } else {
      if (ids.length === 1) {
        deactivateClient.mutate(ids[0]!, { onSettled });
      } else {
        bulkDeactivateClients.mutate(ids, { onSettled });
      }
    }
  }, [confirmDialog, deactivateProject, bulkDeactivateProjects, deactivateClient, bulkDeactivateClients, clearSelection]);

  // ── Scope/drill-down navigation ─────────────────────────────────────
  const handleScopeChange = useCallback(
    (newScope: Scope) => {
      setScope(newScope);
      setDrilldownClient(null);
      setStatusFilter('active');
      setSearchQuery('');
      setDebouncedSearch('');
      setRowSelection({});
    },
    [],
  );

  const handleBackFromDrilldown = useCallback(() => {
    setDrilldownClient(null);
    setStatusFilter('active');
    setSearchQuery('');
    setDebouncedSearch('');
    setRowSelection({});
  }, []);

  // ── Rename client submit ────────────────────────────────────────────
  const handleRenameSubmit = useCallback(() => {
    if (!renameClientDialog || !renameClientName.trim()) return;
    updateClient.mutate(
      { id: renameClientDialog.id, name: renameClientName.trim() },
      {
        onSuccess: () => {
          setRenameClientDialog(null);
          // Update drilldown client name if it was renamed
          if (drilldownClient?.id === renameClientDialog.id) {
            setDrilldownClient((prev) =>
              prev ? { ...prev, name: renameClientName.trim() } : null,
            );
          }
        },
      },
    );
  }, [renameClientDialog, renameClientName, updateClient, drilldownClient]);

  const isLoading = scope === 'clients' && !drilldownClient ? clientsLoading : projectsLoading;
  const entityName = scope === 'clients' && !drilldownClient ? 'client' : 'project';

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          {drilldownClient ? (
            <>
              <button
                onClick={handleBackFromDrilldown}
                className="mb-1 flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                style={{ fontSize: scaled(12) }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Projects
              </button>
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <h1
                  className="font-brand font-semibold tracking-wide text-foreground"
                  style={{ fontSize: scaled(18) }}
                >
                  {drilldownClient.name}
                </h1>
                {!drilldownClient.isActive && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 font-medium text-muted-foreground"
                    style={{ fontSize: scaled(11) }}
                  >
                    Inactive
                  </span>
                )}
                <button
                  onClick={() => handleRenameClient(drilldownClient)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  title="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <p
                className="mt-0.5 text-muted-foreground"
                style={{ fontSize: scaled(12) }}
              >
                {drilldownClient.activeProjectCount} active project{drilldownClient.activeProjectCount === 1 ? '' : 's'} · {formatNumber(drilldownClient.entryCount)} entries
              </p>
            </>
          ) : (
            <>
              <h1
                className="font-brand font-semibold tracking-wide text-foreground"
                style={{ fontSize: scaled(18) }}
              >
                Projects
              </h1>
              <p
                className="mt-0.5 text-muted-foreground"
                style={{ fontSize: scaled(12) }}
              >
                Manage clients and projects
              </p>
            </>
          )}
        </div>

        {/* Create button */}
        {(scope === 'projects' || drilldownClient) && (
          <Button
            size="sm"
            onClick={() => {
              setEditingProject(null);
              setProjectDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Scope Tabs (only when not in drill-down) */}
      {!drilldownClient && (
        <div className="mb-4 flex gap-1">
          {(['projects', 'clients'] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => handleScopeChange(s)}
              className={cn(
                'rounded-md px-3 py-1.5 font-brand text-muted-foreground transition-colors',
                scope === s
                  ? 'bg-primary/[0.08] font-semibold text-foreground'
                  : 'hover:bg-muted/30',
              )}
              style={{ fontSize: scaled(12), letterSpacing: '0.5px' }}
            >
              {s === 'projects' ? 'Projects' : 'Clients'}
            </button>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard
          label="Active"
          value={stats.active}
          subtitle={scope === 'clients' && !drilldownClient ? 'visible in pickers' : 'visible in pickers'}
          accent
          onClick={() => setStatusFilter('active')}
          selected={statusFilter === 'active'}
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          subtitle="hidden from pickers"
          onClick={() => setStatusFilter('inactive')}
          selected={statusFilter === 'inactive'}
        />
        <StatCard
          label={scope === 'clients' && !drilldownClient ? 'All Clients' : 'All Projects'}
          value={stats.total}
          subtitle="total in system"
          onClick={() => setStatusFilter('all')}
          selected={statusFilter === 'all'}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        {/* Search */}
        <div className="flex max-w-[280px] flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-[7px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            placeholder={
              scope === 'clients' && !drilldownClient
                ? 'Search clients...'
                : 'Search projects...'
            }
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontFamily: "'Inter', sans-serif", fontSize: scaled(12), border: 'none' }}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex overflow-hidden rounded-md border border-border">
          {(['active', 'inactive', 'all'] as StatusFilter[]).map((tab) => {
            const label = tab === 'all' ? 'All' : tab === 'active' ? 'Active' : 'Inactive';
            const count =
              tab === 'all' ? stats.total : tab === 'active' ? stats.active : stats.inactive;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  'font-brand min-w-[5.5rem] border-r border-border px-3 py-1.5 text-center text-muted-foreground transition-colors last:border-r-0',
                  statusFilter === tab
                    ? 'bg-primary/[0.08] font-semibold text-foreground'
                    : 'hover:bg-muted/30',
                )}
                style={{
                  fontSize: scaled(11),
                  fontWeight: statusFilter === tab ? 600 : 500,
                  letterSpacing: '0.5px',
                }}
              >
                {label}
                <span
                  className="ml-1 inline-block min-w-[1.25rem] rounded-full bg-muted/50 px-1.5 py-px font-brand text-muted-foreground"
                  style={{ fontSize: scaled(10) }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Table */}
      {scope === 'clients' && !drilldownClient ? (
        <DataTable
          columns={clientColumns}
          data={filteredClients}
          table={clientTable}
          isLoading={isLoading}
          emptyMessage="No clients found"
          entityName="client"
          pageSize={PAGE_SIZE}
          paginationSuffix={statusFilter !== 'all' ? `(${statusFilter})` : undefined}
          rowClassName={(client) =>
            cn(
              !client.isActive && 'opacity-50 hover:opacity-70',
              rowSelection[client.id] && 'bg-primary/5 opacity-100',
            )
          }
        />
      ) : (
        <DataTable
          columns={projectColumns}
          data={filteredProjects}
          table={projectTable}
          isLoading={isLoading}
          emptyMessage="No projects found"
          entityName="project"
          pageSize={PAGE_SIZE}
          paginationSuffix={statusFilter !== 'all' ? `(${statusFilter})` : undefined}
          rowClassName={(project) =>
            cn(
              !project.isActive && 'opacity-50 hover:opacity-70',
              rowSelection[project.id] && 'bg-primary/5 opacity-100',
            )
          }
        />
      )}

      {/* Bulk Action Bar */}
      <DataTableBulkActions table={activeTable} entityName={entityName}>
        <button
          onClick={handleBulkActivate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(152_60%_50%/0.12)] px-2.5 py-1.5 font-medium text-[hsl(152,60%,50%)] transition-colors hover:bg-[hsl(152_60%_50%/0.2)]"
          style={{ fontSize: scaled(12) }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Activate
        </button>
        <button
          onClick={handleBulkDeactivate}
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/20"
          style={{ fontSize: scaled(12) }}
        >
          <XCircle className="h-3.5 w-3.5" />
          Deactivate
        </button>
      </DataTableBulkActions>

      {/* Create/Edit Project Dialog */}
      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        project={editingProject}
      />

      {/* Rename Client Dialog */}
      <AlertDialog
        open={renameClientDialog !== null}
        onOpenChange={(open) => {
          if (!open) setRenameClientDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Client</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for {renameClientDialog?.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={renameClientName}
            onChange={(e) => setRenameClientName(e.target.value)}
            placeholder="Client name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRenameSubmit();
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleRenameSubmit}
              disabled={!renameClientName.trim() || updateClient.isPending}
            >
              {updateClient.isPending ? 'Saving...' : 'Rename'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivation Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {confirmDialog?.ids.length ?? 0}{' '}
              {confirmDialog?.type === 'client' ? 'client' : 'project'}
              {(confirmDialog?.ids.length ?? 0) === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {confirmDialog?.type === 'client' ? (
                  <>
                    <p>
                      Deactivating{' '}
                      {(confirmDialog?.ids.length ?? 0) === 1 ? 'this client' : 'these clients'}{' '}
                      will hide{' '}
                      {(confirmDialog?.ids.length ?? 0) === 1 ? 'it' : 'them'} and all their
                      projects from pickers.
                    </p>
                    {confirmDialog?.affectedProjects && confirmDialog.affectedProjects.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 font-medium text-foreground" style={{ fontSize: scaled(12) }}>
                          {confirmDialog.affectedProjects.length} active project
                          {confirmDialog.affectedProjects.length === 1 ? '' : 's'} will be hidden:
                        </p>
                        <div className="max-h-[120px] overflow-auto rounded-md border border-border p-2">
                          {confirmDialog.affectedProjects.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 py-0.5">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded"
                                style={{ backgroundColor: p.color }}
                              />
                              <span style={{ fontSize: scaled(12) }}>{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p>
                    This will hide{' '}
                    {(confirmDialog?.ids.length ?? 0) === 1 ? 'this project' : 'these projects'}{' '}
                    from all pickers:
                    <br />
                    <br />
                    <span className="font-medium text-foreground">
                      {confirmDialog?.names.join(', ')}
                    </span>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={executeConfirm}
              disabled={
                deactivateProject.isPending ||
                bulkDeactivateProjects.isPending ||
                deactivateClient.isPending ||
                bulkDeactivateClients.isPending
              }
            >
              Deactivate
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
