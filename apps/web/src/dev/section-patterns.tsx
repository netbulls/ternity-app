import { useState, useMemo } from 'react';
import { GlobalRole } from '@ternity/shared';
import type { AuthContext as AuthContextType } from '@ternity/shared';
import { toast } from 'sonner';
import { UserCheck, UserX } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Section, SubSection } from '@/dev/dev-toolbar';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { DataTableBulkActions } from '@/components/ui/data-table-bulk-actions';
import { HourglassLogo } from '@/components/layout/hourglass-logo';
import { getUserColumns } from '@/pages/user-management-columns';
import { formatDuration, formatTime, formatDateLabel, formatTimer } from '@/lib/format';
import {
  MOCK_PROJECTS,
  MOCK_ENTRIES,
  MOCK_DAY_GROUPS,
  MOCK_TIMER_RUNNING,
  MOCK_STATS,
  MOCK_ADMIN_USERS,
} from '@/dev/fixtures';

/* ── Timer Bar Preview ──────────────────────────────────────────────────── */

function TimerBarPreview({ running }: { running: boolean }) {
  const entry = running ? MOCK_TIMER_RUNNING.entry : null;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
        running
          ? 'border-primary/50 bg-[hsl(var(--t-timer-bg))]'
          : 'border-[hsl(var(--t-timer-border))] bg-[hsl(var(--t-timer-bg))]'
      }`}
    >
      <input
        className="flex-1 border-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        placeholder="What are you working on?"
        defaultValue={entry?.description ?? ''}
        readOnly
      />
      <button className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground">
        {entry?.projectColor && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.projectColor }}
          />
        )}
        <span>{entry?.projectName ?? 'Project'}</span>
      </button>
      <button className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
        {running ? '1 label' : 'Labels'}
      </button>
      <span className="font-brand text-xl font-semibold tracking-wider text-primary tabular-nums">
        {running ? formatTimer(3661) : '00:00:00'}
      </span>
      {running ? (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--t-stop))] text-white">
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </div>
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
      )}
    </div>
  );
}

/* ── Entry Row Preview ──────────────────────────────────────────────────── */

function EntryRowPreview({ entry }: { entry: (typeof MOCK_ENTRIES)[number] }) {
  const isRunning = entry.isRunning;
  const timedSegments = entry.segments.filter((s) => s.startedAt != null);
  const firstStartedAt = timedSegments[0]?.startedAt ?? entry.createdAt;
  const lastStoppedAt = timedSegments[timedSegments.length - 1]?.stoppedAt ?? null;
  const durationStr = isRunning
    ? formatDuration(3661)
    : formatDuration(entry.totalDurationSeconds);
  const timeRange = isRunning
    ? `${formatTime(firstStartedAt)} – now`
    : `${formatTime(firstStartedAt)} – ${formatTime(lastStoppedAt!)}`;

  return (
    <div
      className={`flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 ${
        isRunning ? 'border-l-2 border-l-primary bg-primary/5' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-foreground">
            {entry.description || (
              <span className="italic text-muted-foreground">No description</span>
            )}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {entry.projectName && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.projectColor ?? '#00D4AA' }}
              />
              {entry.projectName}
            </span>
          )}
          {entry.labels.map((label) => (
            <Badge key={label.id} variant="outline" className="h-[18px] px-1.5 text-[10px]">
              {label.color && (
                <span
                  className="mr-1 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
              )}
              {label.name}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-right">
        <span className="text-[11px] text-muted-foreground">{timeRange}</span>
        <span
          className={`font-brand text-sm font-semibold tabular-nums ${
            isRunning ? 'text-primary' : 'text-foreground'
          }`}
        >
          {durationStr}
        </span>
      </div>
      <button className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
    </div>
  );
}

/* ── Day Group Preview ──────────────────────────────────────────────────── */

function DayGroupPreview({ group }: { group: (typeof MOCK_DAY_GROUPS)[number] }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] font-semibold text-foreground">
          {formatDateLabel(group.date)}
        </span>
        <span className="font-brand text-[12px] font-semibold tabular-nums text-muted-foreground">
          {formatDuration(group.totalSeconds)}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {group.entries.map((entry) => (
          <EntryRowPreview key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

/* ── Sidebar Preview ────────────────────────────────────────────────────── */

function SidebarPreview() {
  const user: AuthContextType = {
    userId: 'dev-user-001',
    displayName: 'Alex Morgan',
    email: 'alex.morgan@acme.io',
    phone: null,
    avatarUrl: null,
    globalRole: GlobalRole.Admin,
    orgRoles: {},
  };

  const navItems = [
    { label: 'Timer', active: true },
    { label: 'Entries', active: false },
    { label: 'Reports', active: false },
    { label: 'Calendar', active: false },
    { label: 'Leave', active: false },
    { label: 'Projects', active: false },
  ];

  const initials = 'AM';

  return (
    <aside className="flex h-[500px] w-[220px] flex-col rounded-lg border-r border-sidebar-border bg-sidebar px-3 py-5">
      <div className="mb-5 flex items-center gap-2 px-2.5">
        <HourglassLogo className="h-[22px] w-[18px] text-primary" />
        <span className="font-brand text-[15px] font-semibold uppercase tracking-[3px] text-sidebar-foreground">
          Ternity
        </span>
      </div>
      <nav className="flex flex-col gap-0.5">
        <div
          className="px-2.5 pb-1 pt-2 font-brand uppercase text-muted-foreground opacity-50"
          style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
        >
          Tracking
        </div>
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors ${
              item.active
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
            style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
          >
            {item.label}
          </div>
        ))}
        <div
          className="px-2.5 pb-1 pt-4 font-brand uppercase text-muted-foreground opacity-50"
          style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
        >
          Admin
        </div>
        <div
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
        >
          Users
        </div>
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] text-[11px] font-semibold text-[hsl(var(--t-avatar-text))]">
          {initials}
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-medium text-sidebar-foreground">{user.displayName}</div>
          <div className="text-[10px] text-muted-foreground">Admin</div>
        </div>
      </div>
    </aside>
  );
}

/* ── Manual Entry Dialog Preview ────────────────────────────────────────── */

function ManualEntryDialogPreview() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Manual Entry Dialog</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add Manual Entry</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Description</label>
            <Input placeholder="What did you work on?" />
          </div>
          <div className="flex items-center gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Project</label>
              <button className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                Project
              </button>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Labels</label>
              <button className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                Labels
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Date</label>
            <Input type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Start Time</label>
              <Input type="time" defaultValue="09:00" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">End Time</label>
              <Input type="time" defaultValue="10:00" />
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Duration: <span className="font-brand font-semibold text-foreground">1h 00m</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Create Entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Basic DataTable Demo ───────────────────────────────────────────────── */

interface ProjectRow {
  name: string;
  client: string;
  color: string;
  entries: number;
}

const BASIC_TABLE_DATA: ProjectRow[] = MOCK_PROJECTS.map((p, i) => ({
  name: p.name,
  client: p.clientName ?? '',
  color: p.color ?? '#00D4AA',
  entries: [342, 218, 156, 89][i] ?? 0,
}));

const BASIC_TABLE_COLUMNS: ColumnDef<ProjectRow>[] = [
  {
    accessorKey: 'name',
    header: 'Project',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: row.original.color }}
        />
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  { accessorKey: 'client', header: 'Client' },
  {
    accessorKey: 'color',
    header: 'Color',
    cell: ({ row }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.original.color}</code>
    ),
  },
  {
    accessorKey: 'entries',
    header: 'Entries',
    cell: ({ row }) => (
      <span className="font-brand tabular-nums">{row.original.entries}</span>
    ),
  },
];

