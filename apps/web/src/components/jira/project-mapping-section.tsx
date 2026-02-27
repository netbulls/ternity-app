import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { toast } from 'sonner';
import { ArrowRight, Check, Sparkles, Link2 } from 'lucide-react';
import { useJiraProjects } from '@/hooks/use-jira';
import { useProjects } from '@/hooks/use-reference-data';
import { ProjectSelector } from '@/components/timer/project-selector';
import type { JiraProject, ProjectOption } from '@ternity/shared';

// ── Mapping Row ─────────────────────────────────────────────────────

function MappingRow({
  jiraKey,
  jiraName,
  ternityProjectId,
  onChangeTernity,
}: {
  jiraKey: string;
  jiraName: string;
  ternityProjectId: string | null;
  onChangeTernity: (projectId: string | null) => void;
}) {
  const isMapped = !!ternityProjectId;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
        isMapped ? 'border-primary/20 bg-primary/[0.02]' : 'border-border/50 bg-muted/10',
      )}
    >
      {/* Jira project */}
      <div className="flex min-w-[140px] items-center gap-2">
        <span
          className="font-brand rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary"
          style={{ fontSize: scaled(10) }}
        >
          {jiraKey}
        </span>
        <span className="truncate text-foreground/80" style={{ fontSize: scaled(12) }}>
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
      <div className="min-w-0 flex-1">
        <ProjectSelector
          value={ternityProjectId}
          onChange={(id) => {
            onChangeTernity(id);
            if (id) {
              toast.success(`Mapped ${jiraKey}`);
            } else {
              toast('Mapping removed');
            }
          }}
        />
      </div>

      {/* Status indicator */}
      <div className="flex w-5 shrink-0 items-center justify-center">
        {isMapped ? (
          <Check className="h-3.5 w-3.5 text-primary" />
        ) : (
          <div className="h-2.5 w-2.5 rounded-full border border-muted-foreground/15" />
        )}
      </div>
    </div>
  );
}

// ── Auto-match logic ────────────────────────────────────────────────

function autoMatchProjects(
  selectedJiraProjects: JiraProject[],
  ternityProjects: ProjectOption[],
  currentMappings: Record<string, string>,
): { newMappings: Record<string, string>; matchCount: number } {
  const newMappings = { ...currentMappings };
  let matchCount = 0;

  for (const jp of selectedJiraProjects) {
    if (newMappings[jp.key]) continue; // already mapped

    // Fuzzy match: check if the first word of either name appears in the other
    const jiraWords = jp.name.toLowerCase().split(/\s+/);
    const match = ternityProjects.find((tp) => {
      const ternityWords = tp.name.toLowerCase().split(/\s+/);
      return (
        jiraWords.some((w) => w.length >= 3 && tp.name.toLowerCase().includes(w)) ||
        ternityWords.some((w) => w.length >= 3 && jp.name.toLowerCase().includes(w))
      );
    });

    if (match) {
      newMappings[jp.key] = match.id;
      matchCount++;
    }
  }

  return { newMappings, matchCount };
}

// ── Main Section ────────────────────────────────────────────────────

interface ProjectMappingSectionProps {
  connectionId: string;
  selectedProjectKeys: Set<string>;
  projectMappings: Record<string, string>;
  defaultProjectId: string | null;
  onMappingChange: (jiraKey: string, ternityProjectId: string | null) => void;
  onBulkMappingChange: (mappings: Record<string, string>) => void;
  onDefaultProjectChange: (projectId: string | null) => void;
}

export function ProjectMappingSection({
  connectionId,
  selectedProjectKeys,
  projectMappings,
  defaultProjectId,
  onMappingChange,
  onBulkMappingChange,
  onDefaultProjectChange,
}: ProjectMappingSectionProps) {
  const { data: jiraProjects = [] } = useJiraProjects(connectionId);
  const { data: ternityProjects = [] } = useProjects();

  const selectedJiraProjects = jiraProjects.filter((p) => selectedProjectKeys.has(p.key));
  const mappedCount = selectedJiraProjects.filter((p) => projectMappings[p.key]).length;
  const totalCount = selectedJiraProjects.length;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
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
              const { newMappings, matchCount } = autoMatchProjects(
                selectedJiraProjects,
                ternityProjects,
                projectMappings,
              );
              if (matchCount > 0) {
                onBulkMappingChange(newMappings);
                toast.success(`Auto-matched ${matchCount} project${matchCount !== 1 ? 's' : ''}`);
              } else {
                toast('No matches found \u2014 assign manually');
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

      {totalCount === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border/50 px-4 py-6 text-center text-muted-foreground/40"
          style={{ fontSize: scaled(11) }}
        >
          <Link2 className="mx-auto mb-2 h-6 w-6 opacity-30" />
          Select Jira projects above to configure mapping
        </div>
      ) : (
        <>
          <div className="mb-2 text-muted-foreground/35" style={{ fontSize: scaled(10) }}>
            Map each Jira project to a Ternity project. Linked issues will be tracked under the
            mapped project.
          </div>

          {/* Mapping rows */}
          <div className="space-y-1.5">
            {selectedJiraProjects.map((jp) => (
              <MappingRow
                key={jp.key}
                jiraKey={jp.key}
                jiraName={jp.name}
                ternityProjectId={projectMappings[jp.key] ?? null}
                onChangeTernity={(id) => onMappingChange(jp.key, id)}
              />
            ))}
          </div>

          {/* Default / fallback project */}
          <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5">
            <span className="shrink-0 text-muted-foreground/60" style={{ fontSize: scaled(11) }}>
              Default project:
            </span>
            <ProjectSelector
              value={defaultProjectId}
              onChange={(id) => {
                onDefaultProjectChange(id);
                if (id) {
                  toast.success('Default project set');
                } else {
                  toast('Default removed \u2014 unmapped issues will be ignored');
                }
              }}
            />
            {defaultProjectId && (
              <span className="text-muted-foreground/30" style={{ fontSize: scaled(9) }}>
                Fallback for unmapped
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
