import { useState } from 'react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';
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
// V1 — Inline Accordion (per connection)
// ============================================================

function V1ConnectionCard({ connection, defaultExpanded }: { connection: JiraConnection; defaultExpanded?: boolean }) {
  const projects = MOCK_PROJECTS_BY_CONNECTION[connection.id] ?? [];
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    () => new Set(DEFAULT_PROJECTS_BY_CONNECTION[connection.id] ?? []),
  );
  const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(
    () => new Set(DEFAULT_EXCLUDED_BY_CONNECTION[connection.id] ?? []),
  );
  const [queryMode, setQueryMode] = useState<'simple' | 'custom'>('simple');

  const toggleProject = (key: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

  const summary = `${selectedProjects.size} project${selectedProjects.size !== 1 ? 's' : ''} · ${excludedStatuses.size} excluded · ${queryMode === 'simple' ? 'Simple' : 'Custom'}`;

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

      {/* Expandable config body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t border-border/50 px-4 py-4">
              {/* Projects */}
              <div>
                <div className="mb-2 font-medium text-foreground" style={{ fontSize: scaled(12) }}>
                  Projects
                </div>
                <div className="space-y-1">
                  {projects.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => toggleProject(p.key)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/30"
                    >
                      <div
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          selectedProjects.has(p.key)
                            ? 'border-primary bg-primary'
                            : 'border-border bg-transparent',
                        )}
                      >
                        {selectedProjects.has(p.key) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span
                        className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-muted-foreground"
                        style={{ fontSize: scaled(10) }}
                      >
                        {p.key}
                      </span>
                      <span className="text-foreground" style={{ fontSize: scaled(12) }}>
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Excluded Statuses */}
              <div>
                <div className="mb-2 font-medium text-foreground" style={{ fontSize: scaled(12) }}>
                  Excluded Statuses
                </div>
                <div className="space-y-1">
                  {MOCK_JIRA_STATUSES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleStatus(s.id)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/30"
                    >
                      <div
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          excludedStatuses.has(s.id)
                            ? 'border-destructive bg-destructive'
                            : 'border-border bg-transparent',
                        )}
                      >
                        {excludedStatuses.has(s.id) && (
                          <Check className="h-3 w-3 text-destructive-foreground" />
                        )}
                      </div>
                      <span
                        className={cn(
                          'transition-colors',
                          excludedStatuses.has(s.id)
                            ? 'text-destructive/70 line-through'
                            : 'text-foreground',
                        )}
                        style={{ fontSize: scaled(12) }}
                      >
                        {s.name}
                      </span>
                      <span className="text-muted-foreground/50" style={{ fontSize: scaled(10) }}>
                        {s.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Query Mode */}
              <div>
                <div className="mb-2 font-medium text-foreground" style={{ fontSize: scaled(12) }}>
                  Query
                </div>
                <div className="mb-2 flex gap-1">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function V1IntegrationsPanel() {
  return (
    <div className="space-y-3">
      {MOCK_JIRA_CONNECTIONS.map((conn, i) => (
        <V1ConnectionCard key={conn.id} connection={conn} defaultExpanded={i === 0} />
      ))}
      <ConnectButton hasConnection />
    </div>
  );
}

// ============================================================
// Exported page
// ============================================================

export function DevJiraV1Page() {
  return (
    <JiraProtoPage>
      <JiraProtoShell integrationsContent={<V1IntegrationsPanel />} />
    </JiraProtoPage>
  );
}
