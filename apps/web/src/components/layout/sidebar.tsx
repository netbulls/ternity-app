import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Settings, LogOut, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { useAuth } from '@/providers/auth-provider';
import { HourglassLogo } from './hourglass-logo';
import { BuildInfo } from '@/components/build-info';
import { trackingNav, adminNav } from '@/lib/nav-items';

const ENV_NAME = import.meta.env.VITE_ENV_NAME || 'unknown';
const SHOW_BUILD_IN_SIDEBAR = ENV_NAME !== 'prod';

// ── User dropdown menu ──────────────────────────────────────────────

function UserMenu({
  isAdmin,
  onNavigate,
  onSignOut,
}: {
  isAdmin: boolean;
  onNavigate: (to: string) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col p-1">
      {isAdmin && (
        <>
          <div
            className="px-2.5 pb-1 pt-1.5 font-brand uppercase text-muted-foreground opacity-50"
            style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '1.5px' }}
          >
            Admin
          </div>
          {adminNav.map((item) => (
            <button
              key={item.to}
              onClick={() => onNavigate(item.to)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              style={{ fontSize: scaled(12) }}
            >
              <item.icon
                style={{ width: scaled(15), height: scaled(15) }}
                className="shrink-0 text-muted-foreground"
              />
              {item.label}
            </button>
          ))}
          <div className="mx-1.5 my-1 h-px bg-border" />
        </>
      )}
      <button
        onClick={() => onNavigate('/settings')}
        className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        style={{ fontSize: scaled(12) }}
      >
        <Settings
          style={{ width: scaled(15), height: scaled(15) }}
          className="shrink-0 text-muted-foreground"
        />
        Settings
      </button>
      <div className="mx-1.5 my-1 h-px bg-border" />
      <button
        onClick={onSignOut}
        className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-destructive transition-colors hover:bg-destructive/10"
        style={{ fontSize: scaled(12) }}
      >
        <LogOut style={{ width: scaled(15), height: scaled(15) }} className="shrink-0" />
        Sign out
      </button>
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.globalRole === 'admin';

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        blockRef.current &&
        !blockRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  function handleNavigate(to: string) {
    setMenuOpen(false);
    navigate(to);
  }

  function handleSignOut() {
    setMenuOpen(false);
    signOut();
  }

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar px-3 pb-3 pt-5">
      {/* Logo */}
      <div className="mb-5 flex items-center gap-2 px-2.5">
        <HourglassLogo className="h-[22px] w-[18px] text-primary" />
        <span className="font-brand text-[15px] font-semibold uppercase tracking-[3px] text-sidebar-foreground">
          Ternity
        </span>
      </div>

      {/* Nav — product pages only */}
      <nav className="flex flex-col gap-0.5">
        <div
          className="px-2.5 pb-1 pt-2 font-brand uppercase text-muted-foreground opacity-50"
          style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
        >
          Tracking
        </div>
        {trackingNav.map((item) => (
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
            <item.icon style={{ width: scaled(16), height: scaled(16) }} className="shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User block + dropdown */}
      <div className="relative">
        {/* Dropdown menu */}
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-[0_-8px_30px_rgba(0,0,0,0.3)]"
          >
            <UserMenu isAdmin={isAdmin} onNavigate={handleNavigate} onSignOut={handleSignOut} />
          </div>
        )}

        {/* Clickable user block */}
        <div
          ref={blockRef}
          onClick={() => setMenuOpen((prev) => !prev)}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 transition-colors',
            menuOpen ? 'bg-muted/80' : 'bg-muted/50 hover:bg-muted/80',
          )}
        >
          <div
            className="flex shrink-0 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]"
            style={{ width: scaled(30), height: scaled(30), fontSize: scaled(11) }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-medium text-sidebar-foreground"
              style={{ fontSize: scaled(12) }}
            >
              {user?.displayName ?? 'Loading...'}
            </div>
            <div className="truncate text-muted-foreground" style={{ fontSize: scaled(10) }}>
              Netbulls
              {isAdmin && (
                <span className="ml-1 text-primary" style={{ fontSize: scaled(9) }}>
                  Admin
                </span>
              )}
            </div>
          </div>
          <ChevronsUpDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity',
              menuOpen ? 'opacity-60' : 'opacity-30',
            )}
          />
        </div>
      </div>

      {/* Build info — hidden on prod */}
      {SHOW_BUILD_IN_SIDEBAR && <BuildInfo className="mt-2" />}
    </aside>
  );
}
