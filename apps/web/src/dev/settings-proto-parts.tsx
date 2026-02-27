import { useState, useRef, useEffect } from 'react';
import { THEMES, type ThemeId } from '@ternity/shared';
import { SCALES, usePreferences } from '@/providers/preferences-provider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { toast } from 'sonner';
import {
  ChevronDown,
  Check,
  Palette,
  Timer,
  Clock,
  Building2,
  Link2,
  Bell,
  User,
  Briefcase,
  LayoutDashboard,
  BarChart3,
  Calendar,
  Palmtree,
  Users,
  FolderKanban,
  Download,
  Settings,
  LogOut,
} from 'lucide-react';
import { HourglassLogo } from '@/components/layout/hourglass-logo';

// ============================================================
// Mock data
// ============================================================

export const MOCK_SETTINGS_DATA = {
  user: {
    name: 'Przemek Rudzki',
    initials: 'PR',
    email: 'przemek@acme.io',
    role: 'Admin',
    phone: '+48 501 234 567',
    timezone: 'Europe/Warsaw (UTC+1)',
  },
  projects: [
    { id: 'bit', name: 'BIT — Bitflow Platform', color: 'hsl(var(--t-project-1))' },
    { id: 'adm', name: 'ADM — Admin Dashboard', color: 'hsl(var(--t-project-2))' },
    { id: 'int', name: 'INT — Internal Tools', color: 'hsl(var(--t-project-3))' },
    { id: 'web', name: 'WEB — Marketing Website', color: 'hsl(var(--t-project-4))' },
  ],
  jira: {
    site: 'NETBULLS',
    url: 'netbulls.atlassian.net',
    projects: ['ADM', 'BIT', 'INT'],
  },
  schedule: [
    { day: 'Mon', start: '09:00', end: '17:00', hours: '8h' },
    { day: 'Tue', start: '09:00', end: '17:00', hours: '8h' },
    { day: 'Wed', start: '09:00', end: '17:00', hours: '8h' },
    { day: 'Thu', start: '09:00', end: '17:00', hours: '8h' },
    { day: 'Fri', start: '09:00', end: '15:00', hours: '6h' },
  ],
  build: {
    version: 'v0.3.0-12-g7c23eb6',
    env: 'dev',
    date: '2026-02-26 14:32',
  },
};

// ============================================================
// Icons for card sections (V4)
// ============================================================

export const SECTION_ICONS = {
  appearance: Palette,
  timer: Timer,
  workingHours: Clock,
  attendance: Briefcase,
  jira: Link2,
  notifications: Bell,
  profile: User,
  building: Building2,
} as const;

// ============================================================
// Coming badge
// ============================================================

export function ComingBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded text-[8px] font-semibold',
        'bg-muted/50 px-1.5 py-0.5 text-muted-foreground/50',
        className,
      )}
    >
      Soon
    </span>
  );
}

// ============================================================
// Theme selector — wired to real preferences
// ============================================================

export function MockThemeSelector() {
  const { theme, setTheme } = usePreferences();

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as ThemeId)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs transition-colors',
              theme === t.id
                ? 'border-primary bg-primary font-semibold text-primary-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30',
            )}
            style={{ fontSize: scaled(12) }}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Scale selector — wired to real preferences
// ============================================================

