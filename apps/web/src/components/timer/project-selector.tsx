import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, FolderKanban, Search, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/use-reference-data';
import { getRecentProjectIds, trackRecentProject } from '@/hooks/use-recent-projects';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ProjectOption } from '@ternity/shared';

interface Props {
  value: string | null;
  onChange: (projectId: string | null) => void;
  /** Auto-open dropdown on mount (used by entry-row inline edit) */
  defaultOpen?: boolean;
  /** Called when dropdown closes without selection (e.g. click outside) */
  onClose?: () => void;
  /** Extra classes applied to the trigger button */
  triggerClassName?: string;
}

export function ProjectSelector({
  value,
  onChange,
  defaultOpen,
  onClose,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: projects } = useProjects();

  const selected = projects?.find((p) => p.id === value) ?? null;

  // Group projects by client, with recent projects on top
  const allProjects = projects ?? [];
  const grouped = groupByClient(allProjects);
  const recentIds = getRecentProjectIds();
  const recentProjects = recentIds
    .map((id) => allProjects.find((p) => p.id === id))
    .filter((p): p is ProjectOption => p != null);

  // Filter by search
  const filtered = search
    ? grouped
        .map((g) => ({
          ...g,
          projects: g.projects.filter(
            (p) =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              g.client.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((g) => g.projects.length > 0)
    : [
        ...(recentProjects.length > 0 ? [{ client: 'Recent', projects: recentProjects }] : []),
        ...grouped,
      ];

  // Focus search on open
  useEffect(() => {
    if (open) {
      // Delay to wait for popover to render
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onClose?.();
  };

  const handleSelect = (projectId: string | null) => {
    if (projectId) trackRecentProject(projectId);
    onChange(projectId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent',
            selected ? 'text-foreground' : 'text-muted-foreground',
            triggerClassName,
          )}
        >
          {selected ? (
            <>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selected.color ?? '#00D4AA' }}
              />
              <span className="max-w-[120px] truncate">{selected.name}</span>
            </>
          ) : (
            <>
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Project</span>
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
              className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-[12px] text-foreground outline-none"
              style={{ border: '1px solid hsl(var(--border))' }}
              whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
              transition={{ duration: 0.2 }}
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Project list */}
        <div className="max-h-[220px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
              No projects match &ldquo;{search}&rdquo;
            </div>
          ) : (
            filtered.map((group, gi) => (
              <div key={group.client}>
                <div
                  className="flex items-center gap-1.5 px-2.5 pb-1 pt-2.5 font-brand text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
                  style={{ letterSpacing: '1.5px', opacity: 0.6 }}
                >
                  {group.client === 'Recent' && <Clock className="h-2.5 w-2.5" />}
                  {group.client}
                </div>
                {group.projects.map((p, pi) => {
                  const isSelected = p.id === value;
                  return (
                    <motion.button
                      key={p.id}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors',
                        isSelected
                          ? 'bg-primary/8 text-foreground'
                          : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
                      )}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.05 + pi * 0.03, duration: 0.15 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelect(p.id)}
                    >
                      <motion.span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: p.color ?? '#00D4AA' }}
                        animate={isSelected ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.3 }}
                      />
                      <span className="flex-1 truncate">{p.name}</span>
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
                })}
              </div>
            ))
          )}
        </div>

        {/* No project option */}
        <div className="border-t border-border p-1">
          <motion.button
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(null)}
          >
            <X className="h-3 w-3" />
            <span>No project</span>
          </motion.button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function groupByClient(projects: ProjectOption[]) {
  const map = new Map<string, ProjectOption[]>();
  for (const p of projects) {
    const client = p.clientName ?? 'No Client';
    if (!map.has(client)) map.set(client, []);
    map.get(client)!.push(p);
  }
  return Array.from(map.entries()).map(([client, projectList]) => ({
    client,
    projects: projectList,
  }));
}
