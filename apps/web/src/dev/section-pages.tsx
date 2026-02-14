import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { Section, SubSection } from '@/dev/dev-toolbar';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { getUserColumns } from '@/pages/user-management-columns';
import { MOCK_ADMIN_USERS } from '@/dev/fixtures';

type StatusFilter = 'all' | 'active' | 'inactive';

function UserManagementPagePreview() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const stats = useMemo(() => {
    const total = MOCK_ADMIN_USERS.length;
    const active = MOCK_ADMIN_USERS.filter((u) => u.active).length;
    return { total, active, inactive: total - active };
  }, []);

  const columns = useMemo(
    () =>
      getUserColumns({
        onActivate: (user) => toast.success(`Activated ${user.displayName}`),
        onDeactivate: (user) => toast(`Deactivated ${user.displayName}`),
      }),
    [],
  );

  const filteredUsers = useMemo(() => {
    if (statusFilter === 'all') return MOCK_ADMIN_USERS;
    return MOCK_ADMIN_USERS.filter((u) =>
      statusFilter === 'active' ? u.active : !u.active,
    );
  }, [statusFilter]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
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
        <div className="flex max-w-[280px] flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-[7px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            placeholder="Search by name or email..."
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontFamily: "'Inter', sans-serif", fontSize: scaled(12), border: 'none' }}
          />
        </div>

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

      <DataTable
        columns={columns}
        data={filteredUsers}
        pageSize={4}
        entityName="user"
        rowClassName={(user) =>
          !user.active ? 'opacity-50 hover:opacity-70' : undefined
        }
      />
    </div>
  );
}

export function PagesSection() {
  return (
    <Section title="Pages">
      <SubSection label="User Management">
        <div className="w-full">
          <UserManagementPagePreview />
        </div>
      </SubSection>

      <SubSection label="Entries">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Entries page — to be revisited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Full entries page demo with day groups, filters, and date navigation.
            </p>
          </CardContent>
        </Card>
      </SubSection>
    </Section>
  );
}
