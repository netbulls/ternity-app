import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Timer, LayoutDashboard, BarChart3, Calendar, Palmtree, FolderKanban, Settings, LogOut, Users, X, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useImpersonation } from '@/providers/impersonation-provider';
import { useUsers } from '@/hooks/use-reference-data';
import { HourglassLogo } from './hourglass-logo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const navItems = [
  { to: '/', label: 'Timer & Entries', icon: Timer },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/leave', label: 'Leave', icon: Palmtree },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
];

const adminNavItems = [
  { to: '/users', label: 'Users', icon: Users },
];

function ImpersonationPicker() {
  const [open, setOpen] = useState(false);
  const { targetUserId, targetDisplayName, setTarget, clearImpersonation, canImpersonate } =
    useImpersonation();
  const { data: allUsers } = useUsers();

  if (!canImpersonate) return null;

  return (
    <div className="mt-4 mb-1 px-1">
      <div
        className="font-brand uppercase text-muted-foreground opacity-50 mb-1.5 px-1.5"
        style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
      >
        Viewing as
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[12px] transition-colors hover:bg-sidebar-accent',
              targetUserId
                ? 'border border-primary/50 bg-primary/10 text-primary'
                : 'text-muted-foreground',
            )}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate text-left">
              {targetDisplayName ?? 'Myself'}
            </span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search users..." />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    clearImpersonation();
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">Myself</span>
                  {!targetUserId && <Check className="ml-auto h-4 w-4" />}
                </CommandItem>
                {allUsers?.map((u) => (
                  <CommandItem
                    key={u.id}
                    onSelect={() => {
                      setTarget(u.id, u.displayName);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{u.displayName}</span>
                    {u.id === targetUserId && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {targetUserId && (
        <button
          onClick={clearImpersonation}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Back to me
        </button>
      )}
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

      <ImpersonationPicker />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings link */}
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          cn(
            'mb-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors',
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
    </aside>
  );
}
