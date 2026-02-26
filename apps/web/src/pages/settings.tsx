import { useEffect, useState, useCallback } from 'react';
import { Globe, Mail, Phone, ExternalLink, Trash2, FlaskConical, Search } from 'lucide-react';
import { toast } from 'sonner';
import { THEMES, ORG_TIMEZONE, type ThemeId } from '@ternity/shared';
import { useAuth } from '@/providers/auth-provider';
import { SCALES, usePreferences } from '@/providers/preferences-provider';
import { Switch } from '@/components/ui/switch';
import { getTimezoneAbbr } from '@/lib/format';
import { ProjectSelector } from '@/components/timer/project-selector';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

const ENV_COLORS: Record<string, string> = {
  local: 'text-blue-400',
  dev: 'text-amber-400',
  prod: 'text-red-400',
};

function InfoRow({ icon: Icon, value, title }: { icon: React.ElementType; value: React.ReactNode; title?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-1" title={title}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      <span className="min-w-0 truncate text-[12px] text-foreground/80">{value}</span>
    </div>
  );
}

// ── Jira types ───────────────────────────────────────────────────────────

interface JiraConnection {
  id: string;
  cloudId: string;
  siteName: string;
  siteUrl: string;
  siteAvatarUrl: string | null;
  atlassianDisplayName: string;
  atlassianEmail: string | null;
  atlassianAvatarUrl: string | null;
  tokenExpiresAt: string;
  createdAt: string;
}

interface JiraProject {
  key: string;
  name: string;
  projectTypeKey: string;
}

interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  type: string;
  priority: string | null;
  assignee: string | null;
}

// ── Jira OAuth URL builder ───────────────────────────────────────────────

function buildJiraAuthUrl(): string {
  const clientId = import.meta.env.VITE_JIRA_CLIENT_ID;
  const callbackUrl = import.meta.env.VITE_JIRA_CALLBACK_URL;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: 'read:jira-work read:jira-user read:me offline_access',
    redirect_uri: callbackUrl,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  return `https://auth.atlassian.com/authorize?${params}`;
}

// ── Jira Integrations Section ────────────────────────────────────────────

