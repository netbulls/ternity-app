import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  type RowSelectionState,
  type Table as TanStackTable,
} from '@tanstack/react-table';
import { Search, X, UserCheck, UserX, ArrowLeft, FolderKanban, Plus, Minus } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { StatCard } from '@/components/ui/stat-card';
import {
  useAdminUsers,
  useActivateUser,
  useDeactivateUser,
  useBulkActivate,
  useBulkDeactivate,
  useUpdateEmploymentType,
  useUpdateTeam,
  type AdminUser,
  type EmploymentType,
} from '@/hooks/use-admin-users';
import {
  useUserProjects,
  useAssignUserProject,
  useRemoveUserProject,
  useUpdateUserProjectRole,
} from '@/hooks/use-admin-project-members';
import { useImpersonation } from '@/providers/impersonation-provider';
import { getUserColumns } from '@/pages/user-management-columns';
import { getUserProjectColumns } from '@/pages/user-project-columns';
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
import type { UserProjectRow } from '@ternity/shared';

type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 10;

export function UserManagementPage() {
  const navigate = useNavigate();
  const { canImpersonate, setTarget } = useImpersonation();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    action: 'activate' | 'deactivate';
    userIds: string[];
    names: string[];
  } | null>(null);

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: 'displayName', desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  // Reset selection when filter changes
  useEffect(() => {
    setRowSelection({});
  }, [statusFilter, debouncedSearch]);

  // ── Project drill-down state (V4 Inline Table) ──────────────────────
  const [drilldownUser, setDrilldownUser] = useState<AdminUser | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [debouncedProjectSearch, setDebouncedProjectSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [projectSorting, setProjectSorting] = useState<SortingState>([
    { id: 'projectName', desc: false },
  ]);
  const [projectSelection, setProjectSelection] = useState<RowSelectionState>({});

  const projectSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleProjectSearchChange = useCallback((value: string) => {
    setProjectSearch(value);
    if (projectSearchDebounceRef.current) clearTimeout(projectSearchDebounceRef.current);
    projectSearchDebounceRef.current = setTimeout(() => setDebouncedProjectSearch(value), 300);
  }, []);

  // Reset project selection when filter changes
  useEffect(() => {
    setProjectSelection({});
  }, [projectFilter, debouncedProjectSearch]);

  // Fetch ALL users once — stats computed from full list, filtered client-side
  const { data: allUsers, isLoading } = useAdminUsers('all', '');
  const activateUser = useActivateUser();
  const deactivateUser = useDeactivateUser();
  const bulkActivate = useBulkActivate();
  const bulkDeactivate = useBulkDeactivate();
  const updateEmploymentType = useUpdateEmploymentType();
  const updateTeam = useUpdateTeam();

  // ── Project drill-down data & mutations ─────────────────────────────
  const { data: allUserProjects, isLoading: projectsLoading } = useUserProjects(
    drilldownUser?.id ?? null,
  );
  const assignUserProject = useAssignUserProject();
  const removeUserProject = useRemoveUserProject();
  const updateUserProjectRole = useUpdateUserProjectRole();

  // Stats always reflect the full dataset
  const stats = useMemo(() => {
    if (!allUsers) return { total: 0, active: 0, inactive: 0 };
    const total = allUsers.length;
    const active = allUsers.filter((u) => u.active).length;
    return { total, active, inactive: total - active };
  }, [allUsers]);

  // Client-side filtering by status + search
  const users = useMemo(() => {
    if (!allUsers) return [];
    let filtered = allUsers;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) => (statusFilter === 'active' ? u.active : !u.active));
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [allUsers, statusFilter, debouncedSearch]);

  // ── Project drill-down stats & filtering ─────────────────────────────
  const projectStats = useMemo(() => {
    if (!allUserProjects) return { total: 0, assigned: 0, unassigned: 0 };
    const active = allUserProjects.filter((p) => p.isActive);
    const assigned = active.filter((p) => p.assigned).length;
    return { total: active.length, assigned, unassigned: active.length - assigned };
  }, [allUserProjects]);

  const filteredProjects = useMemo(() => {
    if (!allUserProjects) return [];
    let items = allUserProjects.filter((p) => p.isActive); // Only show active projects
    if (projectFilter === 'assigned') items = items.filter((p) => p.assigned);
    if (projectFilter === 'unassigned') items = items.filter((p) => !p.assigned);
    if (debouncedProjectSearch.trim()) {
      const q = debouncedProjectSearch.toLowerCase();
      items = items.filter(
        (p) =>
          p.projectName.toLowerCase().includes(q) ||
          (p.clientName && p.clientName.toLowerCase().includes(q)),
      );
    }
    return items;
  }, [allUserProjects, projectFilter, debouncedProjectSearch]);

  // ── Project drill-down handlers ─────────────────────────────────────
  const handleToggleProjectAssign = useCallback(
    (project: UserProjectRow) => {
      if (!drilldownUser) return;
      if (project.assigned) {
        removeUserProject.mutate({ userId: drilldownUser.id, projectId: project.projectId });
      } else {
        assignUserProject.mutate({ userId: drilldownUser.id, projectId: project.projectId });
      }
    },
    [drilldownUser, assignUserProject, removeUserProject],
  );

  const handleProjectRoleChange = useCallback(
    (project: UserProjectRow, role: string) => {
      if (!drilldownUser || !project.assigned) return;
      updateUserProjectRole.mutate({
        userId: drilldownUser.id,
        projectId: project.projectId,
        role,
      });
    },
    [drilldownUser, updateUserProjectRole],
  );

  const handleUserProjects = useCallback((user: AdminUser) => {
    setDrilldownUser(user);
    setProjectSearch('');
    setDebouncedProjectSearch('');
    setProjectFilter('all');
    setProjectSelection({});
  }, []);

  const handleBackFromProjects = useCallback(() => {
    setDrilldownUser(null);
    setProjectSearch('');
    setDebouncedProjectSearch('');
    setProjectFilter('all');
    setProjectSelection({});
  }, []);

  // ── Project drill-down columns & table ──────────────────────────────
  const projectColumns = useMemo(
    () =>
      getUserProjectColumns({
        onToggleAssign: handleToggleProjectAssign,
        onRoleChange: handleProjectRoleChange,
      }),
    [handleToggleProjectAssign, handleProjectRoleChange],
  );

  const projectTable = useReactTable({
    data: filteredProjects,
    columns: projectColumns,
    state: { sorting: projectSorting, rowSelection: projectSelection },
    onSortingChange: setProjectSorting,
    onRowSelectionChange: setProjectSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.projectId,
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const selectedProjectIds = Object.keys(projectSelection).filter((k) => projectSelection[k]);
  const clearProjectSelection = useCallback(() => setProjectSelection({}), []);

  const handleBulkAssignProjects = useCallback(() => {
    if (!drilldownUser) return;
    // Assign each project individually (no bulk endpoint for user→projects direction)
    const promises = selectedProjectIds.map((projectId) =>
      assignUserProject.mutateAsync({ userId: drilldownUser.id, projectId }),
    );
    Promise.all(promises).then(() => clearProjectSelection());
  }, [drilldownUser, selectedProjectIds, assignUserProject, clearProjectSelection]);

  const handleBulkRemoveProjects = useCallback(() => {
    if (!drilldownUser) return;
    const promises = selectedProjectIds.map((projectId) =>
      removeUserProject.mutateAsync({ userId: drilldownUser.id, projectId }),
    );
    Promise.all(promises).then(() => clearProjectSelection());
  }, [drilldownUser, selectedProjectIds, removeUserProject, clearProjectSelection]);

  // Single row actions
  const handleSingleActivate = useCallback(
    (user: AdminUser) => activateUser.mutate(user.id),
    [activateUser],
  );

  const handleSingleDeactivate = useCallback((user: AdminUser) => {
    setConfirmDialog({
      action: 'deactivate',
      userIds: [user.id],
      names: [user.displayName],
    });
  }, []);

  const handleImpersonate = useCallback(
    (user: AdminUser) => {
      setTarget(user.id, user.displayName, user.globalRole);
      navigate('/');
    },
    [setTarget, navigate],
  );

  const handleToggleEmploymentType = useCallback(
    (user: AdminUser, newType: EmploymentType) => {
      updateEmploymentType.mutate({ userId: user.id, employmentType: newType });
    },
    [updateEmploymentType],
  );

  const handleTeamChange = useCallback(
    (user: AdminUser, projectId: string | null) => {
      updateTeam.mutate({ userId: user.id, projectId });
    },
    [updateTeam],
  );

  // Column definitions (stable unless callbacks change)
  const columns = useMemo(
    () =>
      getUserColumns({
        onActivate: handleSingleActivate,
        onDeactivate: handleSingleDeactivate,
        onImpersonate: canImpersonate ? handleImpersonate : undefined,
        onProjects: handleUserProjects,
        onToggleEmploymentType: handleToggleEmploymentType,
        onTeamChange: handleTeamChange,
      }),
    [
      handleSingleActivate,
      handleSingleDeactivate,
      canImpersonate,
      handleImpersonate,
      handleUserProjects,
      handleToggleEmploymentType,
      handleTeamChange,
    ],
  );

  // TanStack Table instance — owned by the page for selection access
  const table = useReactTable({
    data: users ?? [],
    columns,
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

  // Derived selection
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const clearSelection = useCallback(() => setRowSelection({}), []);

  // Bulk actions
  const handleBulkActivate = useCallback(() => {
    bulkActivate.mutate(selectedIds, {
      onSuccess: () => clearSelection(),
    });
  }, [selectedIds, bulkActivate, clearSelection]);

  const handleBulkDeactivate = useCallback(() => {
    if (!allUsers) return;
    const names = allUsers.filter((u) => selectedIds.includes(u.id)).map((u) => u.displayName);
    setConfirmDialog({ action: 'deactivate', userIds: selectedIds, names });
  }, [selectedIds, allUsers]);

  const executeConfirm = useCallback(() => {
    if (!confirmDialog) return;
    const { action, userIds } = confirmDialog;
    if (action === 'deactivate') {
      if (userIds.length === 1) {
        deactivateUser.mutate(userIds[0]!, {
          onSettled: () => setConfirmDialog(null),
        });
      } else {
        bulkDeactivate.mutate(userIds, {
          onSettled: () => {
            clearSelection();
            setConfirmDialog(null);
          },
        });
      }
    }
  }, [confirmDialog, deactivateUser, bulkDeactivate, clearSelection]);

  // ── If drilling into a user's projects, show that view ───────────────
  if (drilldownUser) {
    return (
      <div>
        {/* Header */}
        <div className="mb-5">
          <button
            onClick={handleBackFromProjects}
            className="mb-1 flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            style={{ fontSize: scaled(12) }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Users
          </button>
          <div className="flex items-center gap-2.5">
            <UserAvatar user={drilldownUser} size="lg" />
            <h1
              className="font-brand font-semibold tracking-wide text-foreground"
              style={{ fontSize: scaled(18) }}
            >
              {drilldownUser.displayName}
            </h1>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
            Manage project assignments for this user
          </p>
        </div>

        {/* Toolbar */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex max-w-[280px] flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-[7px]">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              placeholder="Search by project or client..."
              value={projectSearch}
              onChange={(e) => handleProjectSearchChange(e.target.value)}
              className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              style={{ fontSize: scaled(12), border: 'none' }}
            />
            {projectSearch && (
              <button
                onClick={() => handleProjectSearchChange('')}
                className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex overflow-hidden rounded-md border border-border">
            {(['assigned', 'unassigned', 'all'] as const).map((tab) => {
              const label = tab === 'all' ? 'All' : tab === 'assigned' ? 'Assigned' : 'Unassigned';
              const count =
                tab === 'all'
                  ? projectStats.total
                  : tab === 'assigned'
                    ? projectStats.assigned
                    : projectStats.unassigned;
              return (
                <button
                  key={tab}
                  onClick={() => setProjectFilter(tab)}
                  className={cn(
                    'font-brand min-w-[5.5rem] border-r border-border px-3 py-1.5 text-center text-muted-foreground transition-colors last:border-r-0',
                    projectFilter === tab
                      ? 'bg-primary/[0.08] font-semibold text-foreground'
                      : 'hover:bg-muted/30',
                  )}
                  style={{
                    fontSize: scaled(11),
                    fontWeight: projectFilter === tab ? 600 : 500,
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

        {/* Projects Table */}
        <DataTable
          columns={projectColumns}
          data={filteredProjects}
          table={projectTable}
          isLoading={projectsLoading}
          emptyMessage="No projects found"
          entityName="project"
          paginationSuffix={projectFilter !== 'all' ? `(${projectFilter})` : undefined}
          rowClassName={(project) => cn(projectSelection[project.projectId] && 'bg-primary/5')}
        />

        {/* Bulk Action Bar */}
        <DataTableBulkActions table={projectTable as TanStackTable<unknown>} entityName="project">
          <button
            onClick={handleBulkAssignProjects}
            className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(152_60%_50%/0.12)] px-2.5 py-1.5 font-medium text-[hsl(152,60%,50%)] transition-colors hover:bg-[hsl(152_60%_50%/0.2)]"
            style={{ fontSize: scaled(12) }}
          >
            <Plus className="h-3.5 w-3.5" />
            Assign
          </button>
          <button
            onClick={handleBulkRemoveProjects}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/20"
            style={{ fontSize: scaled(12) }}
          >
            <Minus className="h-3.5 w-3.5" />
            Remove
          </button>
        </DataTableBulkActions>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1
          className="font-brand font-semibold tracking-wide text-foreground"
          style={{ fontSize: scaled(18) }}
        >
          Users
        </h1>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
          Manage team access and licenses
        </p>
      </div>

      {/* Stat Cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard
          label="Active"
          value={stats.active}
          subtitle="can log in and track time"
          accent
          onClick={() => setStatusFilter('active')}
          selected={statusFilter === 'active'}
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          subtitle="data preserved, no access"
          onClick={() => setStatusFilter('inactive')}
          selected={statusFilter === 'inactive'}
        />
        <StatCard
          label="All Users"
          value={stats.total}
          subtitle="synced from Toggl & Timetastic"
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
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: scaled(12), border: 'none' }}
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
      <DataTable
        columns={columns}
        data={users ?? []}
        table={table}
        isLoading={isLoading}
        emptyMessage="No users found"
        entityName="user"
        paginationSuffix={statusFilter !== 'all' ? `(${statusFilter})` : undefined}
        rowClassName={(user) =>
          cn(
            !user.active && 'opacity-50 hover:opacity-70',
            rowSelection[user.id] && 'bg-primary/5 opacity-100',
          )
        }
      />

      {/* Bulk Action Bar */}
      <DataTableBulkActions table={table} entityName="user">
        <button
          onClick={handleBulkActivate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(152_60%_50%/0.12)] px-2.5 py-1.5 font-medium text-[hsl(152,60%,50%)] transition-colors hover:bg-[hsl(152_60%_50%/0.2)]"
          style={{ fontSize: scaled(12) }}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Activate
        </button>
        <button
          onClick={handleBulkDeactivate}
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/20"
          style={{ fontSize: scaled(12) }}
        >
          <UserX className="h-3.5 w-3.5" />
          Deactivate
        </button>
      </DataTableBulkActions>

      {/* Confirmation Dialog — NOT using AlertDialogAction to avoid auto-close race */}
      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {confirmDialog?.userIds.length ?? 0} user
              {(confirmDialog?.userIds.length ?? 0) === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent{' '}
              {(confirmDialog?.userIds.length ?? 0) === 1 ? 'this user' : 'these users'} from
              logging in:
              <br />
              <br />
              <span className="font-medium text-foreground">{confirmDialog?.names.join(', ')}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              autoFocus
              variant="destructive"
              onClick={executeConfirm}
              disabled={deactivateUser.isPending || bulkDeactivate.isPending}
            >
              Deactivate {confirmDialog?.userIds.length ?? 0} user
              {(confirmDialog?.userIds.length ?? 0) === 1 ? '' : 's'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
