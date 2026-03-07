/**
 * V7 — Cover + Chapters
 * Professional multi-section consulting firm deliverable.
 * Dark full-bleed cover page, table of contents with dotted leaders,
 * numbered chapter headings, 2×2 metrics grid, donut chart,
 * user sections with day-grouped entry tables, closing block.
 */

import type { ReportData } from '@ternity/shared';
import {
  LOGO_SVG,
  CHART_COLORS,
  FONTS_LINK,
  formatHours,
  formatDuration,
  formatDate,
  formatDateShort,
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

/* ── Cover page ───────────────────────────────────────────────────── */

.page-cover {
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.cover-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.cover-logo svg { width: 100px; height: auto; margin-bottom: 24px; }

.cover-wordmark {
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  font-size: 24px;
  color: #ffffff;
  letter-spacing: 8px;
  text-transform: uppercase;
  margin-bottom: 24px;
}

.cover-rule {
  width: 60px;
  height: 2px;
  background: #00D4AA;
  margin-bottom: 24px;
}

.cover-subtitle {
  font-family: 'Oxanium', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 6px;
  text-transform: uppercase;
  margin-bottom: 40px;
}

.cover-period {
  font-family: 'Oxanium', sans-serif;
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 12px;
}

.cover-client {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
}

.cover-bottom {
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1.8;
}

.cover-bottom .confidential {
  font-family: 'Oxanium', sans-serif;
  font-size: 8px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.25);
  margin-top: 8px;
}

/* ── Page header (content pages) ──────────────────────────────────── */

.page-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12mm 20mm 6mm 20mm;
}

.page-header .logo-symbol svg { width: 22px; height: 26px; }

.page-header .logo-wordmark {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 3px;
  color: #0a0a0a;
  text-transform: uppercase;
}

/* ── Page footer ──────────────────────────────────────────────────── */

.page-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 20mm 10mm 20mm;
}

.page-footer-rule {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin-bottom: 6px;
}

.page-footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8px;
  color: #999;
}

.page-footer .footer-left {
  font-family: 'Inter', system-ui, sans-serif;
}

.page-footer .page-number {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  color: #666;
}

/* ── Page content area ────────────────────────────────────────────── */

.page-content { padding: 4mm 20mm 20mm 20mm; }

/* ── TOC ──────────────────────────────────────────────────────────── */

.toc-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #0a0a0a;
  margin-bottom: 12px;
}

.toc-rule {
  border: none;
  border-top: 2px solid #00D4AA;
  margin-bottom: 24px;
}

.toc-entry {
  display: flex;
  align-items: baseline;
  padding: 8px 0;
  font-size: 11px;
  line-height: 1.6;
}

.toc-number {
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  color: #00D4AA;
  min-width: 32px;
  flex-shrink: 0;
}

.toc-label {
  color: #1a1a1a;
  flex-shrink: 0;
}

.toc-dots {
  flex: 1;
  border-bottom: 1px dotted #ccc;
  margin: 0 8px;
  min-width: 20px;
  height: 0;
  align-self: center;
}

.toc-page {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  color: #1a1a1a;
  flex-shrink: 0;
  min-width: 20px;
  text-align: right;
}

/* ── Chapter heading ──────────────────────────────────────────────── */

.chapter-heading {
  margin-bottom: 6mm;
  page-break-inside: avoid;
}

.chapter-number {
  font-family: 'Oxanium', sans-serif;
  font-size: 48px;
  font-weight: 700;
  color: #e0e0e0;
  line-height: 1;
}

.chapter-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin-top: 2px;
  margin-bottom: 8px;
}

.chapter-accent {
  width: 40px;
  height: 3px;
  background: #00D4AA;
}

/* ── Summary metrics grid ─────────────────────────────────────────── */

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4mm;
  margin-bottom: 8mm;
}

.metric-card {
  border-left: 3px solid #00D4AA;
  padding: 10px 14px;
  background: #f8f9fa;
}

.metric-card .metric-label {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #999;
  margin-bottom: 4px;
}

.metric-card .metric-value {
  font-family: 'Oxanium', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #0a0a0a;
}

.metric-card .metric-detail {
  font-size: 8px;
  color: #999;
  margin-top: 2px;
}

