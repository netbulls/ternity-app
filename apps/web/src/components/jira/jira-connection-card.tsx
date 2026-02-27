import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Link2, RefreshCw, ExternalLink, Unplug, AlertTriangle } from 'lucide-react';
import { useUpdateJiraConfig, useDisconnectJira, useSyncJira } from '@/hooks/use-jira';
import { VisualQueryBuilder } from './visual-query-builder';
import { ProjectMappingSection } from './project-mapping-section';
import type { JiraConnectionView, JiraConnectionConfig } from '@ternity/shared';

function formatSyncTime(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface JiraConnectionCardProps {
  connection: JiraConnectionView;
  defaultExpanded?: boolean;
  onReconnect?: () => void;
}

export function JiraConnectionCard({
  connection,
  defaultExpanded,
  onReconnect,
}: JiraConnectionCardProps) {
  const isExpired = connection.tokenStatus === 'expired';
  const [expanded, setExpanded] = useState(defaultExpanded ?? isExpired);
  const [animDone, setAnimDone] = useState(defaultExpanded ?? false);

  // Local state initialized from connection config
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    () => new Set(connection.config.selectedProjects ?? []),
  );
  const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(
    () => new Set(connection.config.excludedStatuses ?? []),
  );
  const [projectMappings, setProjectMappings] = useState<Record<string, string>>(
    () => connection.config.projectMappings ?? {},
  );
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(
    () => connection.config.defaultProjectId ?? null,
  );

  const updateConfig = useUpdateJiraConfig();
  const disconnect = useDisconnectJira();
  const sync = useSyncJira();

  // Debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (opts: {
      projects?: Set<string>;
      statuses?: Set<string>;
      mappings?: Record<string, string>;
      defaultProject?: string | null;
    }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const config: JiraConnectionConfig = {
          selectedProjects: [...(opts.projects ?? selectedProjects)],
          excludedStatuses: [...(opts.statuses ?? excludedStatuses)],
          queryMode: 'visual',
          projectMappings: opts.mappings ?? projectMappings,
          defaultProjectId:
            opts.defaultProject !== undefined ? opts.defaultProject : defaultProjectId,
        };
        updateConfig.mutate({ connectionId: connection.id, config });
      }, 500);
    },
    [
      connection.id,
      updateConfig,
      selectedProjects,
      excludedStatuses,
      projectMappings,
      defaultProjectId,
    ],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const toggleProject = (key: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      scheduleSave({ projects: next });
      return next;
    });
  };

  const removeProject = (key: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      next.delete(key);
      scheduleSave({ projects: next });
      return next;
    });
  };

  const toggleStatus = (id: string) => {
    setExcludedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      scheduleSave({ statuses: next });
      return next;
    });
  };

  const removeStatus = (id: string) => {
    setExcludedStatuses((prev) => {
      const next = new Set(prev);
      next.delete(id);
      scheduleSave({ statuses: next });
      return next;
    });
  };

  const handleMappingChange = (jiraKey: string, ternityProjectId: string | null) => {
    setProjectMappings((prev) => {
      const next = { ...prev };
      if (ternityProjectId) {
        next[jiraKey] = ternityProjectId;
      } else {
        delete next[jiraKey];
      }
      scheduleSave({ mappings: next });
      return next;
    });
  };

  const handleBulkMappingChange = (mappings: Record<string, string>) => {
    setProjectMappings(mappings);
    scheduleSave({ mappings });
  };

  const handleDefaultProjectChange = (projectId: string | null) => {
    setDefaultProjectId(projectId);
    scheduleSave({ defaultProject: projectId });
  };

  const mappedCount = Object.keys(projectMappings).filter((k) => selectedProjects.has(k)).length;
  const summaryParts = [
    `${selectedProjects.size} project${selectedProjects.size !== 1 ? 's' : ''}`,
  ];
  if (mappedCount > 0) summaryParts.push(`${mappedCount} mapped`);
  if (excludedStatuses.size > 0) summaryParts.push(`${excludedStatuses.size} excluded`);
  summaryParts.push(formatSyncTime(connection.lastSyncedAt));
  const summary = summaryParts.join(' \u00b7 ');

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
          <div className="flex items-start gap-3 py-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
                  {connection.siteName}
                </span>
                {isExpired ? (
                  <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Reconnect
                  </span>
                ) : (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                    Connected
                  </span>
                )}
              </div>
              <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                {connection.atlassianDisplayName}
                {connection.atlassianEmail && ` · ${connection.atlassianEmail}`}
              </div>
              {!expanded && (
                <div className="mt-0.5 text-muted-foreground/70" style={{ fontSize: scaled(10) }}>
                  {summary}
                </div>
              )}
            </div>
          </div>
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
              {isExpired ? (
                /* Expired state — reconnect prompt */
                <div className="space-y-3">
                  <p className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                    Connection expired — Jira access needs to be renewed. Your configuration will be
                    preserved.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReconnect?.();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-1.5 font-medium text-amber-500 transition-colors hover:bg-amber-500/20"
                      style={{ fontSize: scaled(12) }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reconnect
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnect.mutate(connection.id);
                      }}
                      disabled={disconnect.isPending}
                      className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Remove connection"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Active state — normal content */
                <>
                  {/* Sync row */}
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                      Last synced {formatSyncTime(connection.lastSyncedAt)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sync.mutate(connection.id);
                      }}
                      disabled={sync.isPending}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                        sync.isPending && 'pointer-events-none opacity-50',
                      )}
                      style={{ fontSize: scaled(10) }}
                    >
                      <RefreshCw className={cn('h-3 w-3', sync.isPending && 'animate-spin')} />
                      {sync.isPending ? 'Syncing...' : 'Sync now'}
                    </button>
                  </div>

                  {/* Visual query builder */}
                  <VisualQueryBuilder
                    connectionId={connection.id}
                    selectedProjects={selectedProjects}
                    excludedStatuses={excludedStatuses}
                    onToggleProject={toggleProject}
                    onRemoveProject={removeProject}
                    onToggleStatus={toggleStatus}
                    onRemoveStatus={removeStatus}
                  />

                  {/* Project mapping */}
                  <div className="mt-4">
                    <ProjectMappingSection
                      connectionId={connection.id}
                      selectedProjectKeys={selectedProjects}
                      projectMappings={projectMappings}
                      defaultProjectId={defaultProjectId}
                      onMappingChange={handleMappingChange}
                      onBulkMappingChange={handleBulkMappingChange}
                      onDefaultProjectChange={handleDefaultProjectChange}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 flex items-center gap-1.5 border-t border-border/50 pt-3">
                    <a
                      href={connection.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                      title="Open in Jira"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnect.mutate(connection.id);
                      }}
                      disabled={disconnect.isPending}
                      className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Disconnect"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
