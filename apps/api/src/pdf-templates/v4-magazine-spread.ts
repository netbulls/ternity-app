/**
 * V4 — Magazine Spread
 * Editorial/magazine layout with bold typography, two-column hero grid,
 * donut chart, stacked horizontal bar, and compact inner-page detail sections.
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

/* ── Cover page ─────────────────────────────────────────────── */

.cover-top-bar {
  height: 3mm;
  background: #00D4AA;
}

.cover-masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6mm 20mm 4mm 20mm;
}
.cover-masthead-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cover-masthead-left svg { width: 24px; height: 30px; }
.cover-masthead-left .wordmark {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 3px;
  color: #0a0a0a;
  text-transform: uppercase;
}
.cover-masthead-right {
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 2px;
  color: #00D4AA;
  text-transform: uppercase;
}

/* Hero grid */
.hero-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 8mm;
  padding: 6mm 20mm 6mm 20mm;
}

.hero-left .hero-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: #0a0a0a;
  line-height: 1.2;
  margin-bottom: 4px;
}
.hero-left .hero-subtitle {
  font-size: 12px;
  color: #666;
  margin-bottom: 6mm;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4mm;
}
.stat-cell {
  background: #f7f8f9;
  border-radius: 6px;
  padding: 10px 14px;
}
.stat-cell .stat-label {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #999;
  margin-bottom: 2px;
}
.stat-cell .stat-value {
  font-family: 'Oxanium', sans-serif;
  font-size: 48px;
  font-weight: 700;
  color: #0a0a0a;
  line-height: 1.1;
}
.stat-cell .stat-detail {
  font-size: 8px;
  color: #999;
  margin-top: 2px;
}

/* Hero right — donut + legend */
.hero-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 2mm;
}
.donut-container { position: relative; }
.donut-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.donut-center .center-value {
  font-family: 'Oxanium', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #0a0a0a;
  line-height: 1.1;
}
.donut-center .center-label {
  font-size: 8px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.donut-legend {
  margin-top: 4mm;
  width: 100%;
}
.donut-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 9px;
}
.donut-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.donut-legend-name { flex: 1; color: #333; }
.donut-legend-pct { color: #999; min-width: 32px; text-align: right; }

/* Team performance section */
.team-section {
  padding: 0 20mm 4mm 20mm;
}
.team-section-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #333;
  margin-bottom: 4mm;
}

.stacked-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 4mm;
}
.stacked-bar-segment { height: 100%; min-width: 2px; }

.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9px;
}
.summary-table thead th {
  text-align: left;
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #999;
  padding: 4px 8px;
  border-bottom: 2px solid #e5e5e5;
}
.summary-table thead th:nth-child(n+3) { text-align: right; }
.summary-table tbody tr { border-bottom: 1px solid #f0f0f0; }
.summary-table tbody td { padding: 6px 8px; color: #333; }
.summary-table tbody td:nth-child(n+3) { text-align: right; }
.summary-table .member-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.summary-table .member-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.summary-table .hours-cell {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
}

/* Cover footer */
.cover-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4mm 20mm 8mm 20mm;
  border-top: 2px solid #00D4AA;
  text-align: center;
  font-size: 8px;
  color: #999;
}

/* ── Inner pages ────────────────────────────────────────────── */

.inner-stripe {
  height: 2px;
  background: #00D4AA;
}

.inner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4mm 20mm;
  border-bottom: 1px solid #e5e5e5;
}
.inner-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.inner-header-left svg { width: 16px; height: 20px; }
.inner-header-left .inner-brand {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 2px;
  color: #0a0a0a;
  text-transform: uppercase;
}
.inner-header-right {
  font-size: 9px;
  color: #666;
  text-align: right;
}

.inner-content {
  padding: 6mm 20mm 10mm 20mm;
}