/* ── Donut chart section ──────────────────────────────────────────── */

.chart-section {
  display: flex;
  align-items: flex-start;
  gap: 8mm;
  margin-bottom: 8mm;
}

.chart-container { flex-shrink: 0; }

.chart-legend { flex: 1; }

.chart-legend h3 {
  font-family: 'Oxanium', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 10px;
  border-bottom: 1px solid #f0f0f0;
}
.legend-item:last-child { border-bottom: none; }

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name { flex: 1; color: #333; }

.legend-hours {
  font-weight: 600;
  color: #0a0a0a;
  min-width: 50px;
  text-align: right;
}

.legend-pct {
  color: #999;
  min-width: 40px;
  text-align: right;
}

/* ── User section heading ─────────────────────────────────────────── */

.section-chapter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4mm;
  padding-bottom: 2mm;
  page-break-inside: avoid;
}

.section-chapter-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-chapter-id {
  font-family: 'Oxanium', sans-serif;
  font-size: 28px;
  font-weight: 700;
  color: #e0e0e0;
  line-height: 1;
}

.section-chapter-name {
  font-family: 'Oxanium', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.section-chapter-stats {
  font-size: 9px;
  color: #999;
}

.section-chapter-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #00D4AA;
  text-align: right;
}

.section-chapter-accent {
  width: 100%;
  height: 2px;
  background: #00D4AA;
  margin-bottom: 4mm;
}

/* ── Entries table ────────────────────────────────────────────────── */

.entries-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 6mm;
  font-size: 9px;
}

.entries-table thead th {
  background: #f4f5f6;
  border-bottom: 2px solid #dee2e6;
  padding: 6px 8px;
  text-align: left;
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
}
.entries-table thead th:last-child { text-align: right; }

