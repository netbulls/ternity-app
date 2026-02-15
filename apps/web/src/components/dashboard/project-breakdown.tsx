import { scaled } from '@/lib/scaled';
import type { DashboardData } from '@ternity/shared';

interface ProjectBreakdownProps {
  projectBreakdown: DashboardData['projectBreakdown'];
}

export function ProjectBreakdown({ projectBreakdown }: ProjectBreakdownProps) {
  const projectCount = projectBreakdown.length;

  return (
    <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] px-5 py-4">
      {/* Header */}
      <div className="mb-3.5 flex items-center justify-between">
        <span
          className="font-brand uppercase tracking-[2px] text-muted-foreground"
          style={{ fontSize: scaled(10) }}
        >
          This Week by Project
        </span>
        <span
          className="font-brand tracking-[1px] text-muted-foreground"
          style={{ fontSize: scaled(10) }}
        >
          {projectCount} PROJECT{projectCount !== 1 ? 'S' : ''}
        </span>
      </div>

      {/* Stacked bar */}
      {projectCount > 0 && (
        <div className="mb-3.5 flex h-2 gap-0.5 overflow-hidden rounded">
          {projectBreakdown.map((p) => (
            <div
              key={p.projectId ?? '__none__'}
              className="rounded"
              style={{
                flex: p.percentage,
                background: p.projectId === null
                  ? 'hsl(var(--muted))'
                  : p.projectColor,
                opacity: p.projectId === null ? 0.5 : 1,
              }}
            />
          ))}
        </div>
      )}

      {/* Project list */}
      <div className="flex flex-col gap-2">
        {projectBreakdown.map((p) => {
          const isNoProject = p.projectId === null;
          return (
            <div
              key={p.projectId ?? '__none__'}
              className="flex items-center gap-2.5"
            >
              {/* Color dot */}
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: isNoProject
                    ? 'hsl(var(--muted))'
                    : p.projectColor,
                  opacity: isNoProject ? 0.5 : 1,
                }}
              />
              {/* Project name */}
              <span
                className={`flex-1 ${isNoProject ? 'italic text-muted-foreground' : 'text-foreground'}`}
                style={{ fontSize: scaled(12) }}
              >
                {p.projectName}
              </span>
              {/* Client name */}
              <span
                className="text-muted-foreground"
                style={{ fontSize: scaled(10) }}
              >
                {p.clientName ?? ''}
              </span>
              {/* Hours */}
              <span
                className="min-w-[40px] text-right font-brand font-semibold tabular-nums"
                style={{
                  fontSize: scaled(12),
                  color: isNoProject
                    ? 'hsl(35, 100%, 60%)'
                    : 'hsl(var(--foreground))',
                }}
              >
                {formatHM(p.totalSeconds)}
              </span>
              {/* Percentage */}
              <span
                className="min-w-[30px] text-right font-brand text-muted-foreground tabular-nums"
                style={{ fontSize: scaled(10) }}
              >
                {p.percentage}%
              </span>
            </div>
          );
        })}
        {projectCount === 0 && (
          <div
            className="text-center text-muted-foreground"
            style={{ fontSize: scaled(11) }}
          >
            No time tracked this week
          </div>
        )}
      </div>
    </div>
  );
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}
