import { useEffect, useState } from 'react';
import {
  Settings2,
  User,
  Briefcase,
  Link2,
  Bell,
  Globe,
  Mail,
  Phone,
} from 'lucide-react';
import { THEMES, ORG_TIMEZONE, type ThemeId } from '@ternity/shared';
import { useAuth } from '@/providers/auth-provider';
import { SCALES, usePreferences } from '@/providers/preferences-provider';
import { Switch } from '@/components/ui/switch';
import { scaled } from '@/lib/scaled';
import { getTimezoneAbbr } from '@/lib/format';
import { ProjectSelector } from '@/components/timer/project-selector';
import { JiraIntegrations } from '@/components/jira/jira-integrations';
import { cn } from '@/lib/utils';

// ── Shared helpers ──────────────────────────────────────────────────────

const ENV_COLORS: Record<string, string> = {
  local: 'text-blue-400',
  dev: 'text-amber-400',
  prod: 'text-red-400',
};

function InfoRow({ icon: Icon, value, title }: { icon: React.ElementType; value: React.ReactNode; title?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-1" title={title}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      <span className="min-w-0 truncate text-foreground/80" style={{ fontSize: scaled(12) }}>{value}</span>
    </div>
  );
}

function SoonBadge() {
  return (
    <span className="ml-1 inline-block rounded bg-muted/50 px-1.5 py-0.5 text-[8px] font-semibold normal-case tracking-normal text-muted-foreground/50">
      Soon
    </span>
  );
}

// ── Tab definitions ──────────────────────────────────────────────────────

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

// ── Tab panels ───────────────────────────────────────────────────────────

function GeneralPanel() {
  const { theme, setTheme, scale, setScale, defaultProjectId, setDefaultProject, confirmTimerSwitch, setConfirmTimerSwitch } = usePreferences();

  return (
    <div>
      {/* Appearance */}
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Appearance</h2>
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
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Default Project</h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Pre-fills the project when starting a new timer or creating an entry.
        </p>
        <div className="mt-2">
          <ProjectSelector value={defaultProjectId} onChange={setDefaultProject} />
        </div>
      </div>

      {/* Timer */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Timer</h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Controls how the timer behaves when switching between entries.
        </p>
        <label className="mt-2 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <div className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>Confirm before switching timers</div>
            <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>Show a confirmation dialog when starting a new timer while another is running.</div>
          </div>
          <Switch checked={confirmTimerSwitch} onCheckedChange={setConfirmTimerSwitch} />
        </label>
      </div>
    </div>
  );
}

function ProfilePanel() {
  const { user } = useAuth();
  const envName = import.meta.env.VITE_ENV_NAME || 'unknown';
  const envColor = ENV_COLORS[envName] ?? 'text-muted-foreground';

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Account</h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Your profile information
      </p>

      <div className="mt-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]" style={{ fontSize: scaled(12) }}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground" style={{ fontSize: scaled(13) }}>{user?.displayName ?? '—'}</div>
            <span className={cn('font-medium', user?.globalRole === 'admin' ? 'text-primary' : 'text-muted-foreground')} style={{ fontSize: scaled(11) }}>
              {user?.globalRole === 'admin' ? 'Admin' : 'Employee'}
            </span>
          </div>
        </div>
        <div className="border-t border-border/50 pt-2">
          <InfoRow icon={Mail} value={user?.email ?? '—'} title={user?.email ?? undefined} />
          <InfoRow icon={Phone} value={user?.phone ?? '—'} />
          <InfoRow
            icon={Globe}
            value={
              <span>
                {ORG_TIMEZONE} <span className="text-muted-foreground/60" style={{ fontSize: scaled(10) }}>({getTimezoneAbbr()})</span>
              </span>
            }
          />
        </div>
      </div>

      {/* Build info */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Build</h2>
        <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 px-4 py-3 font-mono" style={{ fontSize: scaled(11) }}>
          <div className="flex items-center gap-2.5">
            <span className="w-12 text-muted-foreground/70">Ver</span>
            <span className="text-foreground">{__APP_VERSION__}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-12 text-muted-foreground/70">Env</span>
            <span className={cn('font-semibold', envColor)}>{envName}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-12 text-muted-foreground/70">Built</span>
            <span className="text-muted-foreground">{new Date(__BUILD_TIME__).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkPanel() {
  return (
    <div>
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Working Hours</h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Your standard work schedule. Used for overtime calculations and capacity planning.
        </p>
        <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center">
          <p className="text-muted-foreground" style={{ fontSize: scaled(12) }}>Coming soon</p>
        </div>
      </div>
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Attendance</h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Your employment type determines leave accrual and reporting rules.
        </p>
        <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center">
          <p className="text-muted-foreground" style={{ fontSize: scaled(12) }}>Coming soon</p>
        </div>
      </div>
    </div>
  );
}

function IntegrationsPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Integrations</h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Connect external tools to link data with your time entries.
      </p>
      <div className="mt-3">
        <JiraIntegrations />
      </div>
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>Notifications</h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Control what you get notified about.
      </p>
      <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center">
        <p className="text-muted-foreground" style={{ fontSize: scaled(12) }}>Coming soon</p>
      </div>
    </div>
  );
}

// ── Settings Page ────────────────────────────────────────────────────────

export function SettingsPage() {
  const { refreshFromServer } = usePreferences();
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => { refreshFromServer(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const panels: Record<string, () => React.ReactNode> = {
    general: GeneralPanel,
    profile: ProfilePanel,
    work: WorkPanel,
    integrations: IntegrationsPanel,
    notifications: NotificationsPanel,
  };

  const Panel = panels[activeTab]!;

  return (
    <div>
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

      {/* Tabs — matches Projects scope tabs */}
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
            {tab.soon && <SoonBadge />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-w-2xl">
        <Panel />
      </div>
    </div>
  );
}
