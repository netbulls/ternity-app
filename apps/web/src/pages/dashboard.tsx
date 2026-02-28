import { useDashboard } from '@/hooks/use-dashboard';
import { AttentionCards } from '@/components/dashboard/attention-cards';
import { WeekHistogram } from '@/components/dashboard/week-histogram';
import { MonthHeatmap } from '@/components/dashboard/month-heatmap';
import { ProjectBreakdown } from '@/components/dashboard/project-breakdown';
import { scaled } from '@/lib/scaled';
import { formatDateRange } from '@/lib/format';

export function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return (
      <div>
        {/* Skeleton header */}
        <div className="mb-5">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
        {/* Skeleton attention cards */}
        <div className="mb-3 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        {/* Skeleton charts */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const subtitle = `Week ${data.weekNumber} · ${formatDateRange(data.weekStart, data.weekEnd)}`;

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1
          className="font-brand font-semibold tracking-wide text-foreground"
          style={{ fontSize: scaled(18) }}
        >
          Reports
        </h1>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
          {subtitle}
        </p>
      </div>

      {/* Attention cards */}
      <div className="mb-3">
        <AttentionCards attention={data.attention} />
      </div>

      {/* Charts: histogram + heatmap side by side */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <WeekHistogram
          weekDays={data.weekDays}
          weekTotalSeconds={data.attention.weekTotalSeconds}
          weekAvgPerDaySeconds={data.weekAvgPerDaySeconds}
        />
        <MonthHeatmap
          monthLabel={data.monthLabel}
          heatmapDays={data.heatmapDays}
          monthTotalSeconds={data.monthTotalSeconds}
          workingDaysLeft={data.workingDaysLeft}
        />
      </div>

      {/* Project breakdown */}
      <ProjectBreakdown projectBreakdown={data.projectBreakdown} />
    </div>
  );
}
