import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { toast } from 'sonner';
import {
  Link2,
  ExternalLink,
  Unplug,
  ChevronDown,
  RefreshCw,
  ArrowRight,
  X,
  Check,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  JiraProtoShell,
  JiraProtoPage,
  MOCK_JIRA_CONNECTIONS,
  MOCK_PROJECTS_BY_CONNECTION,
  MOCK_JIRA_STATUSES,
  DEFAULT_PROJECTS_BY_CONNECTION,
  DEFAULT_EXCLUDED_BY_CONNECTION,
  ConnectionHeader,
  ConnectButton,
  type JiraConnection,
} from '@/dev/jira-settings-proto-parts';

// ============================================================
// Mock Ternity projects (what exists in the DB already)
// ============================================================

interface TernityProject {
  id: string;
  name: string;
  clientName: string;
  color: string;
}

const MOCK_TERNITY_PROJECTS: TernityProject[] = [
  { id: 't1', name: 'Admin Portal', clientName: 'NETBULLS', color: '#00D4AA' },
  { id: 't2', name: 'Bitflow', clientName: 'NETBULLS', color: '#6366F1' },
  { id: 't3', name: 'Internal Tools', clientName: 'NETBULLS', color: '#F59E0B' },
  { id: 't4', name: 'Mobile App', clientName: 'NETBULLS', color: '#EC4899' },
  { id: 't5', name: 'Website', clientName: 'NETBULLS', color: '#8B5CF6' },
  { id: 't6', name: 'CRM Platform', clientName: 'ACME', color: '#F59E0B' },
  { id: 't7', name: 'Payments', clientName: 'ACME', color: '#EF4444' },
  { id: 't8', name: 'Marketing', clientName: 'ACME', color: '#8B5CF6' },
  { id: 't9', name: 'Operations Hub', clientName: 'ACME', color: '#06B6D4' },
  { id: 't10', name: 'Research Lab', clientName: 'OAKRIDGE', color: '#10B981' },
  { id: 't11', name: 'Documentation', clientName: 'OAKRIDGE', color: '#6366F1' },
  { id: 't12', name: 'Infrastructure', clientName: 'NETBULLS', color: '#64748B' },
];

// Group by client for the select
const CLIENTS = [...new Set(MOCK_TERNITY_PROJECTS.map((p) => p.clientName))];

// Pre-configured mappings per connection (simulating existing config)
const DEFAULT_MAPPINGS: Record<string, Record<string, string | null>> = {
  netbulls: { ADM: 't1', BIT: 't2', INT: 't3' },
  acme: { CRM: 't6', PAY: 't7' },
  oakridge: { LAB: 't10' },
};

const DEFAULT_FALLBACKS: Record<string, string | null> = {
  netbulls: 't3',
  acme: null,
  oakridge: null,
};

// ============================================================
// Mapping Row Component
// ============================================================