.entries-table tbody tr { border-bottom: 1px solid #f0f0f0; }

.entries-table td { padding: 5px 8px; vertical-align: top; }

.entries-table .time-cell {
  white-space: nowrap;
  color: #666;
  font-weight: 500;
}

.entries-table .project-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.project-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.entries-table .desc-cell { color: #333; max-width: 200px; }

.entries-table .jira-cell {
  font-size: 8px;
  white-space: nowrap;
}

.entries-table .duration-cell {
  text-align: right;
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  white-space: nowrap;
}

.day-group-row td {
  background: #fafbfc;
  font-weight: 600;
  color: #333;
  padding-top: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.day-total {
  font-family: 'Oxanium', sans-serif;
  color: #00D4AA;
}

/* ── Closing block ────────────────────────────────────────────────── */

.closing-block {
  margin-top: 10mm;
  position: relative;
}

.closing-rule {
  border: none;
  border-top: 2px solid #00D4AA;
  margin-bottom: 16px;
}

.closing-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.closing-details {
  font-size: 9px;
  color: #666;
  line-height: 2;
}

.closing-details strong { color: #333; font-weight: 600; }

.closing-watermark {
  position: absolute;
  bottom: -10px;
  right: 0;
  opacity: 0.06;
}
.closing-watermark svg { width: 100px; height: auto; }

/* ── User section divider (between users that share a page) ───────── */

.user-divider {
  border: none;
  border-top: 1px solid #e5e5e5;
  margin: 6mm 0;
}
`;

// ── Helpers ──────────────────────────────────────────────────────────────

/** Format a period like "February 2026" from dateFrom */
function formatPeriodLabel(dateFrom: string, dateTo: string): string {
  const f = new Date(dateFrom + 'T12:00:00Z');
  const t = new Date(dateTo + 'T12:00:00Z');
  const fMonth = f.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const tMonth = t.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (fMonth === tMonth) return fMonth;
  return `${f.toLocaleDateString('en-US', { month: 'short' })} – ${t.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

/** Zero-padded chapter number */
function chapterNum(n: number): string {
  return String(n).padStart(2, '0');
}

/** Derive a client/organization name from projectBreakdown (first client or fallback) */
function deriveOrgName(data: ReportData): string {
  for (const p of data.projectBreakdown) {
    if (p.clientName) return p.clientName;
  }
  return `${data.summary.userCount} Team Member${data.summary.userCount !== 1 ? 's' : ''}`;
}

// ── Page partials ────────────────────────────────────────────────────────

function pageHeader(): string {
  return `<div class="page-header">
  <div class="logo-symbol">${LOGO_SVG}</div>
  <span class="logo-wordmark">Ternity</span>
</div>`;
}

function pageFooter(data: ReportData, pageNum: number, totalPages: number): string {
  const org = deriveOrgName(data);
  const period = formatDateRange(data.dateFrom, data.dateTo);
  return `<div class="page-footer">
  <hr class="page-footer-rule"/>
  <div class="page-footer-inner">
    <span class="footer-left">${esc(org)} &middot; Time Report &middot; ${esc(period)}</span>
    <span class="page-number">Page ${pageNum}</span>
  </div>
</div>`;
}

// ── Cover page ───────────────────────────────────────────────────────────

function renderCover(data: ReportData): string {
  const period = formatPeriodLabel(data.dateFrom, data.dateTo);
  const org = deriveOrgName(data);
  const generated = formatDateShort(data.generatedAt.slice(0, 10));
  return `<div class="page page-cover">
  <div class="cover-content">
    <div class="cover-logo">${LOGO_SVG}</div>
    <div class="cover-wordmark">Ternity</div>
    <div class="cover-rule"></div>
    <div class="cover-subtitle">Time Report</div>
    <div class="cover-period">${esc(period)}</div>
    <div class="cover-client">${esc(org)}</div>
  </div>
  <div class="cover-bottom">
    <div>Prepared by Ternity &middot; ${esc(generated)}</div>
    <div class="confidential">Confidential</div>
  </div>
</div>`;
}

// ── Main render ──────────────────────────────────────────────────────────

export function renderV7(data: ReportData): string {
  // Numbered chapters: 01 = Executive Summary, then one per user (02, 03, ...)
  // TOC entries list chapter number, title, and page number.
  // Cover = page 1, TOC = page 2, content starts on page 3.

  // ── Build content pages ─────────────────────────────────────────
  // Each entry in contentPages is one <div class="page"> of body content.
  // We'll number pages at the end.

  const contentPages: string[] = [];

  // ── Chapter 01: Executive Summary + first user ──────────────────

  let ch01 = '';

  // Chapter heading
  ch01 += `<div class="chapter-heading">
  <div class="chapter-number">${chapterNum(1)}</div>
  <div class="chapter-title">Executive Summary</div>
  <div class="chapter-accent"></div>
</div>`;

  // 2×2 metrics grid
  const avgPerDay =
    data.summary.workingDays > 0
      ? formatHours(data.summary.totalSeconds / data.summary.workingDays)
      : '—';
  const avgPerPerson =
    data.summary.userCount > 0
      ? formatHours(data.summary.totalSeconds / data.summary.userCount)
      : '—';

  ch01 += `<div class="metrics-grid">
  <div class="metric-card">
    <div class="metric-label">Total Hours</div>
    <div class="metric-value">${formatHours(data.summary.totalSeconds)}</div>
    <div class="metric-detail">across ${data.summary.userCount} team member${data.summary.userCount !== 1 ? 's' : ''}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Total Entries</div>
    <div class="metric-value">${data.summary.totalEntries}</div>
    <div class="metric-detail">${data.summary.workingDays} working days</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Avg / Day</div>
    <div class="metric-value">${avgPerDay}</div>
    <div class="metric-detail">${avgPerPerson} per person</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Projects</div>
    <div class="metric-value">${data.summary.projectCount}</div>
    <div class="metric-detail">${data.projectBreakdown.length} tracked</div>
  </div>
</div>`;

  // Donut chart + legend
  const pieChart = generatePieChart(data, { type: 'donut' });
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

  ch01 += `<div class="chart-section">
  <div class="chart-container">${pieChart}</div>
  <div class="chart-legend">
    <h3>Team Composition</h3>
    ${legendItems}
  </div>
</div>`;

  // First user section starts on the same page as executive summary
  // Only add the section header — entries paginate from here
  const V7_CH01_LINES = 8; // very limited line budget on the summary page
  const V7_PAGE_LINES = 32;
  const V7_HEADER_LINES = 6;
  const V7_DESC_CHARS_PER_LINE = 60;

  const V7_TABLE_HEAD = `<thead><tr>
  <th style="width:70px">Time</th>
  <th style="width:120px">Project</th>
  <th>Description</th>
  <th style="width:60px">Jira</th>
  <th style="width:65px">Duration</th>
</tr></thead>`;

  type RowItem = { html: string; lines: number };

  function collectUserRows(user: ReportData['userDetails'][number]): RowItem[] {
    const rows: RowItem[] = [];
    for (const dg of user.dayGroups) {
      rows.push({
        html: `<tr class="day-group-row">
  <td colspan="4"><strong>${esc(formatDate(dg.date))}</strong></td>
  <td class="duration-cell"><span class="day-total">${formatDuration(dg.dayTotalSeconds)}</span></td>
</tr>`,
        lines: 1,
      });
      for (const entry of dg.entries) {
        const descLen = entry.description.length;
        const lines =
          descLen > V7_DESC_CHARS_PER_LINE * 2 ? 3 : descLen > V7_DESC_CHARS_PER_LINE ? 2 : 1;
        rows.push({
          html: `<tr>
  <td class="time-cell">${esc(entry.startTime)}</td>
  <td><div class="project-cell"><span class="project-dot" style="background: ${entry.projectColor}"></span>${esc(entry.projectName)}</div></td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td class="jira-cell" style="color: ${entry.jiraIssueKey ? '#6c8eef' : '#ccc'}">${entry.jiraIssueKey ? esc(entry.jiraIssueKey) : '—'}</td>
  <td class="duration-cell">${formatDuration(entry.durationSeconds)}</td>
</tr>`,
          lines,
        });
      }
    }
    return rows;
  }

  /** Count how many rows fit within a given line budget, return the end index */
  function fitRows(rows: RowItem[], startIdx: number, budget: number): number {
    let idx = startIdx;
    let remaining = budget;
    while (idx < rows.length && remaining >= rows[idx]!.lines) {
      remaining -= rows[idx]!.lines;
      idx++;
    }
    // Ensure at least one row to avoid infinite loops
    if (idx === startIdx && startIdx < rows.length) idx = startIdx + 1;
    return idx;
  }

  /** Sum line units for a range of rows */
  function sumLines(rows: RowItem[], start: number, end: number): number {
    let total = 0;
    for (let i = start; i < end; i++) total += rows[i]!.lines;
    return total;
  }

  function userSectionHeader(
    user: ReportData['userDetails'][number],
    userIdx: number,
    chapterNumber: number,
  ): string {
    const color = CHART_COLORS[userIdx % CHART_COLORS.length];
    return `<div class="section-chapter">
  <div class="section-chapter-left">
    <div class="section-chapter-id">${chapterNum(chapterNumber)}</div>
    <div>
      <div class="section-chapter-name">${esc(user.userName)}</div>
      <div class="section-chapter-stats">${user.entryCount} entries &middot; ${user.daysActive} days active</div>
    </div>
  </div>
  <div class="section-chapter-hours">${formatHours(user.totalSeconds)}</div>
</div>
<div class="section-chapter-accent"></div>`;
  }

  if (data.userDetails.length > 0) {
    const user0 = data.userDetails[0]!;
    const user0Rows = collectUserRows(user0);

    ch01 += `<hr class="user-divider"/>`;
    ch01 += userSectionHeader(user0, 0, 2);

    // Fit what we can on the summary page (line-budget aware)
    const ch01End = fitRows(user0Rows, 0, V7_CH01_LINES);
    if (ch01End > 0) {
      ch01 += `<table class="entries-table">\n${V7_TABLE_HEAD}\n<tbody>\n${user0Rows
        .slice(0, ch01End)
        .map((r) => r.html)
        .join('\n')}\n</tbody></table>`;
    }
    contentPages.push(ch01);

    // Remaining rows for user 0 on continuation pages
    let rowIdx = ch01End;
    while (rowIdx < user0Rows.length) {
      const chunkEnd = fitRows(user0Rows, rowIdx, V7_PAGE_LINES);
      const chunkRows = user0Rows
        .slice(rowIdx, chunkEnd)
        .map((r) => r.html)
        .join('\n');
      contentPages.push(
        `<table class="entries-table">\n${V7_TABLE_HEAD}\n<tbody>\n${chunkRows}\n</tbody></table>`,
      );
      rowIdx = chunkEnd;
    }
  } else {
    contentPages.push(ch01);
  }

  // ── Subsequent user sections (each with pagination) ─────────────

  for (let ui = 1; ui < data.userDetails.length; ui++) {
    const user = data.userDetails[ui]!;
    const chapterNumber = ui + 2;
    const userRows = collectUserRows(user);
    const header = userSectionHeader(user, ui, chapterNumber);

    let rowIdx = 0;
    let isFirstChunk = true;
    while (rowIdx < userRows.length) {
      const budget = V7_PAGE_LINES - (isFirstChunk ? V7_HEADER_LINES : 0);
      const chunkEnd = fitRows(userRows, rowIdx, budget);
      const chunkRows = userRows
        .slice(rowIdx, chunkEnd)
        .map((r) => r.html)
        .join('\n');

      let pageHtml = '';
      if (isFirstChunk) pageHtml += header;
      pageHtml += `<table class="entries-table">\n${V7_TABLE_HEAD}\n<tbody>\n${chunkRows}\n</tbody></table>`;

      contentPages.push(pageHtml);
      rowIdx = chunkEnd;
      isFirstChunk = false;
    }

    if (userRows.length === 0) {
      contentPages.push(
        header + `<table class="entries-table">\n${V7_TABLE_HEAD}\n<tbody></tbody></table>`,
      );
    }
  }

  // ── Closing block on last page ──────────────────────────────────

  const lastIdx = contentPages.length - 1;
  contentPages[lastIdx] += renderClosingBlock(data);

  // ── Calculate page numbers ──────────────────────────────────────
  // Cover = page 1, TOC = page 2, then content pages start at 3
  const totalPages = 2 + contentPages.length;

  // Build TOC entries: chapter number → title → page
  // Cover = page 1, TOC = page 2, content starts at page 3
  // We need to track which contentPages index each user starts at
  const tocEntries: Array<{ num: string; title: string; page: number }> = [];
  tocEntries.push({ num: chapterNum(1), title: 'Executive Summary', page: 3 });
  tocEntries.push({ num: chapterNum(2), title: 'Team Composition', page: 3 });

  // Walk through contentPages to find where each user's first chunk starts
  // contentPages[0] is always ch01 (summary + first user start)
  // We need to find the start index for each user
  {
    let cpIdx = 0; // content page index
    for (let ui = 0; ui < data.userDetails.length; ui++) {
      const user = data.userDetails[ui]!;
      const chapNum = ui + 3;
      if (ui === 0) {
        // First user starts on page 3 (content page 0)
        tocEntries.push({ num: chapterNum(chapNum), title: user.userName, page: 3 });
        const userRows = collectUserRows(user);
        const ch01End = fitRows(userRows, 0, V7_CH01_LINES);
        cpIdx = 1; // ch01 is index 0, overflows start at 1
        let rowIdx = ch01End;
        while (rowIdx < userRows.length) {
          rowIdx = fitRows(userRows, rowIdx, V7_PAGE_LINES);
          cpIdx++;
        }
      } else {
        tocEntries.push({ num: chapterNum(chapNum), title: user.userName, page: 3 + cpIdx });
        const userRows = collectUserRows(user);
        let rowIdx = 0;
        let isFirst = true;
        let pageCount = 0;
        while (rowIdx < userRows.length) {
          const budget = V7_PAGE_LINES - (isFirst ? V7_HEADER_LINES : 0);
          rowIdx = fitRows(userRows, rowIdx, budget);
          pageCount++;
          isFirst = false;
        }
        if (userRows.length === 0) pageCount = 1;
        cpIdx += pageCount;
      }
    }
  }

  // ── Assemble pages ──────────────────────────────────────────────

  // Page 1: Cover (no header/footer)
  const coverHtml = renderCover(data);

  // Page 2: TOC
  const tocHtml = renderTocPage(tocEntries, data, totalPages);

  // Content pages (3+)
  const contentHtml = contentPages
    .map(
      (content, i) => `<div class="page">
  ${pageHeader()}
  <div class="page-content">${content}</div>
  ${pageFooter(data, 3 + i, totalPages)}
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
${coverHtml}
${tocHtml}
${contentHtml}
</body>
</html>`;
}

// ── TOC page renderer ────────────────────────────────────────────────────

function renderTocPage(
  entries: Array<{ num: string; title: string; page: number }>,
  data: ReportData,
  totalPages: number,
): string {
  const tocRows = entries
    .map(
      (e) => `<div class="toc-entry">
    <span class="toc-number">${e.num}</span>
    <span class="toc-label">${esc(e.title)}</span>
    <span class="toc-dots"></span>
    <span class="toc-page">${e.page}</span>
  </div>`,
    )
    .join('\n');

  return `<div class="page">
  ${pageHeader()}
  <div class="page-content">
    <h2 class="toc-title">Contents</h2>
    <hr class="toc-rule"/>
    ${tocRows}
  </div>
  ${pageFooter(data, 2, totalPages)}
</div>`;
}

// ── User section renderer ────────────────────────────────────────────────

function renderUserSection(
  user: ReportData['userDetails'][number],
  userIndex: number,
  chapterNumber: number,
): string {
  const color = CHART_COLORS[userIndex % CHART_COLORS.length];
  let html = '';

  // Section chapter heading
  html += `<div class="section-chapter">
  <div class="section-chapter-left">
    <div class="section-chapter-id">${chapterNum(chapterNumber)}</div>
    <div>
      <div class="section-chapter-name">${esc(user.userName)}</div>
      <div class="section-chapter-stats">${user.entryCount} entries &middot; ${user.daysActive} days active</div>
    </div>
  </div>
  <div class="section-chapter-hours">${formatHours(user.totalSeconds)}</div>
</div>
<div class="section-chapter-accent"></div>`;

  // Entries table
  html += `<table class="entries-table">
<thead><tr>
  <th style="width:70px">Time</th>
  <th style="width:120px">Project</th>
  <th>Description</th>
  <th style="width:60px">Jira</th>
  <th style="width:65px">Duration</th>
</tr></thead>
<tbody>`;

  for (const dg of user.dayGroups) {
    html += `<tr class="day-group-row">
  <td colspan="4"><strong>${esc(formatDate(dg.date))}</strong></td>
  <td class="duration-cell"><span class="day-total">${formatDuration(dg.dayTotalSeconds)}</span></td>
</tr>`;

    for (const entry of dg.entries) {
      html += `<tr>
  <td class="time-cell">${esc(entry.startTime)}</td>
  <td><div class="project-cell"><span class="project-dot" style="background: ${entry.projectColor}"></span>${esc(entry.projectName)}</div></td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td class="jira-cell" style="color: ${entry.jiraIssueKey ? '#6c8eef' : '#ccc'}">${entry.jiraIssueKey ? esc(entry.jiraIssueKey) : '—'}</td>
  <td class="duration-cell">${formatDuration(entry.durationSeconds)}</td>
</tr>`;
    }
  }

  html += `</tbody></table>`;

  return html;
}

// ── Closing block renderer ───────────────────────────────────────────────

function renderClosingBlock(data: ReportData): string {
  const period = formatDateRange(data.dateFrom, data.dateTo);
  const generated = formatGeneratedAt(data.generatedAt);
  const teamSize = data.summary.userCount;
  const totalHours = formatHours(data.summary.totalSeconds);

  return `<div class="closing-block">
  <hr class="closing-rule"/>
  <div class="closing-title">Report Generation Details</div>
  <div class="closing-details">
    <div><strong>Generated:</strong> ${esc(generated)}</div>
    <div><strong>Period:</strong> ${esc(period)}</div>
    <div><strong>Data source:</strong> Ternity Time Tracking</div>
    <div><strong>Team size:</strong> ${teamSize} member${teamSize !== 1 ? 's' : ''}</div>
    <div><strong>Total hours:</strong> ${totalHours}</div>
  </div>
  <div class="closing-watermark">${LOGO_SVG}</div>
</div>`;
}
