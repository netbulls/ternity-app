import { Globe, Mail, Phone, Shield, User } from 'lucide-react';
import { THEMES, ORG_TIMEZONE, type ThemeId } from '@ternity/shared';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { SCALES, useScale } from '@/providers/scale-provider';
import { useDefaultProject } from '@/hooks/use-default-project';
import { getTimezoneAbbr } from '@/lib/format';
import { ProjectSelector } from '@/components/timer/project-selector';
import { cn } from '@/lib/utils';

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground">{value}</span>
    </div>
  );
}

const ENV_COLORS: Record<string, string> = {
  local: 'text-blue-400',
  dev: 'text-amber-400',
  prod: 'text-red-400',
};

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { scale, setScale } = useScale();
  const { defaultProjectId, setDefaultProject } = useDefaultProject();
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
    <div className="max-w-2xl">
      <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">Settings</h1>

      {/* ── Account + System info ── */}
      <div className="mt-5 grid grid-cols-[1fr_auto] gap-4">
        {/* Account */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] text-[12px] font-semibold text-[hsl(var(--t-avatar-text))]">
              {initials}
            </div>
            <div>
              <div className="text-[13px] font-medium text-foreground">{user?.displayName ?? '—'}</div>
              <span className={cn('text-[11px] font-medium', user?.globalRole === 'admin' ? 'text-primary' : 'text-muted-foreground')}>
                {user?.globalRole === 'admin' ? 'Admin' : 'Employee'}
              </span>
            </div>
          </div>
          <div className="border-t border-border/50 pt-2">
            <InfoRow icon={Mail} label="Email" value={user?.email ?? '—'} />
            <InfoRow icon={Phone} label="Phone" value={user?.phone ?? '—'} />
            <InfoRow
              icon={Globe}
              label="Zone"
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
      </div>

      {/* ── Appearance ── */}
      <div className="mt-6">
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

      {/* ── Default Project ── */}
      <div className="mt-6">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Default Project</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Pre-fills the project when starting a new timer or creating an entry.
        </p>
        <ProjectSelector value={defaultProjectId} onChange={setDefaultProject} />
      </div>
    </div>
  );
}
