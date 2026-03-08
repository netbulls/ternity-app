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

.page-content { padding: 4mm 20mm 10mm 20mm; }

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
}
/* Section chapter as table row for continuous flow */
.section-chapter-row td {
  padding: 10px 8px 4px 8px !important;
  border-bottom: none !important;
  background: #fff !important;
}
.user-spacer-row td {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  height: 20px;
  border-top: 1px solid #e5e5e5 !important;
}
.section-chapter-accent-row td {
  padding: 0 !important;
  border-bottom: none !important;
}
.section-chapter-accent-row .section-chapter-accent-line {
  width: 100%;
  height: 2px;
  background: #00D4AA;
  margin-bottom: 2mm;
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
  font-size: 9px;
}



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

export function renderV7(
  data: ReportData,
  options?: import('./index.js').TemplateRenderOptions,
): string {
  const showTime = options?.showStartTime ?? false;
  // Numbered chapters: 01 = Executive Summary, then one per user (02, 03, ...)
  // Cover = page 1, TOC = page 2, content starts on page 3.
  // TOC page numbers are updated by script after pagination.

  const COLGROUP = showTime
    ? `<colgroup><col style="width:70px"><col style="width:120px"><col><col style="width:60px"><col style="width:65px"></colgroup>`
    : `<colgroup><col style="width:120px"><col><col style="width:60px"><col style="width:65px"></colgroup>`;

  // ── Chapter 01: Executive Summary ──────────────────────────────
  const avgPerDay =
    data.summary.workingDays > 0
      ? formatHours(data.summary.totalSeconds / data.summary.workingDays)
      : '\u2014';
  const avgPerPerson =
    data.summary.userCount > 0
      ? formatHours(data.summary.totalSeconds / data.summary.userCount)
      : '\u2014';

  let ch01Content = `<div class="chapter-heading">
  <div class="chapter-number">${chapterNum(1)}</div>
  <div class="chapter-title">Executive Summary</div>
  <div class="chapter-accent"></div>
</div>
<div class="metrics-grid">
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

  ch01Content += `<div class="chart-section">
  <div class="chart-container">${pieChart}</div>
  <div class="chart-legend">
    <h3>Team Composition</h3>
    ${legendItems}
  </div>
</div>`;

  // Exec summary page (page 3) — metrics and chart only, no user entries
  const execSummaryPage = `<div class="page" id="page-3">
  ${pageHeader()}
  <div class="page-content">${ch01Content}</div>
  ${pageFooter(data, 3, 0)}
</div>`;

  // ── Build all data rows ────────────────────────────────────────
  // ALL rows for ALL users go into the measure container.
  const allRowsHtml: string[] = [];
  const colCount = showTime ? 5 : 4;

  for (let ui = 0; ui < data.userDetails.length; ui++) {
    const user = data.userDetails[ui]!;
    const chapterNumber = ui + 2;

    // Spacer row between users (not before first)
    if (ui > 0) {
      allRowsHtml.push(`<tr class="user-spacer-row"><td colspan="${colCount}"></td></tr>`);
    }

    // User section header
    allRowsHtml.push(`<tr class="section-chapter-row" data-sticky data-user="${esc(user.userName)}">
  <td colspan="${colCount}"><div class="section-chapter">
    <div class="section-chapter-left">
      <div class="section-chapter-id">${chapterNum(chapterNumber)}</div>
      <div>
        <div class="section-chapter-name">${esc(user.userName)}</div>
        <div class="section-chapter-stats">${user.entryCount} entries &middot; ${user.daysActive} days active</div>
      </div>
    </div>
    <div class="section-chapter-hours">${formatHours(user.totalSeconds)}</div>
  </div></td>
</tr>
<tr class="section-chapter-accent-row"><td colspan="${colCount}"><div class="section-chapter-accent-line"></div></td></tr>`);

    // Day groups + entries
    for (const dg of user.dayGroups) {
      allRowsHtml.push(`<tr class="day-group-row" data-sticky>
  <td colspan="${showTime ? 4 : 3}"><strong>${esc(formatDate(dg.date))}</strong></td>
  <td class="duration-cell"><span class="day-total">${formatDuration(dg.dayTotalSeconds)}</span></td>
</tr>`);

      for (const entry of dg.entries) {
        allRowsHtml.push(`<tr>
  ${showTime ? `<td class="time-cell">${esc(entry.startTime)}</td>` : ''}
  <td><div class="project-cell"><span class="project-dot" style="background: ${entry.projectColor}"></span>${esc(entry.projectName)}</div></td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td class="jira-cell" style="color: ${entry.jiraIssueKey ? '#6c8eef' : '#ccc'}">${entry.jiraIssueKey ? esc(entry.jiraIssueKey) : '\u2014'}</td>
  <td class="duration-cell">${formatDuration(entry.durationSeconds)}</td>
</tr>`);
      }
    }
  }

  // ── Measure container ──────────────────────────────────────────
  const measureHtml = `<div id="measure-container" style="position:absolute;left:0;top:0;width:210mm;visibility:hidden">
  <div class="page" style="height:auto;min-height:0">
    <div class="page-content">
      <table class="entries-table">${COLGROUP}<tbody>
        ${allRowsHtml.join('\n')}
      </tbody></table>
    </div>
  </div>
</div>`;

  // ── Static pages ───────────────────────────────────────────────
  const coverHtml = renderCover(data);

  // TOC page with placeholder page numbers (script updates them)
  let tocRows = '';
  tocRows += `<div class="toc-entry">
    <span class="toc-number">${chapterNum(1)}</span>
    <span class="toc-label">Executive Summary</span>
    <span class="toc-dots"></span>
    <span class="toc-page">3</span>
  </div>`;
  // All user entries get dynamic page numbers resolved by script
  for (let ui = 0; ui < data.userDetails.length; ui++) {
    tocRows += `<div class="toc-entry" data-toc-user="${esc(data.userDetails[ui]!.userName)}">
    <span class="toc-number">${chapterNum(ui + 2)}</span>
    <span class="toc-label">${esc(data.userDetails[ui]!.userName)}</span>
    <span class="toc-dots"></span>
    <span class="toc-page">0</span>
  </div>`;
  }

  const tocPageHtml = `<div class="page" id="page-2">
  ${pageHeader()}
  <div class="page-content">
    <h2 class="toc-title">Contents</h2>
    <hr class="toc-rule"/>
    ${tocRows}
  </div>
  ${pageFooter(data, 2, 0)}
</div>`;

  // ── Templates ──────────────────────────────────────────────────
  const headerTpl = `<template id="tpl-header">${pageHeader()}</template>`;
  const footerTpl = `<template id="tpl-footer">${pageFooter(data, 0, 0)}</template>`;
  const closingTpl = `<template id="tpl-closing">${renderClosingBlock(data)}</template>`;

  const colgroup = COLGROUP.replace(/"/g, '\\"');

  const paginationScript = `<script>
(function() {
  // ── Measure available height for data pages ──────────────────
  var tmpPage = document.createElement('div');
  tmpPage.className = 'page';
  tmpPage.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;height:297mm';
  var hdr = document.getElementById('tpl-header').content.cloneNode(true);
  tmpPage.appendChild(hdr);
  var tmpContent = document.createElement('div');
  tmpContent.className = 'page-content';
  var marker = document.createElement('div');
  marker.style.cssText = 'width:1px;height:1px';
  tmpContent.appendChild(marker);
  var ftr = document.getElementById('tpl-footer').content.cloneNode(true);
  tmpPage.appendChild(tmpContent);
  tmpPage.appendChild(ftr);
  document.body.appendChild(tmpPage);
  var cStyle = window.getComputedStyle(tmpContent);
  var cRect = tmpContent.getBoundingClientRect();
  var fRect = tmpPage.querySelector('.page-footer').getBoundingClientRect();
  var availableH = fRect.top - cRect.top - parseFloat(cStyle.paddingTop) - parseFloat(cStyle.paddingBottom) - 3;
  document.body.removeChild(tmpPage);

  // ── Measure rows ─────────────────────────────────────────────
  var container = document.getElementById('measure-container');
  var rows = container.querySelectorAll('tbody > tr');
  var heights = [];
  for (var i = 0; i < rows.length; i++) {
    heights.push({
      el: rows[i],
      h: rows[i].offsetHeight,
      sticky: rows[i].hasAttribute('data-sticky')
    });
  }
  container.remove();

  // ── Distribute rows into pages ───────────────────────────────
  var dataPages = [];
  var idx = 0;
  while (idx < heights.length) {
    var pageRows = [];
    var usedH = 0;
    while (idx < heights.length) {
      if (usedH + heights[idx].h > availableH) break;
      pageRows.push(heights[idx]);
      usedH += heights[idx].h;
      idx++;
    }
    if (pageRows.length === 0 && idx < heights.length) {
      pageRows.push(heights[idx]);
      idx++;
    }
    while (pageRows.length > 1 && pageRows[pageRows.length - 1].sticky) {
      idx--;
      pageRows.pop();
    }
    dataPages.push(pageRows);
  }

  // totalPages = cover + TOC + exec summary + data pages
  var totalPages = 3 + dataPages.length;

  // Fix exec summary (page 3) footer
  var p3FooterPN = document.querySelector('#page-3 .page-number');
  if (p3FooterPN) p3FooterPN.textContent = 'Page 3';

  // Fix TOC (page 2) footer
  var p2PN = document.querySelector('#page-2 .page-number');
  if (p2PN) p2PN.textContent = 'Page 2';

  // ── Build data pages (starting at page 4) ────────────────────
  var colgroup = "${colgroup}";
  for (var p = 0; p < dataPages.length; p++) {
    var pageNum = 4 + p;
    var pageDiv = document.createElement('div');
    pageDiv.className = 'page';

    var hdrClone = document.getElementById('tpl-header').content.cloneNode(true);
    pageDiv.appendChild(hdrClone);

    var contentDiv = document.createElement('div');
    contentDiv.className = 'page-content';
    var table = document.createElement('table');
    table.className = 'entries-table';
    table.innerHTML = colgroup;
    var tbody = document.createElement('tbody');
    for (var r = 0; r < dataPages[p].length; r++) {
      // Skip spacer row at start of a new page
      if (r === 0 && dataPages[p][r].el.classList.contains('user-spacer-row')) continue;
      tbody.appendChild(dataPages[p][r].el);
    }
    table.appendChild(tbody);
    contentDiv.appendChild(table);

    // Closing block on last page
    if (p === dataPages.length - 1) {
      var closing = document.getElementById('tpl-closing').content.cloneNode(true);
      contentDiv.appendChild(closing);
    }

    pageDiv.appendChild(contentDiv);

    var ftrClone = document.getElementById('tpl-footer').content.cloneNode(true);
    ftrClone.querySelector('.page-number').textContent = 'Page ' + pageNum;
    pageDiv.appendChild(ftrClone);

    document.body.appendChild(pageDiv);
  }

  // If no data rows at all, add closing block to exec page
  if (dataPages.length === 0) {
    var closingEl = document.getElementById('tpl-closing').content.cloneNode(true);
    document.querySelector('#page-3 .page-content').appendChild(closingEl);
  }

  // ── Update TOC page numbers ──────────────────────────────────
  // Find which page each user section header landed on
  var tocUserEntries = document.querySelectorAll('[data-toc-user]');
  for (var t = 0; t < tocUserEntries.length; t++) {
    var userName = tocUserEntries[t].getAttribute('data-toc-user');
    var tocPageSpan = tocUserEntries[t].querySelector('.toc-page');
    // Search all pages for the user's section-chapter-name
    var allPages = document.querySelectorAll('.page');
    for (var pg = 0; pg < allPages.length; pg++) {
      var nameEl = allPages[pg].querySelector('[data-user="' + userName + '"]');
      if (nameEl) {
        // Page index: cover=0, toc=1, page3=2, ...
        tocPageSpan.textContent = String(pg + 1);
        break;
      }
    }
  }

  // Cleanup templates
  document.getElementById('tpl-header').remove();
  document.getElementById('tpl-footer').remove();
  document.getElementById('tpl-closing').remove();
})();
</script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
${FONTS_LINK}
<style>${CSS}</style>
</head>
<body>
${coverHtml}
${tocPageHtml}
${execSummaryPage}
${measureHtml}
${headerTpl}
${footerTpl}
${closingTpl}
${paginationScript}
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
