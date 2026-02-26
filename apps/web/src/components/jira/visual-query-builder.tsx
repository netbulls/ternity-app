import { useState } from 'react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { X, Plus, Code2, ChevronDown } from 'lucide-react';
import { useJiraProjects, useJiraStatuses } from '@/hooks/use-jira';
import { PickerPopover } from './picker-popover';
import type { JiraStatus } from '@ternity/shared';

function buildJql(
  selectedProjects: Set<string>,
  excludedStatuses: Set<string>,
  allStatuses: JiraStatus[],
): string {
  const parts: string[] = [];
  if (selectedProjects.size > 0) {
    parts.push(`project IN (${[...selectedProjects].join(', ')})`);
  }
  if (excludedStatuses.size > 0) {
    const names = [...excludedStatuses].map((id) => {
      const s = allStatuses.find((st) => st.id === id);
      return `"${s?.name ?? id}"`;
    });
    parts.push(`AND status NOT IN (${names.join(', ')})`);
  }
  parts.push('ORDER BY updated DESC');
  return parts.join(' ') || 'ORDER BY updated DESC';
}

interface VisualQueryBuilderProps {
  connectionId: string;
  selectedProjects: Set<string>;
  excludedStatuses: Set<string>;
  onToggleProject: (key: string) => void;
  onRemoveProject: (key: string) => void;
  onToggleStatus: (id: string) => void;
  onRemoveStatus: (id: string) => void;
}

export function VisualQueryBuilder({
  connectionId,
  selectedProjects,
  excludedStatuses,
  onToggleProject,
  onRemoveProject,
  onToggleStatus,
  onRemoveStatus,
}: VisualQueryBuilderProps) {
  const { data: projects = [], isLoading: loadingProjects } = useJiraProjects(connectionId);
  const { data: statuses = [], isLoading: loadingStatuses } = useJiraStatuses(connectionId);
  const [showJql, setShowJql] = useState(false);

  const jql = buildJql(selectedProjects, excludedStatuses, statuses);

  return (
    <div>
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
                  onClick={() => onRemoveProject(key)}
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
            onToggle={onToggleProject}
            searchPlaceholder="Search projects..."
            emptyLabel="No matching projects"
            isLoading={loadingProjects}
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
            const status = statuses.find((s) => s.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-destructive line-through"
                style={{ fontSize: scaled(11) }}
              >
                {status?.name ?? id}
                <button
                  onClick={() => onRemoveStatus(id)}
                  className="rounded-full p-0.5 transition-colors hover:bg-destructive/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
          <PickerPopover
            items={statuses.map((s) => ({
              key: s.id,
              label: s.name,
              secondary: s.statusCategory.name,
            }))}
            selected={excludedStatuses}
            onToggle={onToggleStatus}
            searchPlaceholder="Search statuses..."
            emptyLabel="No matching statuses"
            isLoading={loadingStatuses}
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
  );
}