function JiraIntegrations() {
  const [connections, setConnections] = useState<JiraConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, JiraProject[]>>({});
  const [searchResults, setSearchResults] = useState<Record<string, { issues: JiraIssue[]; total: number }>>({});
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [showDebug, setShowDebug] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await apiFetch<JiraConnection[]>('/jira/connections');
      setConnections(data);
    } catch {
      // No connections yet — that's fine
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleDisconnect = async (id: string) => {
    try {
      await apiFetch(`/jira/connections/${id}`, { method: 'DELETE' });
      setConnections((prev) => prev.filter((c) => c.id !== id));
      toast.success('Jira site disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleTestProjects = async (id: string) => {
    try {
      const projects = await apiFetch<JiraProject[]>(`/jira/connections/${id}/projects`);
      setTestResults((prev) => ({ ...prev, [id]: projects }));
    } catch (err) {
      toast.error('Failed to fetch projects');
      console.error(err);
    }
  };

  const handleSearch = async (id: string) => {
    const query = searchQuery[id];
    if (!query) return;

    try {
      const results = await apiFetch<{ issues: JiraIssue[]; total: number }>(
        `/jira/connections/${id}/search?text=${encodeURIComponent(query)}`,
      );
      setSearchResults((prev) => ({ ...prev, [id]: results }));
    } catch (err) {
      toast.error('Search failed');
      console.error(err);
    }
  };

  if (loading) {
    return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-3">
      {/* Connected sites */}
      {connections.map((conn) => (
        <div key={conn.id} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {conn.siteAvatarUrl && (
                <img src={conn.siteAvatarUrl} alt="" className="h-5 w-5 rounded" />
              )}
              <div>
                <div className="text-[13px] font-medium text-foreground">{conn.siteName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {conn.atlassianDisplayName}
                  {conn.atlassianEmail && ` · ${conn.atlassianEmail}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleTestProjects(conn.id)}
                className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                title="Test: fetch projects"
              >
                <FlaskConical className="h-3.5 w-3.5" />
              </button>
              <a
                href={conn.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                title="Open Jira site"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => handleDisconnect(conn.id)}
                className="rounded-md border border-border px-2.5 py-1 text-[11px] text-destructive hover:border-destructive/50 hover:bg-destructive/10"
                title="Disconnect"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Test results: projects */}
          {(() => {
            const projects = testResults[conn.id];
            if (!projects) return null;
            return (
              <div className="mt-3 border-t border-border/50 pt-2">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Projects ({projects.length})
                </div>
                <div className="max-h-40 space-y-0.5 overflow-y-auto">
                  {projects.map((p) => (
                    <div key={p.key} className="flex items-center gap-2 text-[12px]">
                      <span className="font-mono text-primary">{p.key}</span>
                      <span className="text-foreground">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground">{p.projectTypeKey}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Issue search */}
          {testResults[conn.id] && (
            <div className="mt-3 border-t border-border/50 pt-2">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Search Issues
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search text…"
                  value={searchQuery[conn.id] ?? ''}
                  onChange={(e) => setSearchQuery((prev) => ({ ...prev, [conn.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(conn.id)}
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => handleSearch(conn.id)}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>
              {(() => {
                const results = searchResults[conn.id];
                if (!results) return null;
                return (
                  <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                    <div className="text-[10px] text-muted-foreground">
                      {results.total} results
                    </div>
                    {results.issues.map((issue) => (
                      <div key={issue.key} className="flex items-center gap-2 text-[12px]">
                        <span className="font-mono text-primary">{issue.key}</span>
                        <span className="truncate text-foreground">{issue.summary}</span>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {issue.status}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ))}

      {/* Connect button */}
      <button
        onClick={() => { window.location.href = buildJiraAuthUrl(); }}
        className="rounded-md border border-border px-4 py-2 text-[12px] text-foreground hover:border-primary/50 hover:bg-muted/50"
      >
        {connections.length > 0 ? 'Connect another Jira site' : 'Connect Jira'}
      </button>

      {/* Debug toggle */}
      {connections.length > 0 && (
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground"
        >
          {showDebug ? 'Hide' : 'Show'} debug info
        </button>
      )}

      {/* Debug panel */}
      {showDebug && connections.length > 0 && (
        <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-[10px] text-muted-foreground">
          {JSON.stringify(connections, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Settings Page ────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme, scale, setScale, defaultProjectId, setDefaultProject, confirmTimerSwitch, setConfirmTimerSwitch, refreshFromServer } = usePreferences();

  useEffect(() => { refreshFromServer(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
    <div className="grid grid-cols-[1fr_280px] gap-8">
      {/* ── Main: editable preferences ── */}
      <div>
        <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">Settings</h1>

        {/* Appearance */}
        <div className="mt-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Appearance</h2>

          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as ThemeId)}
                className={cn(
                  'rounded-lg border px-3.5 py-1.5 text-[12px] transition-all',
                  theme === t.id
                    ? 'border-primary bg-primary font-semibold text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
              >
                {t.name}
                {t.badge ? ` (${t.badge})` : ''}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">Scale</span>
            <div className="flex gap-1.5">
              {SCALES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setScale(s.value)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11px] transition-all',
                    scale === s.value
                      ? 'border-primary bg-primary font-semibold text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="font-brand text-[calc(18px*var(--t-scale,1.1)/1.1)] font-semibold text-foreground">
              Timer &amp; Entries
            </p>
            <p className="font-brand mt-1 text-[calc(22px*var(--t-scale,1.1)/1.1)] font-bold text-foreground">
              14h 52m
            </p>
            <p className="mt-1 text-[calc(13px*var(--t-scale,1.1)/1.1)] text-muted-foreground">
              Weekly summary across all projects and labels.
            </p>
            <p className="font-brand mt-1 text-[calc(10px*var(--t-scale,1.1)/1.1)] font-normal uppercase tracking-wider text-muted-foreground">
              This week
            </p>
          </div>
        </div>

        {/* Default Project */}
        <div className="mt-6">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Default Project</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Pre-fills the project when starting a new timer or creating an entry.
          </p>
          <ProjectSelector value={defaultProjectId} onChange={setDefaultProject} />
        </div>

        {/* Timer */}
        <div className="mt-6">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Timer</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Controls how the timer behaves when switching between entries.
          </p>
          <label className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-foreground">Confirm before switching timers</div>
              <div className="text-[11px] text-muted-foreground">Show a confirmation dialog when starting a new timer while another is running.</div>
            </div>
            <Switch checked={confirmTimerSwitch} onCheckedChange={setConfirmTimerSwitch} />
          </label>
        </div>

        {/* Integrations */}
        <div className="mt-6">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Integrations</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Connect external tools to link data with your time entries.
          </p>
          <JiraIntegrations />
        </div>
      </div>

      {/* ── Right panel: read-only info ── */}
      <aside className="min-w-0 space-y-3 pt-9">
        {/* Account */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] text-[12px] font-semibold text-[hsl(var(--t-avatar-text))]">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-foreground">{user?.displayName ?? '—'}</div>
              <span className={cn('text-[11px] font-medium', user?.globalRole === 'admin' ? 'text-primary' : 'text-muted-foreground')}>
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
                  {ORG_TIMEZONE} <span className="text-[10px] text-muted-foreground/60">({getTimezoneAbbr()})</span>
                </span>
              }
            />
          </div>
        </div>

        {/* Build */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 px-4 py-3 font-mono text-[11px]">
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
      </aside>
    </div>
  );
}
