/**
 * V3 — Minimal Swiss
 * Ultra-clean Swiss/International Typographic Style.
 * White background, no cards/borders, horizontal bar chart,
 * div-based entry rows, minimal footer.
 */

import type { ReportData } from '@ternity/shared';
import {
  LOGO_SVG,
  CHART_COLORS,
  FONTS_LINK,
  formatHours,
  formatDuration,
  formatDate,
  formatDateRange,
  formatGeneratedAt,
  initials,
  esc,
} from './shared.js';

// ── CSS ──────────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4; margin: 0; }

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 9px;
  color: #1a1a1a;
  line-height: 1.5;
  background: white;
}

.page {
  width: 210mm;
  min-height: 297mm;
  position: relative;
  padding: 0;
  overflow: hidden;
  page-break-after: always;
  background: #ffffff;
}
.page:last-child { page-break-after: auto; }

.page-inner { padding: 20mm 25mm 24mm 25mm; }

.page-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 25mm 12mm 25mm;
}
.page-footer-rule {
  border: none;
  border-top: 0.5px solid #ccc;
  margin-bottom: 6px;
}
.page-footer-text {
  text-align: right;
  font-size: 7.5px;
  color: #999;
  font-family: 'Inter', system-ui, sans-serif;
}

/* ── Cover page ─────────────────────────────────────────────────────── */

.cover-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14mm;
}
.cover-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cover-brand svg { width: 22px; height: 26px; }
.cover-brand-name {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #0a0a0a;
}
.cover-label {
  font-family: 'Oxanium', sans-serif;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #999;
}

.cover-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: #0a0a0a;
  letter-spacing: 0.5px;
  line-height: 1.15;
  margin-bottom: 4px;
}
.cover-subtitle {
  font-size: 13px;
  color: #666;
  margin-bottom: 6mm;
}

.cover-rule {
  border: none;
  border-top: 2px solid #0a0a0a;
  margin-bottom: 6mm;
}

/* ── Summary metrics ────────────────────────────────────────────────── */

.metrics-row {
  display: flex;
  gap: 0;
  margin-bottom: 6mm;
}
.metric {
  flex: 1;
}
.metric-label {
  font-size: 7.5px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #999;
  margin-bottom: 3px;
}
.metric-value {
  font-family: 'Oxanium', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #0a0a0a;
}
.metric-detail {
  font-size: 7.5px;
  color: #999;
  margin-top: 1px;
}

.metrics-rule {
  border: none;
  border-top: 0.5px solid #ccc;
  margin-bottom: 6mm;
}

/* ── Horizontal bar chart ───────────────────────────────────────────── */

.bar-chart {
  margin-bottom: 8mm;
}
.bar-chart-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #999;
  margin-bottom: 5mm;
}
.bar-row {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}
.bar-label {
  width: 130px;
  flex-shrink: 0;
  font-size: 9px;
  color: #1a1a1a;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 10px;
}
.bar-track {
  flex: 1;
  height: 14px;
  background: #f5f5f5;
  position: relative;
}
.bar-fill {
  height: 100%;
  min-width: 1px;
}
.bar-value {
  width: 52px;
  flex-shrink: 0;
  text-align: right;
  font-family: 'Oxanium', sans-serif;
  font-size: 9px;
  font-weight: 600;
  color: #1a1a1a;
  padding-left: 8px;
}

/* ── Continuation header ────────────────────────────────────────────── */

.cont-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8mm;
  padding-bottom: 3mm;
  border-bottom: 0.5px solid #ccc;
}
.cont-wordmark {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #ccc;
}
.cont-context {
  font-size: 8px;
  color: #999;
}

/* ── User section ───────────────────────────────────────────────────── */

.user-section { margin-bottom: 6mm; }

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 2mm;
  border-bottom: 1px solid #1a1a1a;
  margin-bottom: 4mm;
  page-break-inside: avoid;
}
.user-name {
  font-family: 'Oxanium', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #0a0a0a;
  letter-spacing: 0.3px;
}
.user-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
}
.user-stats {
  font-size: 8px;
  color: #999;
  margin-bottom: 4mm;
}

/* ── Day groups + entries ───────────────────────────────────────────── */

