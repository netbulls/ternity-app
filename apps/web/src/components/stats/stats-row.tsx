import { useStats } from '@/hooks/use-stats';
import { formatDuration } from '@/lib/format';
import { StatCard } from '@/components/ui/stat-card';

export function StatsRow() {
  const { data: stats } = useStats();

  const todayStr = stats ? formatDuration(stats.todaySeconds) : '0h 00m';
  const weekStr = stats ? formatDuration(stats.weekSeconds) : '0h 00m';
  const hasTodayTime = stats && stats.todaySeconds > 0;

  return (
    <div className="mb-5 grid grid-cols-3 gap-3">
      <StatCard label="Today" value={todayStr} subtitle="of 8h target" accent={hasTodayTime} />
      <StatCard label="This Week" value={weekStr} subtitle="of 40h target" />
      <StatCard label="Leave Balance" value="--" subtitle="days remaining" />
    </div>
  );
}
