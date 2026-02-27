import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { toast } from 'sonner';
import {
  User,
  Settings2,
  Briefcase,
  Link2,
  Bell,
  Globe,
  Mail,
  Phone,
  ExternalLink,
  Unplug,
  Plus,
} from 'lucide-react';
import {
  MockSidebar,
  MockThemeSelector,
  MockScaleSelector,
  MockWorkingHours,
  MockAttendance,
  MockNotifications,
  ComingBadge,
  MOCK_SETTINGS_DATA,
} from '@/dev/settings-proto-parts';

// ============================================================
// Mock Jira data
// ============================================================

export const MOCK_JIRA_PROJECTS = [
  { key: 'ADM', name: 'Admin Dashboard' },
  { key: 'BIT', name: 'Bitflow Platform' },
  { key: 'INT', name: 'Internal Tools' },
  { key: 'MOB', name: 'Mobile App' },
  { key: 'WEB', name: 'Marketing Website' },
  { key: 'API', name: 'API Gateway' },
  { key: 'INF', name: 'Infrastructure' },
  { key: 'QA', name: 'Quality Assurance' },
] as const;

export const MOCK_JIRA_STATUSES = [
  { id: 'todo', name: 'To Do', category: 'new' },
  { id: 'in-progress', name: 'In Progress', category: 'indeterminate' },
  { id: 'in-review', name: 'In Review', category: 'indeterminate' },
  { id: 'done', name: 'Done', category: 'done' },
  { id: 'cancelled', name: 'Cancelled', category: 'done' },
] as const;

export interface JiraConnection {
  id: string;
  site: string;
  url: string;
  displayName: string;
  email: string;
}

export const MOCK_JIRA_CONNECTIONS: JiraConnection[] = [
  {
    id: 'netbulls',
    site: 'NETBULLS',
    url: 'netbulls.atlassian.net',
    displayName: 'Przemek Rudzki',
    email: 'przemek@netbulls.com',
  },
  {
    id: 'acme',
    site: 'ACME CORP',
    url: 'acme-corp.atlassian.net',
    displayName: 'Przemek Rudzki',
    email: 'p.rudzki@acme.io',
  },
  {
    id: 'oakridge',
    site: 'OAKRIDGE LABS',
    url: 'oakridge-labs.atlassian.net',
    displayName: 'Przemek Rudzki',
    email: 'przemek@oakridge.dev',
  },
];

/** Per-connection project pools — each site has its own set */
export const MOCK_PROJECTS_BY_CONNECTION: Record<string, readonly { key: string; name: string }[]> = {
  netbulls: MOCK_JIRA_PROJECTS,
  acme: [
    { key: 'CRM', name: 'Customer Portal' },
    { key: 'PAY', name: 'Payment Engine' },
    { key: 'MKT', name: 'Marketing Hub' },
    { key: 'OPS', name: 'Operations' },
    { key: 'SEC', name: 'Security' },
  ],
  oakridge: [
    { key: 'LAB', name: 'Research Lab' },
    { key: 'EXP', name: 'Experiments' },
    { key: 'DOC', name: 'Documentation' },
  ],
};

/** Default selected projects per connection */
export const DEFAULT_PROJECTS_BY_CONNECTION: Record<string, Set<string>> = {
  netbulls: new Set(['ADM', 'BIT', 'INT']),
  acme: new Set(['CRM', 'PAY']),
  oakridge: new Set(['LAB']),
};

/** Default excluded statuses per connection */
export const DEFAULT_EXCLUDED_BY_CONNECTION: Record<string, Set<string>> = {
  netbulls: new Set(['cancelled']),
  acme: new Set(['done', 'cancelled']),
  oakridge: new Set([]),
};

// ============================================================
// Tab definitions — matches dev-settings-v3.tsx pattern
// ============================================================

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  soon?: boolean;
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'work', label: 'Work', icon: Briefcase, soon: true },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'notifications', label: 'Notifications', icon: Bell, soon: true },
];

// ============================================================
// Shared Jira UI pieces
// ============================================================

