/**
 * V1 — Classic Corporate
 * Clean, table-heavy layout. Traditional header/footer on every page.
 * Page-breaks between user sections. Light background, corporate feel.
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

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16mm 20mm 8mm 20mm;
  border-bottom: 2px solid #00D4AA;
}

.page-header-left { display: flex; align-items: center; gap: 12px; }
.logo-symbol svg { width: 28px; height: 34px; }
.logo-wordmark {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600; font-size: 16px;
  letter-spacing: 3px; color: #0a0a0a;
  text-transform: uppercase;
}

.page-header-right { text-align: right; font-size: 9px; color: #666; line-height: 1.6; }
.page-header-right .doc-type {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600; font-size: 11px; color: #0a0a0a;
  letter-spacing: 1px; text-transform: uppercase;
}

.page-footer {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; align-items: center;
  padding: 6mm 20mm 10mm 20mm;
  border-top: 1px solid #e5e5e5;
  font-size: 8px; color: #999;
}
.page-footer .footer-brand {
  font-family: 'Oxanium', sans-serif;
  letter-spacing: 2px; text-transform: uppercase; color: #ccc;
}
.page-footer .page-number { font-weight: 600; color: #666; }

.page-content { padding: 8mm 20mm 20mm 20mm; }

.report-title { margin-bottom: 6mm; }
.report-title h1 {
  font-family: 'Oxanium', sans-serif;
  font-size: 22px; font-weight: 700; color: #0a0a0a;
  letter-spacing: 1px; margin-bottom: 4px;
}
.report-title .subtitle { font-size: 12px; color: #666; }
.report-title .meta-row {
  display: flex; gap: 24px; margin-top: 8px; font-size: 9px; color: #999;
}
.report-title .meta-row strong { color: #333; font-weight: 600; }

.summary-cards {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 4mm; margin-bottom: 8mm;
}
.summary-card {
  background: #f8f9fa; border: 1px solid #e9ecef;
  border-radius: 6px; padding: 12px 14px;
}
.summary-card .card-label {
  font-size: 8px; text-transform: uppercase;
  letter-spacing: 1px; color: #999; margin-bottom: 4px;
}
.summary-card .card-value {
  font-family: 'Oxanium', sans-serif;
  font-size: 20px; font-weight: 700; color: #0a0a0a;
}
.summary-card .card-detail { font-size: 8px; color: #999; margin-top: 2px; }

.chart-section {
  display: flex; align-items: flex-start; gap: 8mm;
  margin-bottom: 8mm; padding: 5mm;
  background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px;
}
.chart-container { flex-shrink: 0; }
.chart-legend { flex: 1; }
.chart-legend h3 {
  font-family: 'Oxanium', sans-serif;
  font-size: 11px; font-weight: 600;
  letter-spacing: 1px; text-transform: uppercase;
  color: #333; margin-bottom: 8px;
}
.legend-item {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0; font-size: 10px;
  border-bottom: 1px solid #f0f0f0;
}
.legend-item:last-child { border-bottom: none; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-name { flex: 1; color: #333; }
.legend-hours { font-weight: 600; color: #0a0a0a; min-width: 50px; text-align: right; }
.legend-pct { color: #999; min-width: 40px; text-align: right; }

.section-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 4mm; padding-bottom: 2mm;
  border-bottom: 1px solid #e5e5e5;
  page-break-inside: avoid;
}
.section-header .user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: #00D4AA; display: flex; align-items: center; justify-content: center;
  font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 13px; color: #0a0a0a;
}
.section-header .user-info h2 {
  font-family: 'Oxanium', sans-serif;
  font-size: 14px; font-weight: 600; color: #0a0a0a; letter-spacing: 0.5px;
}
.section-header .user-info .user-stats { font-size: 9px; color: #999; }
.section-header .user-total { margin-left: auto; text-align: right; }
.section-header .user-total .total-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 18px; font-weight: 700; color: #00D4AA;
}
.section-header .user-total .total-label {
  font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 1px;
}

.entries-table {
  width: 100%; border-collapse: collapse;
  margin-bottom: 8mm; font-size: 9px;
}
.entries-table thead th {
  background: #f4f5f6; border-bottom: 2px solid #dee2e6;
  padding: 6px 8px; text-align: left;
  font-size: 8px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: #666;
}
.entries-table thead th:last-child { text-align: right; }
.entries-table tbody tr { border-bottom: 1px solid #f0f0f0; }
.entries-table td { padding: 5px 8px; vertical-align: top; }
.entries-table .date-cell { white-space: nowrap; color: #666; font-weight: 500; }
.entries-table .project-cell { display: flex; align-items: center; gap: 6px; }
.project-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.entries-table .desc-cell { color: #333; max-width: 200px; }
.entries-table .duration-cell {
  text-align: right; font-family: 'Oxanium', sans-serif;
  font-weight: 600; white-space: nowrap;
}
.day-group-row td {
  background: #fafbfc; font-weight: 600; color: #333;
  padding-top: 8px; border-bottom: 1px solid #e5e5e5;
}
.day-total { font-family: 'Oxanium', sans-serif; color: #00D4AA; }

.section-divider { border: none; border-top: 1px solid #e5e5e5; margin: 6mm 0; }
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

export function renderV1(data: ReportData): string {
  // We'll collect pages, then assemble at the end when we know totalPages
  const pages: Array<{ html: string; subtitle?: string }> = [];

  // ── Page 1: Summary + pie chart + first user start ──────────────
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

  // Pie chart + legend
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
  // Row capacity in "line units" — each single-line row = 1 unit, multi-line rows
  // (long descriptions) count as 2. Header area takes ~6 units on first page.
  const PAGE_LINES = 32;
  const HEADER_LINES = 6; // section header + gap

  // ~60 chars per line in the description column at 9px/Inter
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

    // Build the user section header (only for the first page of this user)
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

    // Collect all table rows for this user, with line-height estimates
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
        // Estimate line count based on description length
        const descLen = entry.description.length;
        const lines = descLen > DESC_CHARS_PER_LINE * 2 ? 3 : descLen > DESC_CHARS_PER_LINE ? 2 : 1;

        allRows.push({
          html: `<tr>
  <td class="date-cell">${esc(entry.startTime)}</td>
  <td><div class="project-cell"><span class="project-dot" style="background: ${entry.projectColor}"></span>${esc(entry.projectName)}</div></td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td style="color: ${entry.jiraIssueKey ? '#6c8eef' : '#666'}; font-size: 8px">${entry.jiraIssueKey ? esc(entry.jiraIssueKey) : '—'}</td>
  <td class="duration-cell">${formatDuration(entry.durationSeconds)}</td>
</tr>`,
          lines,
        });
      }
    }

    // Paginate rows across multiple pages using line-unit budgets
    let rowIdx = 0;
    let isFirstChunk = true;

    while (rowIdx < allRows.length) {
      let budget = PAGE_LINES - (isFirstChunk ? HEADER_LINES : 0);
      let chunkEnd = rowIdx;

      while (chunkEnd < allRows.length && budget >= allRows[chunkEnd]!.lines) {
        budget -= allRows[chunkEnd]!.lines;
        chunkEnd++;
      }

      // Ensure at least one row per page to avoid infinite loops
      if (chunkEnd === rowIdx) chunkEnd = rowIdx + 1;

      const chunkRows = allRows
        .slice(rowIdx, chunkEnd)
        .map((r) => r.html)
        .join('\n');

      let pageHtml = '';
      if (isFirstChunk) {
        pageHtml += sectionHeader;
      }
      pageHtml += `<table class="entries-table">\n${TABLE_HEAD}\n<tbody>\n${chunkRows}\n</tbody></table>`;

      pages.push({
        html: pageHtml,
        subtitle: esc(user.userName),
      });

      rowIdx = chunkEnd;
      isFirstChunk = false;
    }

    // Edge case: user with no entries still gets one page
    if (allRows.length === 0) {
      pages.push({
        html:
          sectionHeader + `<table class="entries-table">\n${TABLE_HEAD}\n<tbody></tbody></table>`,
        subtitle: esc(user.userName),
      });
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