/* ── Patterns Section ───────────────────────────────────────────────────── */

export function PatternsSection() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo(
    () =>
      getUserColumns({
        onActivate: (user) => toast.success(`Activated ${user.displayName}`),
        onDeactivate: (user) => toast(`Deactivated ${user.displayName}`),
      }),
    [],
  );

  const selectionTable = useReactTable({
    data: MOCK_ADMIN_USERS,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 4 } },
  });

  return (
    <Section title="Patterns">
      <SubSection label="Stat Cards">
        <div className="grid w-full grid-cols-3 gap-3">
          <StatCard
            label="Today"
            value={formatDuration(MOCK_STATS.todaySeconds)}
            subtitle="of 8h target"
            accent
          />
          <StatCard
            label="This Week"
            value={formatDuration(MOCK_STATS.weekSeconds)}
            subtitle="of 40h target"
          />
          <StatCard label="Leave Balance" value="--" subtitle="days remaining" />
        </div>
      </SubSection>

      <SubSection label="Data Table — Basic">
        <div className="w-full">
          <DataTable
            columns={BASIC_TABLE_COLUMNS}
            data={BASIC_TABLE_DATA}
            pageSize={4}
            showPagination={false}
          />
        </div>
      </SubSection>

      <SubSection label="Data Table — With Selection + Bulk Actions">
        <div className="w-full">
          <DataTable
            columns={columns}
            data={MOCK_ADMIN_USERS}
            table={selectionTable}
            entityName="user"
            rowClassName={(user) =>
              !user.active ? 'opacity-50 hover:opacity-70' : undefined
            }
          />
          <DataTableBulkActions table={selectionTable} entityName="user">
            <button
              onClick={() => {
                const names = selectionTable
                  .getFilteredSelectedRowModel()
                  .rows.map((r) => r.original.displayName)
                  .join(', ');
                toast.success(`Activated: ${names}`);
                selectionTable.toggleAllRowsSelected(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(152_60%_50%/0.12)] px-2.5 py-1.5 text-xs font-medium text-[hsl(152,60%,50%)] transition-colors hover:bg-[hsl(152_60%_50%/0.2)]"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Activate
            </button>
            <button
              onClick={() => {
                const names = selectionTable
                  .getFilteredSelectedRowModel()
                  .rows.map((r) => r.original.displayName)
                  .join(', ');
                toast(`Deactivated: ${names}`);
                selectionTable.toggleAllRowsSelected(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--destructive)/0.1)] px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-[hsl(var(--destructive)/0.2)]"
            >
              <UserX className="h-3.5 w-3.5" />
              Deactivate
            </button>
          </DataTableBulkActions>
        </div>
      </SubSection>

      <SubSection label="Timer Bar — Idle">
        <div className="w-full">
          <TimerBarPreview running={false} />
        </div>
      </SubSection>

      <SubSection label="Timer Bar — Running">
        <div className="w-full">
          <TimerBarPreview running={true} />
        </div>
      </SubSection>

      <SubSection label="Entry Rows">
        <div className="w-full overflow-hidden rounded-lg border border-border">
          {MOCK_ENTRIES.map((entry) => (
            <EntryRowPreview key={entry.id} entry={entry} />
          ))}
        </div>
      </SubSection>

      <SubSection label="Day Groups">
        <div className="w-full">
          {MOCK_DAY_GROUPS.map((group) => (
            <DayGroupPreview key={group.date} group={group} />
          ))}
        </div>
      </SubSection>

      <SubSection label="Sidebar">
        <SidebarPreview />
      </SubSection>

      <SubSection label="Manual Entry Dialog">
        <ManualEntryDialogPreview />
      </SubSection>
    </Section>
  );
}
