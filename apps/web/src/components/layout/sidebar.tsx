import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Settings, LogOut, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { useAuth } from '@/providers/auth-provider';
import { useImpersonation } from '@/providers/impersonation-provider';
import { UserAvatar } from '@/components/ui/user-avatar';
import { HourglassLogo } from './hourglass-logo';
import { BuildInfo } from '@/components/build-info';
import { trackingNav, adminNav } from '@/lib/nav-items';

const ENV_NAME = import.meta.env.VITE_ENV_NAME || 'unknown';
const SHOW_BUILD_IN_SIDEBAR = ENV_NAME !== 'prod';

// ── User dropdown menu ──────────────────────────────────────────────

function UserMenu({
  onNavigate,
  onSignOut,
}: {
  onNavigate: (to: string) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col p-1">
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
  const { isImpersonating, targetDisplayName, targetAvatarUrl, targetRole } = useImpersonation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  // When impersonating, show the target user's role context
  const isAdmin = isImpersonating ? targetRole === 'admin' : user?.globalRole === 'admin';
  const displayName = isImpersonating ? targetDisplayName : user?.displayName;
  const avatarUrl = isImpersonating ? targetAvatarUrl : user?.avatarUrl;

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
        <span
          className="font-brand font-semibold uppercase tracking-[3px] text-sidebar-foreground"
          style={{ fontSize: 'calc(15px * var(--t-scale, 1.1))' }}
        >
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

        {/* Admin section — only visible to admins */}
        {isAdmin && (
          <>
            <div
              className="px-2.5 pb-1 pt-4 font-brand uppercase text-muted-foreground opacity-50"
              style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
            >
              Admin
            </div>
            {adminNav.map((item) => (
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
                <item.icon style={{ width: scaled(16), height: scaled(16) }} className="shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User block + dropdown */}
      <div className="relative">
        {/* Dropdown menu — hidden during impersonation */}
        {menuOpen && !isImpersonating && (
          <div
            ref={menuRef}
            className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-[0_-8px_30px_rgba(0,0,0,0.3)]"
          >
            <UserMenu onNavigate={handleNavigate} onSignOut={handleSignOut} />
          </div>
        )}

        {/* Clickable user block */}
        <div
          ref={blockRef}
          onClick={isImpersonating ? undefined : () => setMenuOpen((prev) => !prev)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2.5 py-2.5 transition-colors',
            isImpersonating
              ? 'bg-muted/50'
              : cn('cursor-pointer', menuOpen ? 'bg-muted/80' : 'bg-muted/50 hover:bg-muted/80'),
          )}
        >
          <UserAvatar user={{ displayName: displayName ?? '??', avatarUrl: avatarUrl }} size="md" />
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-medium text-sidebar-foreground"
              style={{ fontSize: scaled(12) }}
            >
              {displayName
                ? (() => {
                    const parts = displayName.split(' ');
                    if (parts.length < 2) return displayName;
                    const last = parts[parts.length - 1];
                    return `${parts.slice(0, -1).join(' ')} ${last?.[0]?.toUpperCase() ?? ''}.`;
                  })()
                : 'Loading...'}
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
          {!isImpersonating && (
            <ChevronsUpDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity',
                menuOpen ? 'opacity-60' : 'opacity-30',
              )}
            />
          )}
        </div>
      </div>

      {/* Build info — hidden on prod */}
      {SHOW_BUILD_IN_SIDEBAR && <BuildInfo className="mt-2" />}
    </aside>
  );
}