export function MockScaleSelector() {
  const { scale: activeScale, setScale } = usePreferences();

  return (
    <div className="mt-2.5 flex items-center gap-2">
      <span className="text-xs text-muted-foreground" style={{ fontSize: scaled(12) }}>
        Scale
      </span>
      <div className="flex gap-1">
        {SCALES.map((s) => (
          <button
            key={s.label}
            onClick={() => setScale(s.value)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs transition-colors',
              activeScale === s.value
                ? 'border-primary bg-primary font-medium text-primary-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30',
            )}
            style={{ fontSize: scaled(11) }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Preview stat card
// ============================================================

export function MockPreviewCard() {
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="font-brand text-base font-semibold" style={{ fontSize: scaled(16) }}>
        Timer &amp; Entries
      </div>
      <div className="font-brand mt-0.5 text-xl font-bold text-primary" style={{ fontSize: scaled(22) }}>
        14h 52m
      </div>
      <div
        className="font-brand mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/50"
        style={{ fontSize: scaled(10) }}
      >
        This week
      </div>
    </div>
  );
}

// ============================================================
// Project selector dropdown (mock)
// ============================================================

export function MockProjectSelector() {
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
        className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-muted-foreground/30"
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
              onClick={() => {
                setSelected(p);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
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
// Timer confirm toggle
// ============================================================

export function MockTimerToggle() {
  const [on, setOn] = useState(true);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div>
        <div className="text-sm font-medium" style={{ fontSize: scaled(13) }}>
          Confirm before switching timers
        </div>
        <div className="text-xs text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Show a confirmation dialog when starting a new timer while one is running
        </div>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

// ============================================================
// Working hours grid (read-only + Coming badge)
// ============================================================

export function MockWorkingHours() {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium" style={{ fontSize: scaled(13) }}>
          Working Hours
        </span>
        <ComingBadge />
      </div>
      <div className="grid max-w-sm grid-cols-[auto_1fr_1fr_auto] items-center gap-x-2 gap-y-1">
        {MOCK_SETTINGS_DATA.schedule.map((s) => (
          <div key={s.day} className="contents" style={{ fontSize: scaled(11) }}>
            <span className="font-medium text-foreground/60">{s.day}</span>
            <span className="rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-center font-brand">
              {s.start}
            </span>
            <span className="rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-center font-brand">
              {s.end}
            </span>
            <span className="font-brand text-muted-foreground/50" style={{ fontSize: scaled(10) }}>
              {s.hours}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Attendance (read-only + Coming badge)
// ============================================================

export function MockAttendance() {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium" style={{ fontSize: scaled(13) }}>
          Employment Type
        </span>
        <ComingBadge />
      </div>
      <div
        className="inline-block rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
        style={{ fontSize: scaled(12) }}
      >
        Contractor (B2B)
      </div>
    </div>
  );
}

// ============================================================
// Jira integration card
// ============================================================

export function MockJiraCard() {
  return (
    <div>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Link2 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ fontSize: scaled(13) }}>
            {MOCK_SETTINGS_DATA.jira.site}
          </div>
          <div className="text-xs text-muted-foreground" style={{ fontSize: scaled(11) }}>
            Projects: {MOCK_SETTINGS_DATA.jira.projects.join(' / ')} &middot; {MOCK_SETTINGS_DATA.jira.url}
          </div>
        </div>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
          Connected
        </span>
      </div>
      <button
        onClick={() => toast.success('Jira OAuth flow would start here')}
        className="mt-2 rounded-lg border border-border bg-transparent px-4 py-2 text-xs text-foreground transition-colors hover:bg-muted"
        style={{ fontSize: scaled(12) }}
      >
        Connect another Jira site
      </button>
    </div>
  );
}

// ============================================================
// Notifications (2 toggles + Coming badge)
// ============================================================

export function MockNotifications() {
  const [leave, setLeave] = useState(true);
  const [presence, setPresence] = useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium" style={{ fontSize: scaled(13) }}>
          Notifications
        </span>
        <ComingBadge />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <div className="text-xs font-medium" style={{ fontSize: scaled(12) }}>
              Leave updates
            </div>
            <div className="text-[11px] text-muted-foreground" style={{ fontSize: scaled(11) }}>
              Get notified when leave requests change
            </div>
          </div>
          <Switch checked={leave} onCheckedChange={setLeave} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <div className="text-xs font-medium" style={{ fontSize: scaled(12) }}>
              Presence changes
            </div>
            <div className="text-[11px] text-muted-foreground" style={{ fontSize: scaled(11) }}>
              Get notified when team members go online/offline
            </div>
          </div>
          <Switch checked={presence} onCheckedChange={setPresence} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Profile card
// ============================================================

export function MockProfileCard({ compact }: { compact?: boolean }) {
  const u = MOCK_SETTINGS_DATA.user;

  return (
    <div className={cn('rounded-lg border border-border bg-muted/30', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] text-xs font-semibold text-[hsl(var(--t-avatar-text))]">
          {u.initials}
        </div>
        <div>
          <div className="text-sm font-medium" style={{ fontSize: scaled(13) }}>
            {u.name}
          </div>
          <div className="text-xs text-muted-foreground" style={{ fontSize: scaled(11) }}>
            {u.role}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground" style={{ fontSize: scaled(11) }}>
          <div className="flex justify-between">
            <span>Email</span>
            <span className="text-foreground">{u.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Phone</span>
            <span className="text-foreground">{u.phone}</span>
          </div>
          <div className="flex justify-between">
            <span>Timezone</span>
            <span className="text-foreground">{u.timezone}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Build info card
// ============================================================

export function MockBuildInfo() {
  const b = MOCK_SETTINGS_DATA.build;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="space-y-1 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
        <div>{b.version}</div>
        <div>
          <span className="text-amber-500">{b.env}</span>
          <span className="opacity-50"> &middot; {b.date}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Section wrapper (for V1, V3)
// ============================================================

export function SettingsSection({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-6" id={id}>
      <h3 className="text-sm font-semibold" style={{ fontSize: scaled(14) }}>
        {title}
      </h3>
      {description && (
        <p className="mt-0.5 text-xs text-muted-foreground" style={{ fontSize: scaled(11) }}>
          {description}
        </p>
      )}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

// ============================================================
// Mock sidebar — mirrors real Sidebar but with static data
// ============================================================

const TRACKING_NAV = [
  { icon: Timer, label: 'Timer & Entries' },
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Calendar, label: 'Calendar' },
  { icon: Palmtree, label: 'Leave' },
  { icon: BarChart3, label: 'Reports' },
];

const ADMIN_NAV = [
  { icon: Users, label: 'Users' },
  { icon: FolderKanban, label: 'Projects' },
];

function NavItem({ icon: Icon, label, active }: { icon: typeof Timer; label: string; active?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors',
        active
          ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
      style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

export function MockSidebar() {
  const u = MOCK_SETTINGS_DATA.user;
  const b = MOCK_SETTINGS_DATA.build;

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5">
      {/* Logo */}
      <div className="mb-5 flex items-center gap-2 px-2.5">
        <HourglassLogo className="h-[22px] w-[18px] text-primary" />
        <span className="font-brand text-[15px] font-semibold uppercase tracking-[3px] text-sidebar-foreground">
          Ternity
        </span>
      </div>

      {/* Tracking nav */}
      <nav className="flex flex-col gap-0.5">
        <div
          className="px-2.5 pb-1 pt-2 font-brand uppercase text-muted-foreground opacity-50"
          style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
        >
          Tracking
        </div>
        {TRACKING_NAV.map((item) => (
          <NavItem key={item.label} {...item} />
        ))}
      </nav>

      {/* Admin nav */}
      <nav className="mt-3 flex flex-col gap-0.5">
        <div
          className="px-2.5 pb-1 pt-2 font-brand uppercase text-muted-foreground opacity-50"
          style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
        >
          Admin
        </div>
        {ADMIN_NAV.map((item) => (
          <NavItem key={item.label} {...item} />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom nav */}
      <nav className="mb-2 flex flex-col gap-0.5">
        <NavItem icon={Download} label="Downloads" />
        <NavItem icon={Settings} label="Settings" active />
      </nav>

      {/* User block */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] text-[11px] font-semibold text-[hsl(var(--t-avatar-text))]">
          {u.initials}
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-medium text-sidebar-foreground">{u.name}</div>
          <div className="text-[10px] text-muted-foreground">{u.role}</div>
        </div>
        <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Build info */}
      <div className="mt-2 px-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
        {b.version}
        <span className="text-amber-400"> &middot; {b.env}</span>
        <span className="text-muted-foreground/50"> &middot; {b.date}</span>
      </div>
    </aside>
  );
}