/* User header row (inline in table) */
.user-header-row td {
  padding: 10px 8px 4px 8px !important;
  background: #f7f8f9 !important;
  border-bottom: 2px solid #e5e5e5 !important;
  position: relative;
}
.user-header-row td::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: #00D4AA;
}
.user-header-row .user-header-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #0a0a0a;
  flex-shrink: 0;
}
.user-meta { flex: 1; }
.user-meta .user-name {
  font-family: 'Oxanium', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #0a0a0a;
  letter-spacing: 0.5px;
}
.user-meta .user-stats {
  font-size: 9px;
  color: #999;
}
.user-total-block {
  text-align: right;
}
.user-total-block .total-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #00D4AA;
}
.user-total-block .total-label {
  font-size: 8px;
  color: #999;
}
.user-spacer-row td {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  height: 20px;
  border-top: 1px dashed #ddd !important;
}

/* Day groups & entries */
.entries-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9px;
}


.day-group-row td {
  padding: 6px 8px 4px 8px;
  border-bottom: 1px solid #e5e5e5;
}
.day-group-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.day-group-date {
  font-weight: 600;
  color: #333;
  font-size: 9px;
}
.day-group-total {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  color: #00D4AA;
  font-size: 9px;
}

.entries-table tbody tr { border-bottom: 1px solid #f0f0f0; }
.entries-table tbody td {
  padding: 4px 8px;
  vertical-align: top;
}
.time-cell { white-space: nowrap; color: #666; font-weight: 500; }
.project-cell-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}
.project-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.desc-cell { color: #333; max-width: 200px; }
.jira-pill {
  display: inline-block;
  background: #f0f1f3;
  color: #6c8eef;
  font-size: 8px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
}
.jira-empty { color: #ccc; font-size: 8px; }
.duration-cell {
  text-align: right;
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  white-space: nowrap;
}

/* User divider (between users on same page) */
.user-divider {
  border: none;
  border-top: 1px dashed #ddd;
  margin: 6mm 0;
}

/* Page footer (inner pages) */
.inner-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4mm 20mm 8mm 20mm;
  text-align: center;
  font-size: 8px;
  color: #999;
}
`;

// ── Helpers ──────────────────────────────────────────────────────────────

function coverFooterText(data: ReportData): string {
  return `Ternity &middot; ${esc(formatDateRange(data.dateFrom, data.dateTo))}`;
}

function innerFooterText(data: ReportData, pageNum: number, totalPages: number): string {
  return `Ternity &middot; ${esc(formatDateRange(data.dateFrom, data.dateTo))} &middot; Page ${pageNum} of ${totalPages}`;
}

/** Month + Year title from dateFrom */
function monthYearTitle(dateFrom: string): string {
  const d = new Date(dateFrom + 'T12:00:00Z');
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const year = d.getFullYear();
  return `${month} ${year}`;
}

/** Generate stacked horizontal bar segments */
function generateStackedBar(data: ReportData): string {
  const segments = data.userBreakdown
    .map((u, i) => {
      const color = CHART_COLORS[i % CHART_COLORS.length];
      const width = Math.max(u.percentage, 0.5); // minimum visible width
      return `<div class="stacked-bar-segment" style="width: ${width}%; background: ${color}"></div>`;
    })
    .join('');
  return `<div class="stacked-bar">${segments}</div>`;
}

// ── Main render ──────────────────────────────────────────────────────────

export function renderV4(
  data: ReportData,
  options?: import('./index.js').TemplateRenderOptions,
): string {
  const showTime = options?.showStartTime ?? false;
  // Collect pages, assemble at end when totalPages known
  const pages: Array<{ type: 'cover' | 'inner'; html: string }> = [];

  // ── Page 1: Cover Spread ───────────────────────────────────────

  let cover = '';

  // Top bar
  cover += `<div class="cover-top-bar"></div>`;

  // Masthead
  cover += `<div class="cover-masthead">
  <div class="cover-masthead-left">
    ${LOGO_SVG}
    <span class="wordmark">Ternity</span>
  </div>
  <div class="cover-masthead-right">Time Report</div>
</div>`;

  // Hero grid
  const avgPerDay =
    data.summary.workingDays > 0
      ? formatHours(data.summary.totalSeconds / data.summary.workingDays)
      : '—';
  const avgPerPerson =
    data.summary.userCount > 0
      ? formatHours(data.summary.totalSeconds / data.summary.userCount)
      : '—';

  // Donut chart (150px, donut type)
  const donutChart = generatePieChart(data, { size: 150, strokeWidth: 18, type: 'donut' });

  const legendItems = data.userBreakdown
    .map(
      (u, i) =>
        `<div class="donut-legend-item">
      <div class="donut-legend-dot" style="background: ${CHART_COLORS[i % CHART_COLORS.length]}"></div>
      <span class="donut-legend-name">${esc(u.userName)}</span>
      <span class="donut-legend-pct">${u.percentage}%</span>
    </div>`,
    )
    .join('\n');

  cover += `<div class="hero-grid">
  <div class="hero-left">
    <div class="hero-title">${esc(monthYearTitle(data.dateFrom))}</div>
    <div class="hero-subtitle">${esc(formatDateRange(data.dateFrom, data.dateTo))} &middot; ${data.summary.userCount} team member${data.summary.userCount !== 1 ? 's' : ''}</div>
    <div class="stat-grid">
      <div class="stat-cell">
        <div class="stat-label">Total Hours</div>
        <div class="stat-value">${formatHours(data.summary.totalSeconds)}</div>
        <div class="stat-detail">${data.summary.totalEntries} entries</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Working Days</div>
        <div class="stat-value">${data.summary.workingDays}</div>
        <div class="stat-detail">${avgPerDay} avg / day</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Team Members</div>
        <div class="stat-value">${data.summary.userCount}</div>
        <div class="stat-detail">${avgPerPerson} avg / person</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Projects</div>
        <div class="stat-value">${data.summary.projectCount}</div>
        <div class="stat-detail">${data.projectBreakdown.length} tracked</div>
      </div>
    </div>
  </div>
  <div class="hero-right">
    <div class="donut-container">
      ${donutChart}
      <div class="donut-center">
        <div class="center-value">${formatHours(data.summary.totalSeconds)}</div>
        <div class="center-label">Total</div>
      </div>
    </div>
    <div class="donut-legend">
      ${legendItems}
    </div>
  </div>
</div>`;

  // Team Performance section — split to a second cover page if many users
  const teamPerformanceHtml = `<div class="team-section">
  <div class="team-section-title">Team Performance</div>
  ${generateStackedBar(data)}
  <table class="summary-table">
    <thead>
      <tr>
        <th>Member</th>
        <th>Hours</th>
        <th>Share</th>
        <th>Entries</th>
      </tr>
    </thead>
    <tbody>
      ${data.userBreakdown
        .map(
          (u, i) =>
            `<tr>
        <td><div class="member-cell"><span class="member-dot" style="background: ${CHART_COLORS[i % CHART_COLORS.length]}"></span>${esc(u.userName)}</div></td>
        <td class="hours-cell">${formatHours(u.totalSeconds)}</td>
        <td>${u.percentage}%</td>
        <td>${u.entryCount}</td>
      </tr>`,
        )
        .join('\n')}
    </tbody>
  </table>
</div>`;

  // With ≤10 users, everything fits on one cover page.
  // With >10, the hero grid + donut legend + team table overflows A4.
  const V4_COVER_USER_THRESHOLD = 10;
  if (data.userBreakdown.length <= V4_COVER_USER_THRESHOLD) {
    cover += teamPerformanceHtml;
    pages.push({ type: 'cover', html: cover });
  } else {
    pages.push({ type: 'cover', html: cover });
    // Second page uses inner layout so it gets proper header/footer
    pages.push({ type: 'inner', html: teamPerformanceHtml });
  }

  // ── Build all data rows as HTML ──────────────────────────────────
  const COLGROUP = showTime
    ? `<colgroup><col style="width:55px"><col style="width:110px"><col><col style="width:70px"><col style="width:60px"></colgroup>`
    : `<colgroup><col style="width:110px"><col><col style="width:70px"><col style="width:60px"></colgroup>`;

  const allRowsHtml: string[] = [];

  for (let ui = 0; ui < data.userDetails.length; ui++) {
    const user = data.userDetails[ui]!;
    const color = CHART_COLORS[ui % CHART_COLORS.length];
    if (ui > 0) {
      const colCount = showTime ? 5 : 4;
      allRowsHtml.push(`<tr class="user-spacer-row"><td colspan="${colCount}"></td></tr>`);
    }

    allRowsHtml.push(`<tr class="user-header-row" data-sticky>
  <td colspan="${showTime ? 5 : 4}"><div class="user-header-inner">
    <div class="user-avatar" style="background: ${color}">${esc(initials(user.userName))}</div>
    <div class="user-meta">
      <div class="user-name">${esc(user.userName)}</div>
      <div class="user-stats">${user.entryCount} entries &middot; ${user.daysActive} days active</div>
    </div>
    <div class="user-total-block">
      <div class="total-hours">${formatHours(user.totalSeconds)}</div>
      <div class="total-label">Total Hours</div>
    </div>
  </div></td>
</tr>`);

    for (const dg of user.dayGroups) {
      allRowsHtml.push(`<tr class="day-group-row" data-sticky>
  <td colspan="${showTime ? 5 : 4}"><div class="day-group-inner"><span class="day-group-date">${esc(formatDate(dg.date))}</span><span class="day-group-total">${formatDuration(dg.dayTotalSeconds)}</span></div></td>
</tr>`);

      for (const entry of dg.entries) {
        const jiraCell = entry.jiraIssueKey
          ? `<span class="jira-pill">${esc(entry.jiraIssueKey)}</span>`
          : `<span class="jira-empty">&mdash;</span>`;
        allRowsHtml.push(`<tr>
  ${showTime ? `<td class="time-cell">${esc(entry.startTime)}</td>` : ''}
  <td><div class="project-cell-inner"><span class="project-dot" style="background: ${entry.projectColor}"></span>${esc(entry.projectName)}</div></td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td>${jiraCell}</td>
  <td class="duration-cell">${formatDuration(entry.durationSeconds)}</td>
</tr>`);
      }
    }
  }

  // ── Assemble static pages (cover + optional team perf) ─────────
  const staticPagesHtml = pages
    .map((p, i) => {
      const pageNum = i + 1;
      if (p.type === 'cover') {
        return `<div class="page" id="page-${pageNum}">
  ${p.html}
  <div class="cover-footer"><span class="page-number">${coverFooterText(data)} &middot; Page ${pageNum} of 0</span></div>
</div>`;
      }
      return `<div class="page" id="page-${pageNum}">
  <div class="inner-stripe"></div>
  <div class="inner-header">
    <div class="inner-header-left">
      ${LOGO_SVG}
      <span class="inner-brand">Ternity</span>
    </div>
    <div class="inner-header-right">${esc(formatDateRange(data.dateFrom, data.dateTo))}</div>
  </div>
  <div class="inner-content">${p.html}</div>
  <div class="inner-footer"><span class="page-number">${innerFooterText(data, pageNum, 0)}</span></div>
</div>`;
    })
    .join('\n');

  const staticPageCount = pages.length;

  // ── Measurement container ───────────────────────────────────────
  const measureHtml = `<div id="measure-container" style="position:absolute;left:0;top:0;width:210mm;visibility:hidden">
  <div class="inner-stripe"></div>
  <div class="inner-header">
    <div class="inner-header-left">
      ${LOGO_SVG}
      <span class="inner-brand">Ternity</span>
    </div>
    <div class="inner-header-right">${esc(formatDateRange(data.dateFrom, data.dateTo))}</div>
  </div>
  <div class="inner-content">
    <table class="entries-table">${COLGROUP}<tbody>
      ${allRowsHtml.join('\n')}
    </tbody></table>
  </div>
</div>`;

  const innerHeaderTpl = `<template id="tpl-inner-header">
  <div class="inner-stripe"></div>
  <div class="inner-header">
    <div class="inner-header-left">
      ${LOGO_SVG}
      <span class="inner-brand">Ternity</span>
    </div>
    <div class="inner-header-right">${esc(formatDateRange(data.dateFrom, data.dateTo))}</div>
  </div>
</template>`;

  const innerFooterTpl = `<template id="tpl-inner-footer">
  <div class="inner-footer"><span class="page-number"></span></div>
</template>`;

  const paginationScript = `<script>
(function() {
  var staticPageCount = ${staticPageCount};

  // Measure available height
  var tmpPage = document.createElement('div');
  tmpPage.className = 'page';
  tmpPage.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;height:297mm';
  var hdr = document.getElementById('tpl-inner-header').content.cloneNode(true);
  var ftr = document.getElementById('tpl-inner-footer').content.cloneNode(true);
  var tmpContent = document.createElement('div');
  tmpContent.className = 'inner-content';
  var marker = document.createElement('div');
  marker.style.cssText = 'width:1px;height:1px';
  tmpContent.appendChild(marker);
  tmpPage.appendChild(hdr);
  tmpPage.appendChild(tmpContent);
  tmpPage.appendChild(ftr);
  document.body.appendChild(tmpPage);
  var footerEl = tmpPage.querySelector('.inner-footer');
  var contentRect = tmpContent.getBoundingClientRect();
  var footerRect = footerEl.getBoundingClientRect();
  var cs = window.getComputedStyle(tmpContent);
  var cPadTop = parseFloat(cs.paddingTop);
  var cPadBottom = parseFloat(cs.paddingBottom);
  var availableH = footerRect.top - contentRect.top - cPadTop - cPadBottom - 3;
  document.body.removeChild(tmpPage);

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

  var dataPages = [];
  var idx = 0;
  while (idx < heights.length) {
    var pageRows = [];
    var usedH = 0;
    while (idx < heights.length) {
      var rowH = heights[idx].h;
      if (usedH + rowH > availableH) break;
      pageRows.push(heights[idx]);
      usedH += rowH;
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

  var totalPages = staticPageCount + dataPages.length;

  // Fix static page footers
  for (var s = 0; s < staticPageCount; s++) {
    var el = document.querySelector('#page-' + (s+1) + ' .page-number');
    if (el) el.textContent = el.textContent.replace(/of 0/, 'of ' + totalPages);
  }

  var colgroup = '${COLGROUP.replace(/'/g, "\\'")}';

  for (var p = 0; p < dataPages.length; p++) {
    var pageNum = staticPageCount + p + 1;
    var pageDiv = document.createElement('div');
    pageDiv.className = 'page';

    var hdrClone = document.getElementById('tpl-inner-header').content.cloneNode(true);
    pageDiv.appendChild(hdrClone);

    var contentDiv = document.createElement('div');
    contentDiv.className = 'inner-content';
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
    pageDiv.appendChild(contentDiv);

    var ftrClone = document.getElementById('tpl-inner-footer').content.cloneNode(true);
    ftrClone.querySelector('.page-number').textContent = 'Ternity \\u00b7 ${esc(formatDateRange(data.dateFrom, data.dateTo))} \\u00b7 Page ' + pageNum + ' of ' + totalPages;
    pageDiv.appendChild(ftrClone);

    document.body.appendChild(pageDiv);
  }

  document.getElementById('tpl-inner-header').remove();
  document.getElementById('tpl-inner-footer').remove();
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
${staticPagesHtml}
${measureHtml}
${innerHeaderTpl}
${innerFooterTpl}
${paginationScript}
</body>
</html>`;
}
