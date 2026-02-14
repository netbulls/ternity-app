import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Search, UserCheck, UserX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { StatCard } from '@/components/ui/stat-card';
import {
  useAdminUsers,
  useActivateUser,
  useDeactivateUser,
  useBulkActivate,
  useBulkDeactivate,
  type AdminUser,
} from '@/hooks/use-admin-users';
import { getUserColumns } from '@/pages/user-management-columns';
import { DataTable } from '@/components/ui/data-table';
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

type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 10;

export function UserManagementPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    action: 'activate' | 'deactivate';
    userIds: string[];
    names: string[];
  } | null>(null);

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'displayName', desc: false },
  ]);
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

  const { data: users, isLoading } = useAdminUsers(statusFilter, debouncedSearch);
  const activateUser = useActivateUser();
  const deactivateUser = useDeactivateUser();
  const bulkActivate = useBulkActivate();
  const bulkDeactivate = useBulkDeactivate();

  // Stats from current data
  const stats = useMemo(() => {
    if (!users) return { total: 0, active: 0, inactive: 0 };
    const total = users.length;
    const active = users.filter((u) => u.active).length;
    return { total, active, inactive: total - active };
  }, [users]);

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

  // Column definitions (stable unless callbacks change)
  const columns = useMemo(
    () =>
      getUserColumns({
        onActivate: handleSingleActivate,
        onDeactivate: handleSingleDeactivate,
      }),
    [handleSingleActivate, handleSingleDeactivate],
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
    if (!users) return;
    const names = users
      .filter((u) => selectedIds.includes(u.id))
      .map((u) => u.displayName);
    setConfirmDialog({ action: 'deactivate', userIds: selectedIds, names });
  }, [selectedIds, users]);

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
        <p
          className="mt-0.5 text-muted-foreground"
          style={{ fontSize: scaled(12) }}
        >
          Manage team access and licenses
        </p>
      </div>

      {/* Stat Cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard
          label="All Users"
          value={stats.total}
          subtitle="synced from Toggl & Timetastic"
          onClick={() => setStatusFilter('all')}
          selected={statusFilter === 'all'}
        />
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
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        {/* Search */}
        <div
          className="flex max-w-[280px] flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-[7px]"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontFamily: "'Inter', sans-serif", fontSize: scaled(12), border: 'none' }}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex overflow-hidden rounded-md border border-border">
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((tab) => {
            const label = tab === 'all' ? 'All' : tab === 'active' ? 'Active' : 'Inactive';
            const count =
              tab === 'all' ? stats.total : tab === 'active' ? stats.active : stats.inactive;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  'font-brand border-r border-border px-3 py-1.5 text-muted-foreground transition-colors last:border-r-0',
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
                  className="ml-1 rounded-full bg-muted/50 px-1.5 py-px font-brand text-muted-foreground"
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
      {selectedIds.length > 0 && (
        <div className="fixed bottom-7 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-xl">
          <span
            className="px-2 font-brand font-medium text-foreground"
            style={{ fontSize: scaled(12), letterSpacing: '0.5px' }}
          >
            {selectedIds.length} selected
          </span>
          <div className="h-6 w-px bg-border" />
          <button
            onClick={handleBulkActivate}
            className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(152_60%_50%/0.12)] px-2.5 py-1.5 font-medium text-[hsl(152,60%,50%)] transition-colors hover:bg-[hsl(152_60%_50%/0.2)]"
            style={{ fontSize: '12px' }}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Activate
          </button>
          <button
            onClick={handleBulkDeactivate}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/20"
            style={{ fontSize: '12px' }}
          >
            <UserX className="h-3.5 w-3.5" />
            Deactivate
          </button>
          <div className="h-6 w-px bg-border" />
          <button
            onClick={clearSelection}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Confirmation Dialog — NOT using AlertDialogAction to avoid auto-close race */}
      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              className="font-brand font-semibold text-foreground"
              style={{ fontSize: '15px' }}
            >
              Deactivate {confirmDialog?.userIds.length ?? 0} user
              {(confirmDialog?.userIds.length ?? 0) === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
              This will prevent{' '}
              {(confirmDialog?.userIds.length ?? 0) === 1 ? 'this user' : 'these users'}{' '}
              from logging in:
              <br />
              <br />
              <span className="font-medium text-foreground">
                {confirmDialog?.names.join(', ')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
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
