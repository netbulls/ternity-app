/**
 * V2 — Dark Executive
 * Premium dark-themed layout with teal accents. Same structure as V1
 * (summary page + per-user detail pages) with a deep charcoal palette.
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
  generatePieChart,
} from './shared.js';

// ── CSS ──────────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4; margin: 0; }

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  color: #ffffff;
  line-height: 1.5;
  background: #050505;
}

.page {
  width: 210mm;
  min-height: 297mm;
  position: relative;
  padding: 0;
  overflow: hidden;
  page-break-after: always;
  background: #0a0a0a;
}
.page:last-child { page-break-after: auto; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16mm 20mm 8mm 20mm;
  background: #1a1a1a;
  border-bottom: 2px solid #00D4AA;
}

.page-header-left { display: flex; align-items: center; gap: 12px; }
.logo-symbol svg { width: 28px; height: 34px; }
.logo-wordmark {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600; font-size: 16px;
  letter-spacing: 3px; color: #ffffff;
  text-transform: uppercase;
}

.page-header-right { text-align: right; font-size: 9px; color: rgba(255,255,255,0.5); line-height: 1.6; }
.page-header-right .doc-type {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600; font-size: 11px; color: #00D4AA;
  letter-spacing: 1px; text-transform: uppercase;
}

.page-footer {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; align-items: center;
  padding: 6mm 20mm 10mm 20mm;
  border-top: 1px solid #222;
  font-size: 8px; color: rgba(255,255,255,0.25);
}
.page-footer .footer-brand {
  font-family: 'Oxanium', sans-serif;
  letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.25);
}
.page-footer .page-number { font-weight: 600; color: rgba(255,255,255,0.5); }

.page-content { padding: 8mm 20mm 20mm 20mm; }

.report-title { margin-bottom: 6mm; }
.report-title h1 {
  font-family: 'Oxanium', sans-serif;
  font-size: 22px; font-weight: 700; color: #ffffff;
  letter-spacing: 1px; margin-bottom: 4px;
}
.report-title .subtitle { font-size: 12px; color: rgba(255,255,255,0.5); }
.report-title .meta-row {
  display: flex; gap: 24px; margin-top: 8px; font-size: 9px; color: rgba(255,255,255,0.5);
}
.report-title .meta-row strong { color: #ffffff; font-weight: 600; }

.summary-cards {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 4mm; margin-bottom: 8mm;
}
.summary-card {
  position: relative;
  background: #1a1a1a; border: 1px solid #222;
  border-radius: 8px; padding: 12px 14px;
}
.summary-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 2px; background: #00D4AA;
  border-radius: 8px 8px 0 0;
}
.summary-card .card-label {
  font-size: 8px; text-transform: uppercase;
  letter-spacing: 1px; color: rgba(255,255,255,0.5); margin-bottom: 4px;
}
.summary-card .card-value {
  font-family: 'Oxanium', sans-serif;
  font-size: 20px; font-weight: 700; color: #00D4AA;
}
.summary-card .card-detail { font-size: 8px; color: rgba(255,255,255,0.5); margin-top: 2px; }

.chart-section {
  display: flex; align-items: flex-start; gap: 8mm;
  margin-bottom: 8mm; padding: 5mm;
  background: #1a1a1a; border: 1px solid #222; border-radius: 8px;
}
.chart-container { flex-shrink: 0; }
.chart-legend { flex: 1; }
.chart-legend h3 {
  font-family: 'Oxanium', sans-serif;
  font-size: 11px; font-weight: 600;
  letter-spacing: 1px; text-transform: uppercase;
  color: rgba(255,255,255,0.5); margin-bottom: 8px;
}
.legend-item {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0; font-size: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.legend-item:last-child { border-bottom: none; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-name { flex: 1; color: #ffffff; }
.legend-hours { font-weight: 600; color: #00D4AA; min-width: 50px; text-align: right; }
.legend-pct { color: rgba(255,255,255,0.5); min-width: 40px; text-align: right; }

.section-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 4mm; padding-bottom: 2mm;
  border-bottom: 1px solid #222;
  page-break-inside: avoid;
}
.section-header .user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: #00D4AA; display: flex; align-items: center; justify-content: center;
  font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 13px; color: #0a0a0a;
}
.section-header .user-info h2 {
  font-family: 'Oxanium', sans-serif;
  font-size: 14px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;
}
.section-header .user-info .user-stats { font-size: 9px; color: rgba(255,255,255,0.5); }
.section-header .user-total { margin-left: auto; text-align: right; }
.section-header .user-total .total-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 18px; font-weight: 700; color: #00D4AA;
}
.section-header .user-total .total-label {
  font-size: 8px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px;
}

.entries-table {
  width: 100%; border-collapse: collapse;
  margin-bottom: 8mm; font-size: 9px;
}
.entries-table thead th {
  background: #1a1a1a; border-bottom: 2px solid #222;
  padding: 6px 8px; text-align: left;
  font-size: 8px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: rgba(255,255,255,0.5);
}
.entries-table thead th:last-child { text-align: right; }
.entries-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
.entries-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.01); }
.entries-table td { padding: 5px 8px; vertical-align: top; }
.entries-table .date-cell { white-space: nowrap; color: rgba(255,255,255,0.5); font-weight: 500; }
.entries-table .project-cell { display: flex; align-items: center; gap: 6px; }
.project-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.entries-table .desc-cell { color: #ffffff; max-width: 200px; }
.entries-table .duration-cell {
  text-align: right; font-family: 'Oxanium', sans-serif;
  font-weight: 600; white-space: nowrap;
}
.day-group-row td {
  background: rgba(255,255,255,0.03); font-weight: 600; color: #ffffff;
  padding-top: 8px; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.day-total { font-family: 'Oxanium', sans-serif; color: #00D4AA; }

.end-of-report {
  text-align: center; padding: 6mm 0;
  font-size: 9px; color: rgba(255,255,255,0.25);
  border-top: 1px solid #222; margin-top: 6mm;
}
.end-of-report .eor-label {
  font-family: 'Oxanium', sans-serif;
  font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
}
`;

// ── Header / footer partials ─────────────────────────────────────────────

function pageHeader(subtitle?: string): string {
  return `<div class="page-header">
  <div class="page-header-left">
    <div class="logo-symbol">${LOGO_SVG}</div>
    <span class="logo-wordmark">Ternity</span>
  </div>
  <div class="page-header-right">
    <div class="doc-type">Time Report</div>
    ${subtitle ? `<div>${esc(subtitle)}</div>` : ''}
  </div>
</div>`;
}

function pageFooter(data: ReportData, pageNum: number, totalPages: number): string {
  return `<div class="page-footer">
  <span class="footer-brand">Ternity &middot; app.ternity.xyz</span>
  <span>Time Report &mdash; ${esc(formatDateRange(data.dateFrom, data.dateTo))}</span>
  <span class="page-number">Page ${pageNum} of ${totalPages}</span>
</div>`;
}

// ── Main render ──────────────────────────────────────────────────────────

export function renderV2(data: ReportData): string {
  // We'll collect pages, then assemble at the end when we know totalPages
  const pages: Array<{ html: string; subtitle?: string }> = [];

  // ── Page 1: Summary + pie chart ─────────────────────────────────
  let page1 = '';

  // Title block
  page1 += `<div class="report-title">
  <h1>Time Report</h1>
  <div class="subtitle">Period: ${esc(formatDateRange(data.dateFrom, data.dateTo))}</div>
  <div class="meta-row">
    <span>Generated: <strong>${esc(formatGeneratedAt(data.generatedAt))}</strong></span>
    <span>Team: <strong>${data.summary.userCount} member${data.summary.userCount !== 1 ? 's' : ''}</strong></span>
    <span>Working days: <strong>${data.summary.workingDays}</strong></span>
  </div>
</div>`;

  // Summary cards
  const avgPerDay =
    data.summary.workingDays > 0
      ? formatHours(data.summary.totalSeconds / data.summary.workingDays)
      : '—';
  const avgPerPerson =
    data.summary.userCount > 0
      ? formatHours(data.summary.totalSeconds / data.summary.userCount)
      : '—';

  page1 += `<div class="summary-cards">
  <div class="summary-card">
    <div class="card-label">Total Hours</div>
    <div class="card-value">${formatHours(data.summary.totalSeconds)}</div>
    <div class="card-detail">across ${data.summary.userCount} team member${data.summary.userCount !== 1 ? 's' : ''}</div>
  </div>
  <div class="summary-card">
    <div class="card-label">Total Entries</div>
    <div class="card-value">${data.summary.totalEntries}</div>
    <div class="card-detail">${data.summary.workingDays} working days</div>
  </div>
  <div class="summary-card">
    <div class="card-label">Avg / Day</div>
    <div class="card-value">${avgPerDay}</div>
    <div class="card-detail">${avgPerPerson} per person</div>
  </div>
  <div class="summary-card">
    <div class="card-label">Projects</div>
    <div class="card-value">${data.summary.projectCount}</div>
    <div class="card-detail">${data.projectBreakdown.length} tracked</div>
  </div>
</div>`;

  // Pie chart + legend (use darker background ring for donut)
  const pieChart = generatePieChart(data);
  const legendItems = data.userBreakdown
    .map(
      (u, i) =>
        `<div class="legend-item">
      <div class="legend-dot" style="background: ${CHART_COLORS[i % CHART_COLORS.length]}"></div>
      <span class="legend-name">${esc(u.userName)}</span>
      <span class="legend-hours">${formatHours(u.totalSeconds)}</span>
      <span class="legend-pct">${u.percentage}%</span>
    </div>`,
    )
    .join('\n');

  page1 += `<div class="chart-section">
  <div class="chart-container">${pieChart}</div>
  <div class="chart-legend">
    <h3>Team Composition</h3>
    ${legendItems}
  </div>
</div>`;

  pages.push({ html: page1, subtitle: `Generated: ${formatGeneratedAt(data.generatedAt)}` });

  // ── User detail pages (with pagination) ─────────────────────────
  const PAGE_LINES = 32;
  const HEADER_LINES = 6;
  const DESC_CHARS_PER_LINE = 60;

  const TABLE_HEAD = `<thead><tr>
  <th style="width:70px">Time</th>
  <th style="width:120px">Project</th>
  <th>Description</th>
  <th style="width:60px">Jira</th>
  <th style="width:65px">Duration</th>
</tr></thead>`;

  for (let ui = 0; ui < data.userDetails.length; ui++) {
    const user = data.userDetails[ui]!;
    const color = CHART_COLORS[ui % CHART_COLORS.length];
    const isLastUser = ui === data.userDetails.length - 1;

    const sectionHeader = `<div class="section-header">
  <div class="user-avatar" style="background: ${color}">${esc(initials(user.userName))}</div>
  <div class="user-info">
    <h2>${esc(user.userName)}</h2>
    <div class="user-stats">${user.entryCount} entries &middot; ${user.daysActive} days active</div>
  </div>
  <div class="user-total">
    <div class="total-hours">${formatHours(user.totalSeconds)}</div>
    <div class="total-label">Total Hours</div>
  </div>
</div>`;

    const allRows: Array<{ html: string; lines: number }> = [];
    for (const dg of user.dayGroups) {
      allRows.push({
        html: `<tr class="day-group-row">
  <td colspan="4"><strong>${esc(formatDate(dg.date))}</strong></td>
  <td class="duration-cell"><span class="day-total">${formatDuration(dg.dayTotalSeconds)}</span></td>
</tr>`,
        lines: 1,
      });
      for (const entry of dg.entries) {
        const descLen = entry.description.length;
        const lines = descLen > DESC_CHARS_PER_LINE * 2 ? 3 : descLen > DESC_CHARS_PER_LINE ? 2 : 1;
        allRows.push({
          html: `<tr>
  <td class="date-cell">${esc(entry.startTime)}</td>
  <td><div class="project-cell"><span class="project-dot" style="background: ${entry.projectColor}"></span>${esc(entry.projectName)}</div></td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td style="color: ${entry.jiraIssueKey ? '#6c8eef' : 'rgba(255,255,255,0.25)'}; font-size: 8px">${entry.jiraIssueKey ? esc(entry.jiraIssueKey) : '—'}</td>
  <td class="duration-cell">${formatDuration(entry.durationSeconds)}</td>
</tr>`,
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
      const isLastChunk = chunkEnd >= allRows.length;

      let pageHtml = '';
      if (isFirstChunk) pageHtml += sectionHeader;
      pageHtml += `<table class="entries-table">\n${TABLE_HEAD}\n<tbody>\n${chunkRows}\n</tbody></table>`;

      if (isLastUser && isLastChunk) {
        pageHtml += `<div class="end-of-report">
  <div class="eor-label">End of Report</div>
  <div>${esc(formatDateRange(data.dateFrom, data.dateTo))} &middot; ${data.summary.userCount} team member${data.summary.userCount !== 1 ? 's' : ''} &middot; ${formatHours(data.summary.totalSeconds)} total</div>
</div>`;
      }

      pages.push({ html: pageHtml, subtitle: esc(user.userName) });
      rowIdx = chunkEnd;
      isFirstChunk = false;
    }

    if (allRows.length === 0) {
      let pageHtml =
        sectionHeader + `<table class="entries-table">\n${TABLE_HEAD}\n<tbody></tbody></table>`;
      if (isLastUser) {
        pageHtml += `<div class="end-of-report">
  <div class="eor-label">End of Report</div>
  <div>${esc(formatDateRange(data.dateFrom, data.dateTo))} &middot; ${data.summary.userCount} team member${data.summary.userCount !== 1 ? 's' : ''} &middot; ${formatHours(data.summary.totalSeconds)} total</div>
</div>`;
      }
      pages.push({ html: pageHtml, subtitle: esc(user.userName) });
    }
  }

  // ── Assemble final HTML ─────────────────────────────────────────
  const totalPages = pages.length;

  const pagesHtml = pages
    .map(
      (p, i) => `<div class="page">
  ${pageHeader(p.subtitle)}
  <div class="page-content">${p.html}</div>
  ${pageFooter(data, i + 1, totalPages)}
</div>`,
    )
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
