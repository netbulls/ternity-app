import { NavLink } from 'react-router-dom';
import {
  Timer,
  List,
  BarChart3,
  Calendar,
  Palmtree,
  Settings,
  LogOut,
  Users,
  FolderKanban,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { HourglassLogo } from './hourglass-logo';

const navItems = [
  { to: '/', label: 'My Day', icon: Timer },
  { to: '/entries', label: 'Entries', icon: List },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/leave', label: 'Leave', icon: Palmtree },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

const adminNavItems = [
  { to: '/users', label: 'Users', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
];

const ENV_COLORS: Record<string, string> = {
  local: 'text-blue-400',
  dev: 'text-amber-400',
  prod: 'text-red-400',
};

function formatBuildTime(iso: string): string {
  const d = new Date(iso);
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${mon}-${day} ${h}:${m}`;
}

function BuildInfo() {
  const envName = import.meta.env.VITE_ENV_NAME || 'unknown';
  const envColor = ENV_COLORS[envName] ?? 'text-muted-foreground';

  return (
    <div className="mt-2 px-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
      {__APP_VERSION__}
      <span className={envColor}> · {envName}</span>
      <span className="text-muted-foreground/50"> · {formatBuildTime(__BUILD_TIME__)}</span>
    </div>
  );
}

export function Sidebar() {
  const { user, signOut } = useAuth();

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-5">
      {/* Logo */}
      <div className="mb-5 flex items-center gap-2 px-2.5">
        <HourglassLogo className="h-[22px] w-[18px] text-primary" />
        <span className="font-brand text-[15px] font-semibold uppercase tracking-[3px] text-sidebar-foreground">
          Ternity
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5">
        <div
          className="px-2.5 pb-1 pt-2 font-brand uppercase text-muted-foreground opacity-50"
          style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
        >
          Tracking
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors',
                isActive
                  ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
            style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Admin nav (admin-only) */}
      {user?.globalRole === 'admin' && (
        <nav className="mt-3 flex flex-col gap-0.5">
          <div
            className="px-2.5 pb-1 pt-2 font-brand uppercase text-muted-foreground opacity-50"
            style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
          >
            Admin
          </div>
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors',
                  isActive
                    ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )
              }
              style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom nav */}
      <nav className="mb-2 flex flex-col gap-0.5">
        <NavLink
          to="/downloads"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors',
              isActive
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )
          }
          style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
        >
          <Download className="h-4 w-4" />
          Downloads
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors',
              isActive
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )
          }
          style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </nav>

      {/* User block */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] text-[11px] font-semibold text-[hsl(var(--t-avatar-text))]">
          {initials}
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-medium text-sidebar-foreground">
            {user?.displayName ?? 'Loading...'}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {user?.globalRole === 'admin' ? 'Admin' : 'Employee'}
          </div>
        </div>
        <button
          onClick={signOut}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Build info */}
      <BuildInfo />
    </aside>
  );
}