function MappingRow({
  jiraKey,
  jiraName,
  ternityProjectId,
  onChangeTernity,
  onClear,
}: {
  jiraKey: string;
  jiraName: string;
  ternityProjectId: string | null;
  onChangeTernity: (projectId: string | null) => void;
  onClear: () => void;
}) {
  const ternityProject = ternityProjectId
    ? MOCK_TERNITY_PROJECTS.find((p) => p.id === ternityProjectId)
    : null;
  const isMapped = !!ternityProject;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
        isMapped ? 'border-primary/20 bg-primary/[0.02]' : 'border-border/50 bg-muted/10',
      )}
    >
      {/* Jira project */}
      <div className="flex items-center gap-2 min-w-[160px]">
        <span
          className="font-brand font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded"
          style={{ fontSize: scaled(10) }}
        >
          {jiraKey}
        </span>
        <span className="text-foreground/80 truncate" style={{ fontSize: scaled(12) }}>
          {jiraName}
        </span>
      </div>

      {/* Arrow */}
      <ArrowRight
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-colors',
          isMapped ? 'text-primary/50' : 'text-muted-foreground/20',
        )}
      />

      {/* Ternity project */}
      <div className="flex-1 min-w-0">
        {isMapped ? (
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: ternityProject.color }}
            />
            <span className="text-foreground truncate" style={{ fontSize: scaled(12) }}>
              {ternityProject.name}
            </span>
            <span className="text-muted-foreground/40 shrink-0" style={{ fontSize: scaled(10) }}>
              {ternityProject.clientName}
            </span>
            <button
              onClick={onClear}
              className="ml-auto shrink-0 rounded-full p-0.5 text-muted-foreground/30 transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onChangeTernity(e.target.value);
                toast.success(
                  `Mapped ${jiraKey} → ${MOCK_TERNITY_PROJECTS.find((p) => p.id === e.target.value)?.name}`,
                );
              }
            }}
            className="w-full rounded-md border border-dashed border-border/50 bg-transparent px-2.5 py-1.5 text-muted-foreground/50 transition-colors hover:border-primary/30 hover:text-muted-foreground focus:border-primary/50 focus:outline-none appearance-none cursor-pointer"
            style={{
              fontSize: scaled(11),
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="">Select Ternity project...</option>
            {CLIENTS.map((client) => (
              <optgroup key={client} label={client}>
                {MOCK_TERNITY_PROJECTS.filter((p) => p.clientName === client).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {/* Status indicator */}
      <div className="shrink-0 w-5 flex items-center justify-center">
        {isMapped ? (
          <Check className="h-3.5 w-3.5 text-primary" />
        ) : (
          <div className="h-2.5 w-2.5 rounded-full border border-muted-foreground/15" />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Connection Card with Mapping
// ============================================================

function MappingConnectionCard({
  connection,
  defaultExpanded,
}: {
  connection: JiraConnection;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [animDone, setAnimDone] = useState(defaultExpanded ?? false);

  // Jira projects for this connection
  const jiraProjects = MOCK_PROJECTS_BY_CONNECTION[connection.id] ?? [];
  const selectedKeys = DEFAULT_PROJECTS_BY_CONNECTION[connection.id] ?? new Set<string>();
  const excludedStatuses = DEFAULT_EXCLUDED_BY_CONNECTION[connection.id] ?? new Set<string>();
  const selectedJiraProjects = jiraProjects.filter((p) => selectedKeys.has(p.key));

  // Mapping state
  const [mappings, setMappings] = useState<Record<string, string | null>>(
    () => DEFAULT_MAPPINGS[connection.id] ?? {},
  );
  const [fallbackProject, setFallbackProject] = useState<string | null>(
    () => DEFAULT_FALLBACKS[connection.id] ?? null,
  );

  const mappedCount = Object.values(mappings).filter(Boolean).length;
  const totalCount = selectedJiraProjects.length;

  const handleSetMapping = useCallback((jiraKey: string, ternityId: string | null) => {
    setMappings((prev) => ({ ...prev, [jiraKey]: ternityId }));
  }, []);

  const handleClearMapping = useCallback((jiraKey: string) => {
    setMappings((prev) => {
      const next = { ...prev };
      delete next[jiraKey];
      return next;
    });
    toast('Mapping removed');
  }, []);

  const summaryParts: string[] = [];
  summaryParts.push(`${selectedKeys.size} project${selectedKeys.size !== 1 ? 's' : ''}`);
  if (mappedCount > 0) summaryParts.push(`${mappedCount} mapped`);
  if (excludedStatuses.size > 0) summaryParts.push(`${excludedStatuses.size} excluded`);
  const summary = summaryParts.join(' · ');

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        expanded ? 'border-primary/30' : 'border-border',
        'bg-muted/15',
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/20"
      >
        <div className="min-w-0 flex-1">
          <ConnectionHeader
            connection={connection}
            summary={!expanded ? summary : undefined}
            actions={<span />}
            compact
          />
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.15 }}>
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
              if (typeof def === 'object' && 'height' in def && def.height === 'auto')
                setAnimDone(true);
            }}
            onAnimationStart={() => setAnimDone(false)}
          >
            <div className="border-t border-border/50 px-4 py-4">
              {/* Search Scope section */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="font-brand font-semibold uppercase tracking-wider text-foreground/70"
                    style={{ fontSize: scaled(10), letterSpacing: '1.5px' }}
                  >
                    Search Scope
                  </span>
                  <span className="text-muted-foreground/40" style={{ fontSize: scaled(10) }}>
                    {selectedKeys.size} projects · {excludedStatuses.size} excluded
                  </span>
                </div>

                {/* Visual query builder (simplified inline version) */}
                <div
                  className="space-y-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5"
                  style={{ fontSize: scaled(11) }}
                >
                  {/* PROJECT IN */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="font-mono text-muted-foreground/50"
                      style={{ fontSize: scaled(10) }}
                    >
                      PROJECT IN
                    </span>
                    {[...selectedKeys].map((key) => {
                      const proj = jiraProjects.find((p) => p.key === key);
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary"
                          style={{ fontSize: scaled(10) }}
                        >
                          {key}
                          {proj && (
                            <span className="text-primary/50" style={{ fontSize: scaled(8) }}>
                              {proj.name}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* STATUS NOT IN */}
                  {excludedStatuses.size > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="font-mono text-muted-foreground/50"
                        style={{ fontSize: scaled(10) }}
                      >
                        AND STATUS NOT IN
                      </span>
                      {[...excludedStatuses].map((id) => {
                        const status = MOCK_JIRA_STATUSES.find((s) => s.id === id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-destructive line-through"
                            style={{ fontSize: scaled(10) }}
                          >
                            {status?.name ?? id}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* ORDER BY */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-mono text-muted-foreground/50"
                      style={{ fontSize: scaled(10) }}
                    >
                      ORDER BY
                    </span>
                    <span className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
                      updated DESC
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Project Mapping section ─────────────────── */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-brand font-semibold uppercase tracking-wider text-foreground/70"
                      style={{ fontSize: scaled(10), letterSpacing: '1.5px' }}
                    >
                      Project Mapping
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        mappedCount === totalCount && totalCount > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                      style={{ fontSize: scaled(9) }}
                    >
                      {mappedCount} of {totalCount} mapped
                    </span>
                  </div>
                  {totalCount > 0 && mappedCount < totalCount && (
                    <button
                      onClick={() => {
                        // Auto-match: try to find Ternity projects with similar names
                        const newMappings = { ...mappings };
                        let matched = 0;
                        for (const jp of selectedJiraProjects) {
                          if (newMappings[jp.key]) continue;
                          const match = MOCK_TERNITY_PROJECTS.find(
                            (tp) =>
                              tp.name
                                .toLowerCase()
                                .includes(jp.name.toLowerCase().split(' ')[0]!) ||
                              jp.name.toLowerCase().includes(tp.name.toLowerCase().split(' ')[0]!),
                          );
                          if (match) {
                            newMappings[jp.key] = match.id;
                            matched++;
                          }
                        }
                        setMappings(newMappings);
                        if (matched > 0) {
                          toast.success(
                            `Auto-matched ${matched} project${matched !== 1 ? 's' : ''}`,
                          );
                        } else {
                          toast('No matches found — assign manually');
                        }
                      }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-primary transition-colors hover:bg-primary/5"
                      style={{ fontSize: scaled(10) }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Auto-match
                    </button>
                  )}
                </div>

                {selectedJiraProjects.length === 0 ? (
                  <div
                    className="rounded-lg border border-dashed border-border/50 px-4 py-6 text-center text-muted-foreground/40"
                    style={{ fontSize: scaled(11) }}
                  >
                    <Link2 className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    Select Jira projects above to configure mapping
                  </div>
                ) : (
                  <div className="text-muted-foreground/35 mb-2" style={{ fontSize: scaled(10) }}>
                    Map each Jira project to a Ternity project. Linked issues will be tracked under
                    the mapped project.
                  </div>
                )}

                {/* Mapping rows */}
                <div className="space-y-1.5">
                  {selectedJiraProjects.map((jp) => (
                    <MappingRow
                      key={jp.key}
                      jiraKey={jp.key}
                      jiraName={jp.name}
                      ternityProjectId={mappings[jp.key] ?? null}
                      onChangeTernity={(id) => handleSetMapping(jp.key, id)}
                      onClear={() => handleClearMapping(jp.key)}
                    />
                  ))}
                </div>

                {/* Default / fallback project */}
                {selectedJiraProjects.length > 0 && (
                  <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5">
                    <span
                      className="text-muted-foreground/60 shrink-0"
                      style={{ fontSize: scaled(11) }}
                    >
                      Default project:
                    </span>
                    <select
                      value={fallbackProject ?? ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setFallbackProject(val);
                        if (val) {
                          toast.success(
                            `Default set to ${MOCK_TERNITY_PROJECTS.find((p) => p.id === val)?.name}`,
                          );
                        } else {
                          toast('Default removed — unmapped issues will be ignored');
                        }
                      }}
                      className={cn(
                        'flex-1 rounded-md border bg-transparent px-2.5 py-1.5 transition-colors focus:outline-none appearance-none cursor-pointer',
                        fallbackProject
                          ? 'border-primary/20 text-foreground'
                          : 'border-border/40 text-muted-foreground/50',
                      )}
                      style={{
                        fontSize: scaled(11),
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center',
                      }}
                    >
                      <option value="">None (unmapped ignored)</option>
                      {CLIENTS.map((client) => (
                        <optgroup key={client} label={client}>
                          {MOCK_TERNITY_PROJECTS.filter((p) => p.clientName === client).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {fallbackProject && (
                      <span className="text-muted-foreground/30" style={{ fontSize: scaled(9) }}>
                        Fallback for unmapped
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 border-t border-border/50 pt-3">
                <span className="text-muted-foreground/40" style={{ fontSize: scaled(10) }}>
                  Last synced 2h ago
                </span>
                <button
                  onClick={() => toast.success('Sync triggered')}
                  className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  style={{ fontSize: scaled(10) }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync
                </button>
                <div className="flex-1" />
                <a
                  href={`https://${connection.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                  title="Open in Jira"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => toast('Disconnect flow would start here')}
                  className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Disconnect"
                >
                  <Unplug className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Integrations Tab Content
// ============================================================

function IntegrationsContent() {
  return (
    <div className="space-y-3">
      {MOCK_JIRA_CONNECTIONS.map((conn, i) => (
        <MappingConnectionCard key={conn.id} connection={conn} defaultExpanded={i === 0} />
      ))}
      <ConnectButton hasConnection />
    </div>
  );
}

// ============================================================
// Page Export
// ============================================================

export function DevJiraMappingPage() {
  return (
    <JiraProtoPage>
      <JiraProtoShell integrationsContent={<IntegrationsContent />} />
    </JiraProtoPage>
  );
}
