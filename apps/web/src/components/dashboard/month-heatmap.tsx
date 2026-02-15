import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { scaled } from '@/lib/scaled';
import type { DashboardData } from '@ternity/shared';

interface MonthHeatmapProps {
  monthLabel: string;
  heatmapDays: DashboardData['heatmapDays'];
  monthTotalSeconds: number;
  workingDaysLeft: number;
}

export function MonthHeatmap({
  monthLabel,
  heatmapDays,
  monthTotalSeconds,
  workingDaysLeft,
}: MonthHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const render = () => {
      d3.select(container).select('svg').remove();

      const cs = getComputedStyle(container);
      const primaryHsl = cs.getPropertyValue('--primary').trim();
      const primary = primaryHsl ? `hsl(${primaryHsl})` : '#00D4AA';
      const mutedHsl = cs.getPropertyValue('--muted').trim();
      const muted = mutedHsl ? `hsl(${mutedHsl})` : '#333';
      const fgHsl = cs.getPropertyValue('--foreground').trim();
      const fg = fgHsl ? `hsl(${fgHsl})` : '#ffffff';
      const mutedFgHsl = cs.getPropertyValue('--muted-foreground').trim();
      const mutedFg = mutedFgHsl ? `hsl(${mutedFgHsl})` : '#888';

      const cellSize = 20;
      const cellGap = 3;
      const headerHeight = 16;
      const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

      const numWeeks =
        heatmapDays.length > 0
          ? heatmapDays[heatmapDays.length - 1]!.weekIndex + 1
          : 0;

      const width = 7 * (cellSize + cellGap) + 10;
      const height = headerHeight + numWeeks * (cellSize + cellGap) + 10;

      const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      // Day labels header
      dayLabels.forEach((label, i) => {
        svg
          .append('text')
          .attr('x', i * (cellSize + cellGap) + cellSize / 2)
          .attr('y', 10)
          .attr('text-anchor', 'middle')
          .attr('font-family', "'Oxanium', sans-serif")
          .attr('font-size', '8px')
          .attr('fill', mutedFg)
          .attr('opacity', 0.5)
          .text(label);
      });

      // Cells
      heatmapDays.forEach((d) => {
        const col = d.dayOfWeek - 1; // 0=Mon, 6=Sun
        const hours = d.totalSeconds / 3600;
        const opacity =
          hours === 0 ? 0 : Math.min(1, 0.15 + (hours / 10) * 0.85);
        const fill = hours === 0 ? muted : primary;

        svg
          .append('rect')
          .attr('x', col * (cellSize + cellGap))
          .attr('y', headerHeight + d.weekIndex * (cellSize + cellGap))
          .attr('width', cellSize)
          .attr('height', cellSize)
          .attr('rx', 2)
          .attr('ry', 2)
          .attr('fill', fill)
          .attr('opacity', hours === 0 ? 0.2 : opacity)
          .style('transition', 'opacity 0.15s')
          .style('cursor', 'default');

        // Day number
        svg
          .append('text')
          .attr('x', col * (cellSize + cellGap) + cellSize / 2)
          .attr(
            'y',
            headerHeight + d.weekIndex * (cellSize + cellGap) + cellSize / 2 + 3,
          )
          .attr('text-anchor', 'middle')
          .attr('font-family', "'Oxanium', sans-serif")
          .attr('font-size', '8px')
          .attr('font-weight', '600')
          .attr('fill', hours > 4 ? fg : mutedFg)
          .attr('opacity', hours === 0 ? 0.3 : 0.8)
          .text(d.dayOfMonth);
      });
    };

    render();

    const observer = new ResizeObserver(() => render());
    observer.observe(container);

    return () => observer.disconnect();
  }, [heatmapDays]);

  const totalFormatted = formatHM(monthTotalSeconds);

  return (
    <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] px-5 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-brand uppercase tracking-[2px] text-muted-foreground"
          style={{ fontSize: scaled(10) }}
        >
          {monthLabel}
        </span>
        {/* Legend */}
        <div
          className="flex items-center gap-1 text-muted-foreground"
          style={{ fontSize: scaled(9) }}
        >
          <span>Less</span>
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: 'hsl(var(--muted))' }}
          />
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: 'hsl(var(--primary) / 0.2)' }}
          />
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: 'hsl(var(--primary) / 0.4)' }}
          />
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: 'hsl(var(--primary) / 0.7)' }}
          />
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: 'hsl(var(--primary))' }}
          />
          <span>More</span>
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} />

      {/* Stat pills */}
      <div className="mt-3 flex gap-4 border-t border-[hsl(var(--border)/0.5)] pt-3">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-brand uppercase tracking-[1.5px] text-muted-foreground"
            style={{ fontSize: scaled(9) }}
          >
            Month total
          </span>
          <span
            className="font-brand font-semibold tabular-nums text-[hsl(var(--primary))]"
            style={{ fontSize: scaled(13) }}
          >
            {totalFormatted}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-brand uppercase tracking-[1.5px] text-muted-foreground"
            style={{ fontSize: scaled(9) }}
          >
            Working days left
          </span>
          <span
            className="font-brand font-semibold tabular-nums text-foreground"
            style={{ fontSize: scaled(13) }}
          >
            {workingDaysLeft}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}
