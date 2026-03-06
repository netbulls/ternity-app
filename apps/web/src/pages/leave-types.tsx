import { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Plus, Search, X, TreePalm, Layers } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableBulkActions } from '@/components/ui/data-table-bulk-actions';
import { SelectPopover } from '@/components/ui/select-popover';
import {
  useAdminLeaveTypes,
  useAdminLeaveTypeGroups,
  useCreateLeaveTypeGroup,
  useUpdateLeaveTypeGroup,
  useDeleteLeaveTypeGroup,
  useUpdateAdminLeaveType,
  useBulkUpdateLeaveTypes,
  type AdminLeaveType,
  type LeaveTypeGroup,
  type LeaveVisibility,
} from '@/hooks/use-leave';
import { getLeaveTypeColumns, getGroupColumns } from '@/pages/leave-type-columns';
import { LeaveTypeDialog } from '@/pages/leave-type-dialog';

type Scope = 'types' | 'groups';
type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 50;

export function LeaveTypesPage() {
  // ── Top-level state ─────────────────────────────────────────────────
  const [scope, setScope] = useState<Scope>('types');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<AdminLeaveType | null>(null);
  const [renameGroupDialog, setRenameGroupDialog] = useState<LeaveTypeGroup | null>(null);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [renameGroupColor, setRenameGroupColor] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<LeaveTypeGroup | null>(null);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // ── Data ────────────────────────────────────────────────────────────
  const { data: leaveTypesData, isLoading: typesLoading } = useAdminLeaveTypes();
  const { data: groupsData, isLoading: groupsLoading } = useAdminLeaveTypeGroups();

  const createGroup = useCreateLeaveTypeGroup();
  const updateGroup = useUpdateLeaveTypeGroup();
  const deleteGroup = useDeleteLeaveTypeGroup();
  const updateLeaveType = useUpdateAdminLeaveType();
  const bulkUpdate = useBulkUpdateLeaveTypes();

  const groups = groupsData ?? [];
  const allTypes = leaveTypesData ?? [];

  // ── Stats ───────────────────────────────────────────────────────────
  const typeStats = useMemo(() => {
    const active = allTypes.filter((t) => t.active).length;
    const inactive = allTypes.length - active;
    return { total: allTypes.length, active, inactive };
  }, [allTypes]);

  const groupStats = useMemo(() => {
    const total = groups.length;
    const withTypes = groups.filter((g) => g.typeCount > 0).length;
    const empty = total - withTypes;
    return { total, withTypes, empty };
  }, [groups]);

  // ── Filtered data ──────────────────────────────────────────────────
  const filteredTypes = useMemo(() => {
    let list = allTypes;
    if (statusFilter === 'active') list = list.filter((t) => t.active);
    if (statusFilter === 'inactive') list = list.filter((t) => !t.active);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [allTypes, statusFilter, searchQuery]);

  const filteredGroups = useMemo(() => {
    let list = groups;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    return list;
  }, [groups, searchQuery]);

  // ── Scope change ────────────────────────────────────────────────────
  const handleScopeChange = useCallback((newScope: Scope) => {
    setScope(newScope);
    setStatusFilter('all');
    setSearchQuery('');
    setRowSelection({});
    setSorting([{ id: 'name', desc: false }]);
  }, []);

  // ── Leave type callbacks ────────────────────────────────────────────
  const handleEditType = useCallback((lt: AdminLeaveType) => {
    setEditingType(lt);
    setTypeDialogOpen(true);
  }, []);

  const handleNewType = useCallback(() => {
    setEditingType(null);
    setTypeDialogOpen(true);
  }, []);

  const onToggleActive = useCallback(
    (lt: AdminLeaveType) => {
      updateLeaveType.mutate({ id: lt.id, active: !lt.active });
    },
    [updateLeaveType],
  );

  const onChangeVisibility = useCallback(
    (lt: AdminLeaveType, visibility: LeaveVisibility) => {
      updateLeaveType.mutate({ id: lt.id, visibility });
    },
    [updateLeaveType],
  );

  const onChangeGroup = useCallback(
    (lt: AdminLeaveType, groupId: string | null) => {
      updateLeaveType.mutate({ id: lt.id, groupId });
    },
    [updateLeaveType],
  );

  // ── Group callbacks ─────────────────────────────────────────────────
  const handleRenameGroup = useCallback((g: LeaveTypeGroup) => {
    setRenameGroupDialog(g);
    setRenameGroupName(g.name);
    setRenameGroupColor(g.color);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (!renameGroupDialog || !renameGroupName.trim()) return;
    updateGroup.mutate({
      id: renameGroupDialog.id,
      name: renameGroupName.trim(),
      color: renameGroupColor,
    });
    setRenameGroupDialog(null);
  }, [renameGroupDialog, renameGroupName, renameGroupColor, updateGroup]);

  const handleDeleteGroup = useCallback((g: LeaveTypeGroup) => {
    setConfirmDelete(g);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;
    deleteGroup.mutate(confirmDelete.id);
    setConfirmDelete(null);
  }, [confirmDelete, deleteGroup]);

  // ── Columns ─────────────────────────────────────────────────────────
  const typeColumns = useMemo(
    () =>
      getLeaveTypeColumns({
        groups,
        onEdit: handleEditType,
        onToggleActive,
        onChangeVisibility,
        onChangeGroup,
      }),
    [groups, handleEditType, onToggleActive, onChangeVisibility, onChangeGroup],
  );

  const groupColumns = useMemo(
    () =>
      getGroupColumns({
        onRename: handleRenameGroup,
        onDelete: handleDeleteGroup,
      }),
    [handleRenameGroup, handleDeleteGroup],
  );

  // ── Table instances ─────────────────────────────────────────────────
  const typeTable = useReactTable({
    data: filteredTypes,
    columns: typeColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const groupTable = useReactTable({
    data: filteredGroups,
    columns: groupColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const isLoading = typesLoading || groupsLoading;

  // ── Stats for current scope ─────────────────────────────────────────
  const stats =
    scope === 'types'
      ? {
          card1: { label: 'Active', value: typeStats.active, subtitle: 'visible to users' },
          card2: { label: 'Inactive', value: typeStats.inactive, subtitle: 'hidden from booking' },
          card3: { label: 'All Types', value: typeStats.total, subtitle: 'total in system' },
        }
      : {
          card1: {
            label: 'With Types',
            value: groupStats.withTypes,
            subtitle: 'have types assigned',
          },
          card2: { label: 'Empty', value: groupStats.empty, subtitle: 'no types assigned' },
          card3: { label: 'All Groups', value: groupStats.total, subtitle: 'total in system' },
        };

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1
            className="font-brand font-semibold tracking-wide text-foreground"
            style={{ fontSize: scaled(18) }}
          >
            Leave Types
          </h1>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
            Manage leave categories, groups, and visibility
          </p>
        </div>

        {/* Create button */}
        {scope === 'types' && (
          <Button
            variant="subtle"
            size="compact"
            onClick={handleNewType}
            style={{ fontSize: scaled(11) }}
          >
            <Plus />
            New Leave Type
          </Button>
        )}
        {scope === 'groups' && (
          <Button
            variant="subtle"
            size="compact"
            onClick={() => {
              // Find next unused color
              const usedColors = new Set(groups.map((g) => g.color));
              const GROUP_COLORS = [
                '#00D4AA',
                '#F97316',
                '#8B5CF6',
                '#EC4899',
                '#3B82F6',
                '#EAB308',
                '#EF4444',
                '#6B7280',
                '#14B8A6',
                '#A855F7',
              ];
              const nextColor = GROUP_COLORS.find((c) => !usedColors.has(c)) ?? '#00D4AA';
              createGroup.mutate({ name: 'New Group', color: nextColor });
            }}
            style={{ fontSize: scaled(11) }}
          >
            <Plus />
            New Group
          </Button>
        )}
      </div>

      {/* Scope Tabs */}
      <div className="mb-5 flex gap-1 border-b border-border pb-px">
        {[
          { id: 'types' as Scope, label: 'Leave Types', icon: TreePalm },
          { id: 'groups' as Scope, label: 'Groups', icon: Layers },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleScopeChange(tab.id)}
            className={cn(
              'mb-[-1px] flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-brand font-medium uppercase tracking-wider transition-colors',
              scope === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            style={{ fontSize: scaled(11), letterSpacing: '1px' }}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      {scope === 'types' && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatCard
            label={stats.card1.label}
            value={stats.card1.value}
            subtitle={stats.card1.subtitle}
            accent
            onClick={() => setStatusFilter('active')}
            selected={statusFilter === 'active'}
          />
          <StatCard
            label={stats.card2.label}
            value={stats.card2.value}
            subtitle={stats.card2.subtitle}
            onClick={() => setStatusFilter('inactive')}
            selected={statusFilter === 'inactive'}
          />
          <StatCard
            label={stats.card3.label}
            value={stats.card3.value}
            subtitle={stats.card3.subtitle}
            onClick={() => setStatusFilter('all')}
            selected={statusFilter === 'all'}
          />
        </div>
      )}
      {scope === 'groups' && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatCard
            label={stats.card1.label}
            value={stats.card1.value}
            subtitle={stats.card1.subtitle}
            accent
          />
          <StatCard
            label={stats.card2.label}
            value={stats.card2.value}
            subtitle={stats.card2.subtitle}
          />
          <StatCard
            label={stats.card3.label}
            value={stats.card3.value}
            subtitle={stats.card3.subtitle}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        {/* Search */}
        <div className="flex max-w-[280px] flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-[7px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            placeholder={scope === 'types' ? 'Search leave types...' : 'Search groups...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: scaled(12), border: 'none' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs (only for types scope) */}
        {scope === 'types' && (
          <div className="flex overflow-hidden rounded-md border border-border">
            {(['active', 'inactive', 'all'] as StatusFilter[]).map((tab) => {
              const label = tab === 'all' ? 'All' : tab === 'active' ? 'Active' : 'Inactive';
              const count =
                tab === 'all'
                  ? typeStats.total
                  : tab === 'active'
                    ? typeStats.active
                    : typeStats.inactive;
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
        )}
      </div>

      {/* Data Table */}
      {scope === 'types' ? (
        <DataTable
          columns={typeColumns}
          data={filteredTypes}
          table={typeTable}
          isLoading={isLoading}
          emptyMessage="No leave types found"
          showPagination={filteredTypes.length > PAGE_SIZE}
          pageSize={PAGE_SIZE}
          entityName="leave type"
          paginationSuffix={statusFilter !== 'all' ? `(${statusFilter})` : undefined}
        />
      ) : (
        <DataTable
          columns={groupColumns}
          data={filteredGroups}
          table={groupTable}
          isLoading={isLoading}
          emptyMessage="No groups found"
          showPagination={filteredGroups.length > PAGE_SIZE}
          pageSize={PAGE_SIZE}
          entityName="group"
        />
      )}

      {/* Bulk actions — types */}
      {scope === 'types' && (
        <DataTableBulkActions table={typeTable} entityName="leave type">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              bulkUpdate.mutate({ ids: selectedIds, active: true });
              setRowSelection({});
            }}
            className="text-emerald-500 hover:text-emerald-400"
            style={{ fontSize: scaled(11) }}
          >
            Activate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              bulkUpdate.mutate({ ids: selectedIds, active: false });
              setRowSelection({});
            }}
            className="text-muted-foreground hover:text-foreground"
            style={{ fontSize: scaled(11) }}
          >
            Deactivate
          </Button>
          {groups.length > 0 && (
            <SelectPopover
              value=""
              onChange={(val) => {
                bulkUpdate.mutate({
                  ids: selectedIds,
                  groupId: val === '__none__' ? null : val,
                });
                setRowSelection({});
              }}
              items={[
                { value: '__none__', label: 'No group' },
                ...groups.map((g) => ({ value: g.id, label: g.name })),
              ]}
              placeholder="Assign group..."
              actionTrigger
              compact
            />
          )}
          <SelectPopover
            value=""
            onChange={(val) => {
              bulkUpdate.mutate({ ids: selectedIds, visibility: val });
              setRowSelection({});
            }}
            items={[
              { value: 'all', label: 'All' },
              { value: 'contractor', label: 'B2B only' },
              { value: 'employee', label: 'Employee only' },
            ]}
            placeholder="Set visibility..."
            actionTrigger
            compact
          />
        </DataTableBulkActions>
      )}

      {/* Bulk actions — groups */}
      {scope === 'groups' && (
        <DataTableBulkActions table={groupTable} entityName="group">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              selectedIds.forEach((id) => deleteGroup.mutate(id));
              setRowSelection({});
            }}
            className="text-destructive hover:text-destructive"
            style={{ fontSize: scaled(11) }}
          >
            Delete
          </Button>
        </DataTableBulkActions>
      )}

      {/* Leave Type Dialog (create/edit) */}
      <LeaveTypeDialog
        open={typeDialogOpen}
        onOpenChange={setTypeDialogOpen}
        leaveType={editingType}
      />

      {/* Rename Group Dialog */}
      <AlertDialog
        open={!!renameGroupDialog}
        onOpenChange={(open) => !open && setRenameGroupDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Group</AlertDialogTitle>
            <AlertDialogDescription>Update the group name and color.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Input
              value={renameGroupName}
              onChange={(e) => setRenameGroupName(e.target.value)}
              placeholder="Group name"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
            />
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
                Color
              </label>
              <div className="relative">
                <input
                  type="color"
                  value={renameGroupColor}
                  onChange={(e) => setRenameGroupColor(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  style={{ width: 24, height: 24 }}
                />
                <span
                  className="inline-block rounded-full border border-border"
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: renameGroupColor,
                  }}
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleConfirmRename} disabled={!renameGroupName.trim()}>
              Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Group Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{confirmDelete?.name}&quot;?
              {(confirmDelete?.typeCount ?? 0) > 0 && (
                <>
                  {' '}
                  {confirmDelete!.typeCount} leave type{confirmDelete!.typeCount === 1 ? '' : 's'}{' '}
                  will be unassigned from this group.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
