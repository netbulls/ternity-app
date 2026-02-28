import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings2, Palette, Link2, Download } from 'lucide-react';
import { THEMES, ORG_TIMEZONE, type ThemeId } from '@ternity/shared';
import { useAuth } from '@/providers/auth-provider';
import { BuildInfo } from '@/components/build-info';
import { SCALES, usePreferences } from '@/providers/preferences-provider';
import { Switch } from '@/components/ui/switch';
import { scaled } from '@/lib/scaled';
import { getTimezoneAbbr } from '@/lib/format';
import { ProjectSelector } from '@/components/timer/project-selector';
import { JiraIntegrations } from '@/components/jira/jira-integrations';
import { DownloadsContent } from '@/pages/downloads';
import { cn } from '@/lib/utils';

// ── Tab definitions ──────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'downloads', label: 'Downloads', icon: Download },
];

// ── Tab panels ───────────────────────────────────────────────────────────

function GeneralPanel() {
  const { user } = useAuth();
  const { defaultProjectId, setDefaultProject, confirmTimerSwitch, setConfirmTimerSwitch } =
    usePreferences();

  return (
    <div>
      {/* Account */}
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Account
        </h2>
        <div className="mt-1.5" style={{ fontSize: scaled(12) }}>
          <span className="text-foreground">{user?.displayName ?? '—'}</span>
          <span className="text-muted-foreground/40"> · </span>
          <span className={user?.globalRole === 'admin' ? 'text-primary' : 'text-muted-foreground'}>
            {user?.globalRole === 'admin' ? 'Admin' : 'Employee'}
          </span>
        </div>
        <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          {user?.email ?? '—'}
          {user?.phone && (
            <>
              <span className="text-muted-foreground/30"> · </span>
              {user.phone}
            </>
          )}
          <span className="text-muted-foreground/30"> · </span>
          {ORG_TIMEZONE}
          <span className="text-muted-foreground/50"> ({getTimezoneAbbr()})</span>
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
          <ProjectSelector value={defaultProjectId} onChange={setDefaultProject} />
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

function AppearancePanel() {
  const { theme, setTheme, scale, setScale } = usePreferences();

  return (
    <div>
      {/* Theme */}
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Theme
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Choose a color theme for the interface
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
      </div>

      {/* Scale */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Scale
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Adjust the UI density
        </p>
        <div className="mt-2 flex gap-1.5">
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
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Preview
        </h2>
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4">
          <p className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18) }}>
            Timer &amp; Entries
          </p>
          <p className="font-brand mt-1 font-bold text-foreground" style={{ fontSize: scaled(22) }}>
            14h 52m
          </p>
          <p className="mt-1 text-muted-foreground" style={{ fontSize: scaled(13) }}>
            Weekly summary across all projects and labels.
          </p>
          <p
            className="font-brand mt-1 font-normal uppercase tracking-wider text-muted-foreground"
            style={{ fontSize: scaled(10) }}
          >
            This week
          </p>
        </div>
      </div>
    </div>
  );
}

function IntegrationsPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Integrations
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Connect external tools to link data with your time entries.
      </p>
      <div className="mt-3">
        <JiraIntegrations />
      </div>
    </div>
  );
}

function DownloadsPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Desktop App
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Download the Ternity desktop app for your platform.
      </p>
      <div className="mt-3">
        <DownloadsContent />
      </div>
    </div>
  );
}

// ── Settings Page ────────────────────────────────────────────────────────

const VALID_TABS = new Set(TABS.map((t) => t.id));

export function SettingsPage() {
  const { refreshFromServer } = usePreferences();
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const activeTab = tab && VALID_TABS.has(tab) ? tab : 'general';

  const setActiveTab = (id: string) => {
    navigate(`/settings/${id}`, { replace: true });
  };

  useEffect(() => {
    refreshFromServer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const panels: Record<string, () => React.ReactNode> = {
    general: GeneralPanel,
    appearance: AppearancePanel,
    integrations: IntegrationsPanel,
    downloads: DownloadsPanel,
  };

  const Panel = panels[activeTab]!;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
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
        <BuildInfo />
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
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={activeTab === 'downloads' ? 'max-w-4xl' : 'max-w-2xl'}>
        <Panel />
      </div>
    </div>
  );
}
