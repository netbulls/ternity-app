import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { X, Plus, ChevronDown, Code2 } from 'lucide-react';
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
// Shared: chip dropdown for adding items
// ============================================================

function ChipDropdown({
  items,
  selected,
  onSelect,
  color,
}: {
  items: { key: string; label: string }[];
  selected: Set<string>;
  onSelect: (key: string) => void;
  color: 'teal' | 'red';
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

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => available.length > 0 && setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md border border-dashed px-1.5 py-0.5 transition-colors',
          color === 'teal'
            ? 'border-primary/40 text-primary hover:border-primary hover:bg-primary/5'
            : 'border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/5',
          available.length === 0 && 'cursor-not-allowed opacity-40',
        )}
        style={{ fontSize: scaled(11) }}
        disabled={available.length === 0}
      >
        <Plus className="h-3 w-3" />
      </button>
      {open && available.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-border bg-card p-1 shadow-lg">
          {available.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                onSelect(item.key);
                setOpen(false);
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
  );
}

// ============================================================
// V9 — Tag Builder (per connection)
// ============================================================

function V9ConnectionCard({ connection }: { connection: JiraConnection }) {
  const projects = MOCK_PROJECTS_BY_CONNECTION[connection.id] ?? [];
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    () => new Set(DEFAULT_PROJECTS_BY_CONNECTION[connection.id] ?? []),
  );
  const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(
    () => new Set(DEFAULT_EXCLUDED_BY_CONNECTION[connection.id] ?? []),
  );
  const [showJql, setShowJql] = useState(false);

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

  const addStatus = (id: string) => {
    setExcludedStatuses((prev) => new Set(prev).add(id));
  };

  const removeStatus = (id: string) => {
    setExcludedStatuses((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const jql = buildJql(selectedProjects, excludedStatuses);

  return (
    <div className="rounded-xl border border-border bg-muted/15">
      {/* Connection header */}
      <div className="px-4 py-3.5">
        <ConnectionHeader connection={connection} />
      </div>

      {/* Visual query builder */}
      <div className="border-t border-border/50 px-4 py-4">
        <div className="mb-3 font-medium text-foreground" style={{ fontSize: scaled(12) }}>
          Search Scope
        </div>

        {/* Query sentence */}
        <div className="space-y-3" style={{ fontSize: scaled(12) }}>
          {/* PROJECT IN line */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
              PROJECT IN
            </span>
            {[...selectedProjects].map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary"
                style={{ fontSize: scaled(11) }}
              >
                {key}
                <button
                  onClick={() => removeProject(key)}
                  className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <ChipDropdown
              items={projects.map((p) => ({ key: p.key, label: p.name }))}
              selected={selectedProjects}
              onSelect={addProject}
              color="teal"
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
            <ChipDropdown
              items={MOCK_JIRA_STATUSES.map((s) => ({ key: s.id, label: s.name }))}
              selected={excludedStatuses}
              onSelect={addStatus}
              color="red"
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
    </div>
  );
}

function V9IntegrationsPanel() {
  return (
    <div className="space-y-3">
      {MOCK_JIRA_CONNECTIONS.map((conn) => (
        <V9ConnectionCard key={conn.id} connection={conn} />
      ))}
      <ConnectButton hasConnection />
    </div>
  );
}

// ============================================================
// Exported page
// ============================================================

export function DevJiraV9Page() {
  return (
    <JiraProtoPage>
      <JiraProtoShell integrationsContent={<V9IntegrationsPanel />} />
    </JiraProtoPage>
  );
}