.day-group {
  margin-bottom: 3mm;
  page-break-inside: avoid;
}
.day-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  margin-bottom: 1px;
}
.day-label {
  font-size: 8.5px;
  font-weight: 600;
  color: #1a1a1a;
}
.day-total {
  font-family: 'Oxanium', sans-serif;
  font-size: 8.5px;
  font-weight: 600;
  color: #00D4AA;
}

.entry-row {
  display: flex;
  align-items: baseline;
  padding: 2.5px 0;
  border-bottom: 0.5px solid #f0f0f0;
  font-size: 8.5px;
}
.entry-row:last-child { border-bottom: none; }

.entry-project {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #333;
}
.entry-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}
.entry-project-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-desc {
  flex: 1;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
}
.entry-jira {
  width: 55px;
  flex-shrink: 0;
  font-size: 7.5px;
  color: #6c8eef;
  text-align: left;
}
.entry-jira.empty { color: #ccc; }
.entry-duration {
  width: 48px;
  flex-shrink: 0;
  text-align: right;
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  color: #1a1a1a;
}
`;

// ── Helpers ──────────────────────────────────────────────────────────────

function coverTitle(dateFrom: string, dateTo: string): string {
  const f = new Date(dateFrom + 'T12:00:00Z');
  const t = new Date(dateTo + 'T12:00:00Z');
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const fMonth = monthNames[f.getUTCMonth()]!;
  const tMonth = monthNames[t.getUTCMonth()]!;
  if (fMonth === tMonth && f.getUTCFullYear() === t.getUTCFullYear()) {
    return `${fMonth} ${f.getUTCFullYear()}`;
  }
  if (f.getUTCFullYear() === t.getUTCFullYear()) {
    return `${fMonth} – ${tMonth} ${f.getUTCFullYear()}`;
  }
  return `${fMonth} ${f.getUTCFullYear()} – ${tMonth} ${t.getUTCFullYear()}`;
}

function pageFooter(pageNum: number): string {
  return `<div class="page-footer">
  <hr class="page-footer-rule"/>
  <div class="page-footer-text">Page ${pageNum}</div>
</div>`;
}

function contHeader(data: ReportData): string {
  return `<div class="cont-header">
  <span class="cont-wordmark">Ternity</span>
  <span class="cont-context">${esc(formatDateRange(data.dateFrom, data.dateTo))}</span>
</div>`;
}

function generateBarChart(data: ReportData): string {
  const maxSeconds = Math.max(...data.userBreakdown.map((u) => u.totalSeconds), 1);

  const rows = data.userBreakdown
    .map((u, i) => {
      const pct = (u.totalSeconds / maxSeconds) * 100;
      const color = CHART_COLORS[i % CHART_COLORS.length];
      return `<div class="bar-row">
  <div class="bar-label">${esc(u.userName)}</div>
  <div class="bar-track"><div class="bar-fill" style="width: ${pct.toFixed(1)}%; background: ${color}"></div></div>
  <div class="bar-value">${formatHours(u.totalSeconds)}</div>
</div>`;
    })
    .join('\n');

  return `<div class="bar-chart">
  <div class="bar-chart-title">Team Breakdown</div>
  ${rows}
</div>`;
}

// ── Main render ──────────────────────────────────────────────────────────

export function renderV3(data: ReportData): string {
  const pages: Array<{ html: string; isCover?: boolean }> = [];

  // ── Page 1: Cover ───────────────────────────────────────────────
  let cover = '';

  // Top row: brand left, label right
  cover += `<div class="cover-top">
  <div class="cover-brand">${LOGO_SVG}<span class="cover-brand-name">Ternity</span></div>
  <div class="cover-label">Time Report</div>
</div>`;

  // Title + subtitle
  cover += `<div class="cover-title">${esc(coverTitle(data.dateFrom, data.dateTo))}</div>`;
  cover += `<div class="cover-subtitle">${esc(formatDateRange(data.dateFrom, data.dateTo))}</div>`;

  // Rule
  cover += `<hr class="cover-rule"/>`;

  // Summary metrics row
  const avgPerDay =
    data.summary.workingDays > 0
      ? formatHours(data.summary.totalSeconds / data.summary.workingDays)
      : '—';

  cover += `<div class="metrics-row">
  <div class="metric">
    <div class="metric-label">Total Hours</div>
    <div class="metric-value">${formatHours(data.summary.totalSeconds)}</div>
    <div class="metric-detail">${data.summary.workingDays} working days</div>
  </div>
  <div class="metric">
    <div class="metric-label">Entries</div>
    <div class="metric-value">${data.summary.totalEntries}</div>
    <div class="metric-detail">${data.summary.projectCount} project${data.summary.projectCount !== 1 ? 's' : ''}</div>
  </div>
  <div class="metric">
    <div class="metric-label">Avg / Day</div>
    <div class="metric-value">${avgPerDay}</div>
    <div class="metric-detail">across team</div>
  </div>
  <div class="metric">
    <div class="metric-label">Team</div>
    <div class="metric-value">${data.summary.userCount}</div>
    <div class="metric-detail">member${data.summary.userCount !== 1 ? 's' : ''}</div>
  </div>
</div>`;

  // Rule
  cover += `<hr class="metrics-rule"/>`;

  // Horizontal bar chart
  cover += generateBarChart(data);

  pages.push({ html: cover, isCover: true });

  // ── User detail pages (with pagination) ─────────────────────────
  const PAGE_LINES = 28;
  const HEADER_LINES = 4;
  const DESC_CHARS_PER_LINE = 55;

  for (const user of data.userDetails) {
    const sectionHeader = `<div class="user-header">
  <span class="user-name">${esc(user.userName)}</span>
  <span class="user-hours">${formatHours(user.totalSeconds)}</span>
</div>
<div class="user-stats">${user.entryCount} entries &middot; ${user.daysActive} days active</div>`;

    const allRows: Array<{ html: string; lines: number }> = [];
    for (const dg of user.dayGroups) {
      allRows.push({
        html: `<div class="day-header">
  <span class="day-label">${esc(formatDate(dg.date))}</span>
  <span class="day-total">${formatDuration(dg.dayTotalSeconds)}</span>
</div>`,
        lines: 1,
      });
      for (const entry of dg.entries) {
        const jiraHtml = entry.jiraIssueKey
          ? `<div class="entry-jira">${esc(entry.jiraIssueKey)}</div>`
          : `<div class="entry-jira empty">&mdash;</div>`;
        const descLen = entry.description.length;
        const lines = descLen > DESC_CHARS_PER_LINE * 2 ? 3 : descLen > DESC_CHARS_PER_LINE ? 2 : 1;
        allRows.push({
          html: `<div class="entry-row">
  <div class="entry-project"><span class="entry-dot" style="background: ${entry.projectColor}"></span><span class="entry-project-name">${esc(entry.projectName)}</span></div>
  <div class="entry-desc">${esc(entry.description)}</div>
  ${jiraHtml}
  <div class="entry-duration">${formatDuration(entry.durationSeconds)}</div>
</div>`,
          lines,
        });
      }
    }

    let rowIdx = 0;
    let isFirstChunk = true;
    while (rowIdx < allRows.length) {
      let budget = PAGE_LINES - (isFirstChunk ? HEADER_LINES : 0);
      let chunkEnd = rowIdx;
      while (chunkEnd < allRows.length && budget >= allRows[chunkEnd]!.lines) {
        budget -= allRows[chunkEnd]!.lines;
        chunkEnd++;
      }
      if (chunkEnd === rowIdx) chunkEnd = rowIdx + 1;

      const chunkRows = allRows
        .slice(rowIdx, chunkEnd)
        .map((r) => r.html)
        .join('\n');

      let pageHtml = '<div class="user-section">';
      if (isFirstChunk) pageHtml += sectionHeader;
      pageHtml += chunkRows;
      pageHtml += '</div>';

      pages.push({ html: pageHtml });
      rowIdx = chunkEnd;
      isFirstChunk = false;
    }

    if (allRows.length === 0) {
      pages.push({ html: `<div class="user-section">${sectionHeader}</div>` });
    }
  }

  // ── Assemble final HTML ─────────────────────────────────────────
  const totalPages = pages.length;

  const pagesHtml = pages
    .map((p, i) => {
      const inner = p.isCover
        ? `<div class="page-inner">${p.html}</div>`
        : `<div class="page-inner">${contHeader(data)}${p.html}</div>`;

      return `<div class="page">
  ${inner}
  ${pageFooter(i + 1)}
</div>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
${FONTS_LINK}
<style>${CSS}</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}
