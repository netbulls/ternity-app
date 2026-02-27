import React, { useState, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider, usePreferences, SCALES } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { THEMES, type ThemeId } from '@ternity/shared';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { Switch } from '@/components/ui/switch';
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
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  MockSidebar,
  MockWorkingHours,
  MockAttendance,
  MockNotifications,
  ComingBadge,
  MOCK_SETTINGS_DATA,
} from '@/dev/settings-proto-parts';

// ============================================================
// Tab definitions — with icons, matching Projects scope tabs
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
// Helper: InfoRow (mirrors live settings.tsx)
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

// ============================================================
// Project selector (mock)
// ============================================================

function ProjectSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(MOCK_SETTINGS_DATA.projects[0]!);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative max-w-xs" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-left text-muted-foreground transition-colors hover:border-primary/50"
        style={{ fontSize: scaled(12) }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: selected.color }} />
          <span>{selected.name}</span>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-40 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border bg-card p-1 shadow-lg">
          {MOCK_SETTINGS_DATA.projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setOpen(false); }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
                selected.id === p.id
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              style={{ fontSize: scaled(12) }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span className="flex-1">{p.name}</span>
              {selected.id === p.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab content panels
// ============================================================

function GeneralPanel() {
  const { theme, setTheme, scale, setScale, confirmTimerSwitch, setConfirmTimerSwitch } = usePreferences();

  return (
    <div>
      {/* Appearance */}
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Appearance
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Customize the look and feel
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as ThemeId)}
              className={cn(
                'rounded-lg border px-3.5 py-1.5 transition-all',
                theme === t.id
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
              style={{ fontSize: scaled(12) }}
            >
              {t.name}
              {t.badge ? ` (${t.badge})` : ''}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-muted-foreground" style={{ fontSize: scaled(12) }}>Scale</span>
          <div className="flex gap-1.5">
            {SCALES.map((s) => (
              <button
                key={s.value}
                onClick={() => setScale(s.value)}
                className={cn(
                  'rounded-md border px-2.5 py-1 transition-all',
                  scale === s.value
                    ? 'border-primary bg-primary font-semibold text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
                style={{ fontSize: scaled(11) }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18) }}>
            Timer &amp; Entries
          </p>
          <p className="font-brand mt-1 font-bold text-foreground" style={{ fontSize: scaled(22) }}>
            14h 52m
          </p>
          <p className="mt-1 text-muted-foreground" style={{ fontSize: scaled(13) }}>
            Weekly summary across all projects and labels.
          </p>
          <p className="font-brand mt-1 font-normal uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(10) }}>
            This week
          </p>
        </div>
      </div>

      {/* Default Project */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Default Project
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Pre-fills the project when starting a new timer or creating an entry.
        </p>
        <div className="mt-2">
          <ProjectSelector />
        </div>
      </div>

      {/* Timer */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Timer
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Controls how the timer behaves when switching between entries.
        </p>
        <label className="mt-2 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <div className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              Confirm before switching timers
            </div>
            <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
              Show a confirmation dialog when starting a new timer while another is running.
            </div>
          </div>
          <Switch checked={confirmTimerSwitch} onCheckedChange={setConfirmTimerSwitch} />
        </label>
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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]" style={{ fontSize: scaled(12) }}>
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
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Working Hours
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Your standard work schedule. Used for overtime calculations and capacity planning.
        </p>
        <div className="mt-3">
          <MockWorkingHours />
        </div>
      </div>
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Attendance
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Your employment type determines leave accrual and reporting rules.
        </p>
        <div className="mt-3">
          <MockAttendance />
        </div>
      </div>
    </div>
  );
}

function IntegrationsPanel() {
  const j = MOCK_SETTINGS_DATA.jira;

  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Integrations
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Connect external tools to link data with your time entries.
      </p>

      <div className="mt-3 space-y-3">
        {/* Jira connection card */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
                <Link2 className="h-3 w-3 text-primary" />
              </div>
              <div>
                <div className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
                  {j.site}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  Projects: {j.projects.join(', ')} &middot; {j.url}
                </div>
              </div>
            </div>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary" style={{ fontSize: '9px' }}>
              Connected
            </span>
          </div>
        </div>

        <button
          onClick={() => toast.success('Jira OAuth flow would start here')}
          className="rounded-md border border-border px-4 py-2 text-foreground hover:border-primary/50 hover:bg-muted/50"
          style={{ fontSize: scaled(12) }}
        >
          Connect another Jira site
        </button>
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
        Control what you get notified about.
      </p>
      <div className="mt-3">
        <MockNotifications />
      </div>
    </div>
  );
}

const PANELS: Record<string, () => React.ReactNode> = {
  general: GeneralPanel,
  profile: ProfilePanel,
  work: WorkPanel,
  integrations: IntegrationsPanel,
  notifications: NotificationsPanel,
};

// ============================================================
// Page content
// ============================================================

function V3Content() {
  const [activeTab, setActiveTab] = useState('general');
  const Panel = PANELS[activeTab]!;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <DevToolbar />
      <div className="flex flex-1 overflow-hidden">
        <MockSidebar />
        <main className="flex-1 overflow-auto p-6">
          {/* Header — matches Projects page pattern */}
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

          {/* Scope tabs — matches Projects page scope tabs exactly */}
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
            <Panel />
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// Exported page with provider sandwich
// ============================================================

export function DevSettingsV3Page() {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <V3Content />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
