import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { toast } from 'sonner';
import { ArrowRight, X, Check, Sparkles, Link2 } from 'lucide-react';
import { useJiraProjects } from '@/hooks/use-jira';
import { useProjects } from '@/hooks/use-reference-data';
import type { JiraProject, ProjectOption } from '@ternity/shared';

// ── Mapping Row ─────────────────────────────────────────────────────

function MappingRow({
  jiraKey,
  jiraName,
  ternityProjectId,
  ternityProjects,
  onChangeTernity,
  onClear,
}: {
  jiraKey: string;
  jiraName: string;
  ternityProjectId: string | null;
  ternityProjects: ProjectOption[];
  onChangeTernity: (projectId: string | null) => void;
  onClear: () => void;
}) {
  const ternityProject = ternityProjectId
    ? ternityProjects.find((p) => p.id === ternityProjectId)
    : null;
  const isMapped = !!ternityProject;

  // Group by client for the select dropdown
  const clients = [
    ...new Set(ternityProjects.map((p) => p.clientName).filter(Boolean)),
  ] as string[];

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
        {isMapped ? (
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: ternityProject.color ?? undefined }}
            />
            <span className="truncate text-foreground" style={{ fontSize: scaled(12) }}>
              {ternityProject.name}
            </span>
            {ternityProject.clientName && (
              <span className="shrink-0 text-muted-foreground/40" style={{ fontSize: scaled(10) }}>
                {ternityProject.clientName}
              </span>
            )}
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
                const name = ternityProjects.find((p) => p.id === e.target.value)?.name;
                toast.success(`Mapped ${jiraKey} \u2192 ${name}`);
              }
            }}
            className="w-full cursor-pointer appearance-none rounded-md border border-dashed border-border/50 bg-transparent px-2.5 py-1.5 text-muted-foreground/50 transition-colors hover:border-primary/30 hover:text-muted-foreground focus:border-primary/50 focus:outline-none"
            style={{
              fontSize: scaled(11),
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="">Select Ternity project...</option>
            {clients.map((client) => (
              <optgroup key={client} label={client}>
                {ternityProjects
                  .filter((p) => p.clientName === client)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
            {/* Projects without a client */}
            {ternityProjects
              .filter((p) => !p.clientName)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        )}
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

  // Group Ternity projects by client for the fallback select
  const clients = [
    ...new Set(ternityProjects.map((p) => p.clientName).filter(Boolean)),
  ] as string[];

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
                ternityProjects={ternityProjects}
                onChangeTernity={(id) => onMappingChange(jp.key, id)}
                onClear={() => {
                  onMappingChange(jp.key, null);
                  toast('Mapping removed');
                }}
              />
            ))}
          </div>

          {/* Default / fallback project */}
          <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5">
            <span className="shrink-0 text-muted-foreground/60" style={{ fontSize: scaled(11) }}>
              Default project:
            </span>
            <select
              value={defaultProjectId ?? ''}
              onChange={(e) => {
                const val = e.target.value || null;
                onDefaultProjectChange(val);
                if (val) {
                  const name = ternityProjects.find((p) => p.id === val)?.name;
                  toast.success(`Default set to ${name}`);
                } else {
                  toast('Default removed \u2014 unmapped issues will be ignored');
                }
              }}
              className={cn(
                'flex-1 cursor-pointer appearance-none rounded-md border bg-transparent px-2.5 py-1.5 transition-colors focus:outline-none',
                defaultProjectId
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
              {clients.map((client) => (
                <optgroup key={client} label={client}>
                  {ternityProjects
                    .filter((p) => p.clientName === client)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              ))}
              {ternityProjects
                .filter((p) => !p.clientName)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
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
