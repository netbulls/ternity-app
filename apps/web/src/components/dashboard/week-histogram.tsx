import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { scaled } from '@/lib/scaled';
import type { DashboardData } from '@ternity/shared';

interface WeekHistogramProps {
  weekDays: DashboardData['weekDays'];
  weekTotalSeconds: number;
  weekAvgPerDaySeconds: number;
}

export function WeekHistogram({
  weekDays,
  weekTotalSeconds,
  weekAvgPerDaySeconds,
}: WeekHistogramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const render = () => {
      // Clear previous
      d3.select(container).select('svg').remove();

      const width = container.offsetWidth || 400;
      const height = 100;
      const margin = { top: 8, right: 10, bottom: 22, left: 0 };

      const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      svgRef.current = svg.node();

      // Read CSS vars from themed container
      const cs = getComputedStyle(container);
      const primaryHsl = cs.getPropertyValue('--primary').trim();
      const primary = primaryHsl ? `hsl(${primaryHsl})` : '#00D4AA';
      const destructiveHsl = cs.getPropertyValue('--destructive').trim();
      const destructive = destructiveHsl ? `hsl(${destructiveHsl})` : '#ef4444';
      const fgHsl = cs.getPropertyValue('--foreground').trim();
      const fg = fgHsl ? `hsl(${fgHsl})` : '#ffffff';
      const mutedFgHsl = cs.getPropertyValue('--muted-foreground').trim();
      const mutedFg = mutedFgHsl ? `hsl(${mutedFgHsl})` : '#888888';

      const data = weekDays.map((d) => ({
        label: d.dayLabel,
        hours: d.totalSeconds / 3600,
        isWeekend: d.dayOfWeek >= 6,
      }));

      const maxHours = Math.max(10, ...data.map((d) => d.hours));

      const x = d3
        .scaleBand()
        .domain(data.map((d) => d.label))
        .range([margin.left, width - margin.right])
        .padding(0.55);

      const y = d3
        .scaleLinear()
        .domain([0, maxHours])
        .range([height - margin.bottom, margin.top]);

      // 8h target line
      svg
        .append('line')
        .attr('x1', margin.left)
        .attr('x2', width - margin.right)
        .attr('y1', y(8))
        .attr('y2', y(8))
        .attr('stroke', destructive)
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1)
        .attr('opacity', 0.4);

      svg
        .append('text')
        .attr('x', width - margin.right)
        .attr('y', y(8) - 3)
        .attr('text-anchor', 'end')
        .attr('font-family', "'Oxanium', sans-serif")
        .attr('font-size', '9px')
        .attr('fill', destructive)
        .attr('opacity', 0.5)
        .text('8h');

      // Bars
      svg
        .selectAll('.bar-group')
        .data(data)
        .enter()
        .append('g')
        .each(function (d) {
          const g = d3.select(this);

          // Bar
          g.append('rect')
            .attr('x', x(d.label)!)
            .attr('width', x.bandwidth())
            .attr('y', y(d.hours))
            .attr('height', Math.max(0, y(0) - y(d.hours)))
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', primary)
            .attr('opacity', d.isWeekend ? 0.3 : 0.85)
            .style('transition', 'opacity 0.15s')
            .style('cursor', 'default');

          // Value label above bar
          if (d.hours > 0) {
            const h = Math.floor(d.hours);
            const m = Math.round((d.hours - h) * 60);
            const label = m > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${h}:00`;
            g.append('text')
              .attr('x', x(d.label)! + x.bandwidth() / 2)
              .attr('y', y(d.hours) - 4)
              .attr('text-anchor', 'middle')
              .attr('font-family', "'Oxanium', sans-serif")
              .attr('font-size', '9px')
              .attr('font-weight', '600')
              .attr('fill', fg)
              .text(label);
          }

          // Day label below bar
          g.append('text')
            .attr('x', x(d.label)! + x.bandwidth() / 2)
            .attr('y', height - 4)
            .attr('text-anchor', 'middle')
            .attr('font-family', "'Oxanium', sans-serif")
            .attr('font-size', '9px')
            .attr('fill', mutedFg)
            .text(d.label);
        });
    };

    render();

    const observer = new ResizeObserver(() => render());
    observer.observe(container);

    return () => observer.disconnect();
  }, [weekDays]);

  const totalFormatted = formatHM(weekTotalSeconds);
  const avgFormatted = formatHM(weekAvgPerDaySeconds);

  return (
    <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] px-5 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-brand uppercase tracking-[2px] text-muted-foreground"
          style={{ fontSize: scaled(10) }}
        >
          This Week
        </span>
        <span className="font-brand font-bold text-[hsl(var(--primary))]" style={{ fontSize: scaled(16) }}>
          <span
            className="mr-2 font-normal tracking-[1px] text-muted-foreground"
            style={{ fontSize: scaled(10) }}
          >
            Total
          </span>
          {totalFormatted}
        </span>
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
            Avg/day
          </span>
          <span
            className="font-brand font-semibold tabular-nums text-foreground"
            style={{ fontSize: scaled(13) }}
          >
            {avgFormatted}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-brand uppercase tracking-[1.5px] text-muted-foreground"
            style={{ fontSize: scaled(9) }}
          >
            Target
          </span>
          <span
            className="font-brand font-semibold tabular-nums text-foreground opacity-50"
            style={{ fontSize: scaled(13) }}
          >
            40:00
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
