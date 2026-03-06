import { useState, useEffect, useRef, useMemo } from 'react';
import { Check, ChevronDown, Search, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Special value meaning "show all users' entries" */
export const ALL_USERS = 'all';

interface Props {
  /** null = no filter (my entries), 'all' = everyone, uuid = specific person */
  value: string | null;
  onChange: (userId: string | null) => void;
  triggerClassName?: string;
}

export function UserSelector({ value, onChange, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: users } = useAdminUsers('active', '');

  const sortedUsers = useMemo(
    () => [...(users ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [users],
  );

  const selected = value && value !== ALL_USERS ? sortedUsers.find((u) => u.id === value) : null;
  const isAll = value === ALL_USERS;

  const filtered = search
    ? sortedUsers.filter(
        (u) =>
          u.displayName.toLowerCase().includes(search.toLowerCase()) ||
          u.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : sortedUsers;

  // Focus search on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [open]);

  const handleSelect = (userId: string | null) => {
    onChange(userId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:bg-accent',
            selected || isAll ? 'text-foreground' : 'text-muted-foreground',
            triggerClassName,
          )}
          style={{ fontSize: scaled(12) }}
        >
          {selected ? (
            <>
              <UserAvatar user={selected} size="sm" className="!h-4 !w-4" />
              <span className="max-w-[140px] truncate">{selected.displayName}</span>
            </>
          ) : isAll ? (
            <>
              <Users className="h-3.5 w-3.5" />
              <span>All people</span>
            </>
          ) : (
            <>
              <Users className="h-3.5 w-3.5" />
              <span>Person</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] overflow-hidden p-0" align="start" sideOffset={6}>
        {/* Search */}
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <motion.input
              ref={searchRef}
              className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-foreground outline-none"
              style={{ border: '1px solid hsl(var(--border))', fontSize: scaled(12) }}
              whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
              transition={{ duration: 0.2 }}
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* User list */}
        <div className="max-h-[280px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {/* All people option — always visible unless searching */}
          {!search && (
            <motion.button
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                isAll
                  ? 'bg-primary/8 text-foreground'
                  : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
              )}
              style={{ fontSize: scaled(12) }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(ALL_USERS)}
            >
              <Users className="h-[22px] w-[22px] p-1 text-muted-foreground" />
              <span className="flex-1">All people</span>
              <AnimatePresence>
                {isAll && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                  >
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {filtered.length === 0 ? (
            <div
              className="px-3 py-4 text-center text-muted-foreground"
              style={{ fontSize: scaled(11) }}
            >
              No people match &ldquo;{search}&rdquo;
            </div>
          ) : (
            filtered.map((user, i) => {
              const isSelected = user.id === value;
              return (
                <motion.button
                  key={user.id}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                    isSelected
                      ? 'bg-primary/8 text-foreground'
                      : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
                  )}
                  style={{ fontSize: scaled(12) }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.02, duration: 0.15 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect(user.id)}
                >
                  <UserAvatar user={user} size="sm" />
                  <span className="flex-1 truncate">{user.displayName}</span>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                      >
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