export function ConnectionHeader({
  connection,
  summary,
  actions,
  compact,
}: {
  connection: JiraConnection;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex items-start gap-3', compact ? 'py-0' : 'py-1')}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Link2 className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
            {connection.site}
          </span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
            Connected
          </span>
        </div>
        <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
          {connection.displayName} &middot; {connection.email}
        </div>
        {summary && (
          <div className="mt-0.5 text-muted-foreground/70" style={{ fontSize: scaled(10) }}>
            {summary}
          </div>
        )}
      </div>
      {actions ?? (
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => window.open(`https://${connection.url}`, '_blank')}
            className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            title="Open in Jira"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => toast('Disconnect flow would start here')}
            className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Disconnect"
          >
            <Unplug className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function JqlPreview({
  projects,
  excludedStatuses,
  mode,
  customJql,
}: {
  projects: Set<string>;
  excludedStatuses: Set<string>;
  mode: 'simple' | 'custom';
  customJql?: string;
}) {
  const jql =
    mode === 'custom' && customJql
      ? customJql
      : buildJql(projects, excludedStatuses);

  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div
        className="font-mono text-muted-foreground"
        style={{ fontSize: scaled(10), lineHeight: '1.5' }}
      >
        {jql}
      </div>
    </div>
  );
}

export function buildJql(projects: Set<string>, excludedStatuses: Set<string>): string {
  const parts: string[] = [];
  if (projects.size > 0) {
    parts.push(`project IN (${[...projects].join(', ')})`);
  }
  if (excludedStatuses.size > 0) {
    const names = [...excludedStatuses].map(
      (id) => `"${MOCK_JIRA_STATUSES.find((s) => s.id === id)?.name ?? id}"`,
    );
    parts.push(`AND status NOT IN (${names.join(', ')})`);
  }
  parts.push('ORDER BY updated DESC');
  return parts.join(' ') || 'ORDER BY updated DESC';
}

export function ConnectButton({ hasConnection }: { hasConnection?: boolean }) {
  return (
    <button
      onClick={() => toast.success('Jira OAuth flow would start here')}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
      style={{ fontSize: scaled(12) }}
    >
      <Plus className="h-3.5 w-3.5" />
      {hasConnection ? 'Connect another Jira site' : 'Connect Jira'}
    </button>
  );
}

// ============================================================
// Tab content for non-Integrations tabs (simplified)
// ============================================================

function InfoRow({ icon: Icon, value }: { icon: React.ElementType; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-1">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      <span className="min-w-0 truncate text-foreground/80" style={{ fontSize: scaled(12) }}>
        {value}
      </span>
    </div>
  );
}

function GeneralPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Appearance
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Customize the look and feel
      </p>
      <div className="mt-3">
        <MockThemeSelector />
        <MockScaleSelector />
      </div>
    </div>
  );
}

function ProfilePanel() {
  const u = MOCK_SETTINGS_DATA.user;

  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Account
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Your profile information
      </p>
      <div className="mt-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="mb-2 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]"
            style={{ fontSize: scaled(12) }}
          >
            {u.initials}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              {u.name}
            </div>
            <span className="font-medium text-primary" style={{ fontSize: scaled(11) }}>
              {u.role}
            </span>
          </div>
        </div>
        <div className="border-t border-border/50 pt-2">
          <InfoRow icon={Mail} value={u.email} />
          <InfoRow icon={Phone} value={u.phone} />
          <InfoRow icon={Globe} value={u.timezone} />
        </div>
      </div>
    </div>
  );
}

function WorkPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Working Hours
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Your standard work schedule
      </p>
      <div className="mt-3">
        <MockWorkingHours />
      </div>
      <div className="mt-6">
        <MockAttendance />
      </div>
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Notifications
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Control what you get notified about
      </p>
      <div className="mt-3">
        <MockNotifications />
      </div>
    </div>
  );
}

const OTHER_PANELS: Record<string, () => React.ReactNode> = {
  general: GeneralPanel,
  profile: ProfilePanel,
  work: WorkPanel,
  notifications: NotificationsPanel,
};

// ============================================================
// JiraProtoShell — settings page shell with customizable integrations tab
// ============================================================

export function JiraProtoShell({
  integrationsContent,
}: {
  integrationsContent: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState('integrations');

  const OtherPanel = activeTab !== 'integrations' ? OTHER_PANELS[activeTab] : undefined;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <DevToolbar />
      <div className="flex flex-1 overflow-hidden">
        <MockSidebar />
        <main className="flex-1 overflow-auto p-6">
          {/* Header */}
          <div className="mb-5">
            <h1
              className="font-brand font-semibold tracking-wide text-foreground"
              style={{ fontSize: scaled(18) }}
            >
              Settings
            </h1>
            <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
              Manage your preferences and integrations
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-5 flex gap-1 border-b border-border pb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'mb-[-1px] flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-brand font-medium uppercase tracking-wider transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                style={{ fontSize: scaled(11), letterSpacing: '1px' }}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.soon && <ComingBadge className="ml-1 normal-case tracking-normal" />}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="max-w-2xl">
            {activeTab === 'integrations' ? (
              <div>
                <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
                  Integrations
                </h2>
                <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  Connect external tools to link data with your time entries.
                </p>
                <div className="mt-4">{integrationsContent}</div>
              </div>
            ) : OtherPanel ? (
              <OtherPanel />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// Provider sandwich wrapper (used by each prototype page)
// ============================================================

export function JiraProtoPage({ children }: { children: React.ReactNode }) {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>{children}</PreferencesProvider>
    </QueryClientProvider>
  );
}
