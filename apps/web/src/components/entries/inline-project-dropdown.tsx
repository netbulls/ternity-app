import { Check, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import type { ProjectOption } from '@ternity/shared';

export function groupByClient(projects: ProjectOption[]) {
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

export interface InlineProjectDropdownProps {
  projects: ProjectOption[];
  selectedId: string | null;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (projectId: string | null) => void;
  onCancel: () => void;
}

export function InlineProjectDropdown({
  projects,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  onCancel,
}: InlineProjectDropdownProps) {
  const grouped = groupByClient(projects);
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
    : grouped;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="absolute left-0 top-full z-30 mt-1 w-[260px] overflow-hidden rounded-lg border border-border shadow-lg"
      style={{ background: 'hsl(var(--popover))' }}
    >
      {/* Search input */}
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <motion.input
            className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-[12px] text-foreground outline-none"
            style={{ border: '1px solid hsl(var(--border))' }}
            whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
            placeholder="Search projects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel();
            }}
            autoFocus
          />
        </div>
      </div>

      {/* Project list */}
      <div className="max-h-[220px] overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
            No projects match &ldquo;{search}&rdquo;
          </div>
        ) : (
          filtered.map((group, gi) => (
            <div key={group.client}>
              <div
                className="px-2.5 pb-1 pt-2.5 font-brand text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
                style={{ letterSpacing: '1.5px', opacity: 0.6 }}
              >
                {group.client}
              </div>
              {group.projects.map((p, pi) => {
                const isSelected = p.id === selectedId;
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
                    onClick={() => onSelect(p.id)}
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
          onClick={() => onSelect(null)}
        >
          <X className="h-3 w-3" />
          <span>No project</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
