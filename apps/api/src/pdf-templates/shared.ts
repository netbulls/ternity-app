/**
 * Shared helpers for PDF report HTML template rendering.
 * All templates produce self-contained HTML strings that Gotenberg converts to PDF.
 */

import type { ReportData } from '@ternity/shared';

// ── Brand assets ─────────────────────────────────────────────────────────

/** Ternity hourglass logo SVG — path-based, no font deps */
export const LOGO_SVG = `<svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 5 L82 5 L62 48 L82 95 L18 95 L38 48Z" stroke="#00D4AA" stroke-width="5" stroke-linejoin="round" fill="none"/>
  <circle cx="50" cy="32" r="6" fill="#00D4AA"/>
  <circle cx="49" cy="52" r="7.5" fill="#00D4AA"/>
  <circle cx="54" cy="67" r="5.5" fill="#00D4AA"/>
  <circle cx="44" cy="77" r="7" fill="#00D4AA"/>
  <circle cx="56" cy="83" r="6" fill="#00D4AA"/>
</svg>`;

/** User-breakdown chart colors (cycling) */
export const CHART_COLORS = [
  '#00D4AA',
  '#6C8EEF',
  '#F5A623',
  '#E05C6E',
  '#9B59B6',
  '#3498DB',
  '#E67E22',
  '#1ABC9C',
];

// ── Formatters ───────────────────────────────────────────────────────────

export function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateRange(from: string, to: string): string {
  const f = new Date(from + 'T12:00:00Z');
  const t = new Date(to + 'T12:00:00Z');
  const fMonth = f.toLocaleDateString('en-US', { month: 'short' });
  const tMonth = t.toLocaleDateString('en-US', { month: 'short' });
  if (fMonth === tMonth && f.getFullYear() === t.getFullYear()) {
    return `${f.getDate()} – ${t.getDate()} ${fMonth} ${f.getFullYear()}`;
  }
  return `${formatDateShort(from)} – ${formatDateShort(to)}`;
}

export function formatGeneratedAt(isoStr: string): string {
  const d = new Date(isoStr);
  return (
    d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
}

/** User initials from display name */
export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Escape HTML special characters */
export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── SVG pie/donut chart generator ────────────────────────────────────────

export function generatePieChart(
  data: ReportData,
  opts: { size?: number; strokeWidth?: number; type?: 'pie' | 'donut' } = {},
): string {
  const size = opts.size ?? 160;
  const sw = opts.strokeWidth ?? 20;
  const r = (size - sw) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const slices = data.userBreakdown.map((u, i) => {
    const pct = u.percentage / 100;
    const dashLen = pct * circumference;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const slice = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dashLen.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dashLen;
    return slice;
  });

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e9ecef" stroke-width="${sw}"/>
    ${slices.join('\n    ')}
  </svg>`;
}

// ── Google Fonts link ────────────────────────────────────────────────────

export const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Oxanium:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>`;
