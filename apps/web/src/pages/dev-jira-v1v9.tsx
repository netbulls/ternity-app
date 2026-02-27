import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, X, Plus, Code2, RefreshCw, Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  JiraProtoShell,
  JiraProtoPage,
  ConnectionHeader,
  ConnectButton,
  buildJql,
  MOCK_JIRA_CONNECTIONS,
  MOCK_JIRA_STATUSES,
  MOCK_PROJECTS_BY_CONNECTION,
  DEFAULT_PROJECTS_BY_CONNECTION,
  DEFAULT_EXCLUDED_BY_CONNECTION,
  type JiraConnection,
} from '@/dev/jira-settings-proto-parts';

// ============================================================
// Mock sync times per connection
// ============================================================

const MOCK_LAST_SYNC: Record<string, Date> = {
  netbulls: new Date(Date.now() - 4 * 60_000),      // 4 min ago
  acme: new Date(Date.now() - 2 * 3600_000),         // 2 hours ago
  oakridge: new Date(Date.now() - 26 * 3600_000),    // yesterday
};

function formatSyncTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ============================================================
// Searchable popover picker — shared by projects & statuses
// ============================================================

function PickerPopover({
  items,
  selected,
  onToggle,
  trigger,
  searchPlaceholder,
  emptyLabel,
  renderItem,
}: {
  items: { key: string; label: string; secondary?: string }[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  trigger: React.ReactNode;
  searchPlaceholder: string;
  emptyLabel: string;
  renderItem?: (item: { key: string; label: string; secondary?: string }, isSelected: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = search
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(search.toLowerCase()) ||
          i.key.toLowerCase().includes(search.toLowerCase()) ||
          (i.secondary?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : items;

  return (
    <div className="relative inline-block" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-[240px] overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            {/* Search */}
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  className="h-7 w-full rounded-md border border-border bg-muted/40 pl-8 pr-3 text-foreground outline-none transition-colors focus:border-primary/50"
                  style={{ fontSize: scaled(11) }}
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Items */}
            <div className="max-h-[200px] overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  {emptyLabel}
                </div>
              ) : (
                filtered.map((item, i) => {
                  const isSelected = selected.has(item.key);
                  return (
                    <motion.button
                      key={item.key}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                        isSelected
                          ? 'bg-primary/8 text-foreground'
                          : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
                      )}
                      style={{ fontSize: scaled(11) }}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.12 }}
                      onClick={() => onToggle(item.key)}
                    >
                      {renderItem ? (
                        renderItem(item, isSelected)
                      ) : (
                        <>
                          <span className="font-mono text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                            {item.key}
                          </span>
                          <span className="flex-1 truncate">{item.label}</span>
                        </>
                      )}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// V1+V9 Hybrid — Accordion + Tag Builder + Sync + Pickers
// ============================================================

function HybridConnectionCard({ connection, defaultExpanded }: { connection: JiraConnection; defaultExpanded?: boolean }) {
  const projects = MOCK_PROJECTS_BY_CONNECTION[connection.id] ?? [];
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    () => new Set(DEFAULT_PROJECTS_BY_CONNECTION[connection.id] ?? []),
  );
  const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(
    () => new Set(DEFAULT_EXCLUDED_BY_CONNECTION[connection.id] ?? []),
  );
  const [showJql, setShowJql] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => MOCK_LAST_SYNC[connection.id] ?? new Date());
  const [animDone, setAnimDone] = useState(defaultExpanded ?? false);

  const toggleProject = (key: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeProject = (key: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const toggleStatus = (id: string) => {
    setExcludedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeStatus = (id: string) => {
    setExcludedStatuses((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleResync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSync(new Date());
      toast.success(`Synced ${connection.site} issues`);
    }, 1500);
  };

  const jql = buildJql(selectedProjects, excludedStatuses);

  const summary = `${selectedProjects.size} project${selectedProjects.size !== 1 ? 's' : ''} · ${excludedStatuses.size} excluded · ${formatSyncTime(lastSync)}`;

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        expanded ? 'border-primary/30' : 'border-border',
        'bg-muted/15',
      )}
    >
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/20"
      >
        <div className="min-w-0 flex-1">
          <ConnectionHeader
            connection={connection}
            summary={!expanded ? summary : undefined}
            actions={<div />}
          />
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              expanded ? 'text-primary' : 'text-muted-foreground/40',
            )}
          />
        </motion.div>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className={animDone ? 'overflow-visible' : 'overflow-hidden'}
            onAnimationComplete={(def) => {
              if (typeof def === 'object' && 'height' in def && def.height === 'auto') setAnimDone(true);
            }}
            onAnimationStart={() => setAnimDone(false)}
          >
            <div className="border-t border-border/50 px-4 py-4">
              {/* Sync row */}
              <div className="mb-4 flex items-center gap-2">
                <span className="text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                  Last synced {formatSyncTime(lastSync)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResync();
                  }}
                  disabled={syncing}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    syncing && 'pointer-events-none opacity-50',
                  )}
                  style={{ fontSize: scaled(10) }}
                >
                  <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />
                  {syncing ? 'Syncing...' : 'Sync now'}
                </button>
              </div>

              {/* Visual query builder */}
              <div className="space-y-3" style={{ fontSize: scaled(12) }}>
                {/* PROJECT IN line */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                    PROJECT IN
                  </span>
                  {[...selectedProjects].map((key) => {
                    const proj = projects.find((p) => p.key === key);
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary"
                        style={{ fontSize: scaled(11) }}
                      >
                        {key}
                        {proj && (
                          <span className="text-primary/50" style={{ fontSize: scaled(9) }}>
                            {proj.name}
                          </span>
                        )}
                        <button
                          onClick={() => removeProject(key)}
                          className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                  <PickerPopover
                    items={projects.map((p) => ({ key: p.key, label: p.name }))}
                    selected={selectedProjects}
                    onToggle={toggleProject}
                    searchPlaceholder="Search projects..."
                    emptyLabel="No matching projects"
                    trigger={
                      <button
                        className={cn(
                          'inline-flex items-center gap-0.5 rounded-md border border-dashed px-1.5 py-0.5 transition-colors',
                          'border-primary/40 text-primary hover:border-primary hover:bg-primary/5',
                        )}
                        style={{ fontSize: scaled(11) }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    }
                  />
                </div>

                {/* AND STATUS NOT IN line */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                    AND STATUS NOT IN
                  </span>
                  {[...excludedStatuses].map((id) => {
                    const status = MOCK_JIRA_STATUSES.find((s) => s.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-destructive line-through"
                        style={{ fontSize: scaled(11) }}
                      >
                        {status?.name ?? id}
                        <button
                          onClick={() => removeStatus(id)}
                          className="rounded-full p-0.5 transition-colors hover:bg-destructive/20"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                  <PickerPopover
                    items={MOCK_JIRA_STATUSES.map((s) => ({ key: s.id, label: s.name, secondary: s.category }))}
                    selected={excludedStatuses}
                    onToggle={toggleStatus}
                    searchPlaceholder="Search statuses..."
                    emptyLabel="No matching statuses"
                    renderItem={(item, isSelected) => (
                      <>
                        <span
                          className={cn(
                            'flex-1 truncate',
                            isSelected && 'text-destructive line-through',
                          )}
                        >
                          {item.label}
                        </span>
                        {item.secondary && (
                          <span className="text-muted-foreground/40" style={{ fontSize: scaled(9) }}>
                            {item.secondary}
                          </span>
                        )}
                      </>
                    )}
                    trigger={
                      <button
                        className={cn(
                          'inline-flex items-center gap-0.5 rounded-md border border-dashed px-1.5 py-0.5 transition-colors',
                          'border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/5',
                        )}
                        style={{ fontSize: scaled(11) }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    }
                  />
                </div>

                {/* ORDER BY line */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                    ORDER BY
                  </span>
                  <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                    updated DESC
                  </span>
                </div>
              </div>

              {/* View as JQL toggle */}
              <div className="mt-4 border-t border-border/50 pt-3">
                <button
                  onClick={() => setShowJql(!showJql)}
                  className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  style={{ fontSize: scaled(11) }}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  {showJql ? 'Hide JQL' : 'View as JQL'}
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform',
                      showJql && 'rotate-180',
                    )}
                  />
                </button>
                {showJql && (
                  <div className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                    <div
                      className="font-mono text-muted-foreground"
                      style={{ fontSize: scaled(10), lineHeight: '1.5' }}
                    >
                      {jql}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HybridIntegrationsPanel() {
  return (
    <div className="space-y-3">
      {MOCK_JIRA_CONNECTIONS.map((conn, i) => (
        <HybridConnectionCard key={conn.id} connection={conn} defaultExpanded={i === 0} />
      ))}
      <ConnectButton hasConnection />
    </div>
  );
}

// ============================================================
// Exported page
// ============================================================

export function DevJiraV1V9Page() {
  return (
    <JiraProtoPage>
      <JiraProtoShell integrationsContent={<HybridIntegrationsPanel />} />
    </JiraProtoPage>
  );
}
