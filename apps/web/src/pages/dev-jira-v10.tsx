import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { X, Plus, ChevronDown } from 'lucide-react';
import {
  JiraProtoShell,
  JiraProtoPage,
  ConnectionHeader,
  JqlPreview,
  ConnectButton,
  MOCK_JIRA_CONNECTIONS,
  MOCK_JIRA_STATUSES,
  MOCK_PROJECTS_BY_CONNECTION,
  DEFAULT_PROJECTS_BY_CONNECTION,
  DEFAULT_EXCLUDED_BY_CONNECTION,
  type JiraConnection,
} from '@/dev/jira-settings-proto-parts';

// ============================================================
// Shared components
// ============================================================

function TokenInput({
  items,
  selected,
  onAdd,
  onRemove,
  label,
}: {
  items: { key: string; label: string }[];
  selected: Set<string>;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const available = items.filter((i) => !selected.has(i.key));
  const selectedItems = items.filter((i) => selected.has(i.key));

  return (
    <div>
      <div className="mb-1.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        {label}
      </div>
      <div className="relative" ref={ref}>
        <div className="flex min-h-[36px] flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/10 px-2 py-1.5 transition-colors focus-within:border-primary/50">
          {selectedItems.map((item) => (
            <span
              key={item.key}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-primary"
              style={{ fontSize: scaled(11) }}
            >
              {item.key}
              <button
                onClick={() => onRemove(item.key)}
                className="rounded p-0.5 transition-colors hover:bg-primary/20"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <button
            onClick={() => available.length > 0 && setOpen(!open)}
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground',
              available.length === 0 && 'cursor-not-allowed opacity-30',
            )}
            style={{ fontSize: scaled(11) }}
            disabled={available.length === 0}
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        {open && available.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-[200px] w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg">
            {available.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  onAdd(item.key);
                  if (available.length <= 1) setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                style={{ fontSize: scaled(11) }}
              >
                <span className="font-mono text-muted-foreground/70" style={{ fontSize: scaled(10) }}>
                  {item.key}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPillToggles({
  excludedStatuses,
  onToggle,
}: {
  excludedStatuses: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Exclude Statuses
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MOCK_JIRA_STATUSES.map((s) => {
          const excluded = excludedStatuses.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className={cn(
                'rounded-full border px-3 py-1 transition-all',
                excluded
                  ? 'border-destructive/30 bg-destructive/10 text-destructive line-through'
                  : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30',
              )}
              style={{ fontSize: scaled(11) }}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// V10 — Minimal List (per connection)
// ============================================================

function V10ConnectionCard({ connection }: { connection: JiraConnection }) {
  const projects = MOCK_PROJECTS_BY_CONNECTION[connection.id] ?? [];
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    () => new Set(DEFAULT_PROJECTS_BY_CONNECTION[connection.id] ?? []),
  );
  const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(
    () => new Set(DEFAULT_EXCLUDED_BY_CONNECTION[connection.id] ?? []),
  );
  const [queryMode, setQueryMode] = useState<'simple' | 'custom'>('simple');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const addProject = (key: string) => {
    setSelectedProjects((prev) => new Set(prev).add(key));
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

  return (
    <div className="rounded-xl border border-border bg-muted/15">
      {/* Connection header — compact */}
      <div className="px-4 py-3">
        <ConnectionHeader connection={connection} compact />
      </div>

      {/* Config form */}
      <div className="space-y-4 border-t border-border/50 px-4 py-4">
        {/* Projects — token input */}
        <TokenInput
          items={projects.map((p) => ({ key: p.key, label: p.name }))}
          selected={selectedProjects}
          onAdd={addProject}
          onRemove={removeProject}
          label="Projects"
        />

        {/* Statuses — pill toggles */}
        <StatusPillToggles
          excludedStatuses={excludedStatuses}
          onToggle={toggleStatus}
        />

        {/* Advanced (JQL) — collapsible */}
        <div>
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            style={{ fontSize: scaled(11) }}
          >
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                advancedOpen && 'rotate-180',
              )}
            />
            Advanced (JQL)
          </button>
          {advancedOpen && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-1">
                {(['simple', 'custom'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setQueryMode(m)}
                    className={cn(
                      'rounded-md border px-3 py-1 capitalize transition-colors',
                      queryMode === m
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                    style={{ fontSize: scaled(11) }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <JqlPreview
                projects={selectedProjects}
                excludedStatuses={excludedStatuses}
                mode={queryMode}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function V10IntegrationsPanel() {
  return (
    <div className="space-y-3">
      {MOCK_JIRA_CONNECTIONS.map((conn) => (
        <V10ConnectionCard key={conn.id} connection={conn} />
      ))}
      <ConnectButton hasConnection />
    </div>
  );
}

// ============================================================
// Exported page
// ============================================================

export function DevJiraV10Page() {
  return (
    <JiraProtoPage>
      <JiraProtoShell integrationsContent={<V10IntegrationsPanel />} />
    </JiraProtoPage>
  );
}
