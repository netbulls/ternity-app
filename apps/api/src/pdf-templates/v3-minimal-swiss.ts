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

.page-inner { padding: 20mm 25mm 14mm 25mm; }

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

.user-section { margin-bottom: 0; }
[data-row] { overflow: hidden; } /* contain child margins for accurate measurement */

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 2mm;
  border-bottom: 1px solid #1a1a1a;
  margin-bottom: 4mm;
}
.user-header.has-divider { padding-top: 6mm; border-top: 0.5px solid #ccc; }
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

  // ── Build all data rows as HTML ──────────────────────────────────
  // Each row is wrapped in a <div data-row> for measurement.
  // Sticky rows (user headers, day headers) get data-sticky.
  const allRowsHtml: string[] = [];

  for (let ui = 0; ui < data.userDetails.length; ui++) {
    const user = data.userDetails[ui]!;
    const dividerCls = ui > 0 ? ' has-divider' : '';

    // User section header — sticky
    allRowsHtml.push(`<div data-row data-sticky>
  <div class="user-header${dividerCls}">
    <span class="user-name">${esc(user.userName)}</span>
    <span class="user-hours">${formatHours(user.totalSeconds)}</span>
  </div>
  <div class="user-stats">${user.entryCount} entries &middot; ${user.daysActive} days active</div>
</div>`);

    for (const dg of user.dayGroups) {
      // Day group header — sticky
      allRowsHtml.push(`<div data-row data-sticky>
  <div class="day-header">
    <span class="day-label">${esc(formatDate(dg.date))}</span>
    <span class="day-total">${formatDuration(dg.dayTotalSeconds)}</span>
  </div>
</div>`);

      for (const entry of dg.entries) {
        const jiraHtml = entry.jiraIssueKey
          ? `<div class="entry-jira">${esc(entry.jiraIssueKey)}</div>`
          : `<div class="entry-jira empty">&mdash;</div>`;
        allRowsHtml.push(`<div data-row>
  <div class="entry-row">
    <div class="entry-project"><span class="entry-dot" style="background: ${entry.projectColor}"></span><span class="entry-project-name">${esc(entry.projectName)}</span></div>
    <div class="entry-desc">${esc(entry.description)}</div>
    ${jiraHtml}
    <div class="entry-duration">${formatDuration(entry.durationSeconds)}</div>
  </div>
</div>`);
      }
    }
  }

  // ── Page 1 (cover) assembled statically ─────────────────────────
  const page1Html = `<div class="page" id="page-1">
  <div class="page-inner">${cover}</div>
  ${pageFooter(1)}
</div>`;

  // ── Measurement container ───────────────────────────────────────
  const measureHtml = `<div id="measure-container" style="position:absolute;left:0;top:0;width:210mm;visibility:hidden">
  <div class="page-inner">${contHeader(data)}<div class="user-section">
    ${allRowsHtml.join('\n')}
  </div></div>
</div>`;

  // Header/footer templates
  const contHeaderHtml = contHeader(data);
  const headerTpl = `<template id="tpl-header">${contHeaderHtml}</template>`;
  const footerTpl = `<template id="tpl-footer"><div class="page-footer">
  <hr class="page-footer-rule"/>
  <div class="page-footer-text"></div>
</div></template>`;

  const paginationScript = `<script>
(function() {
  // Measure available height
  var tmpPage = document.createElement('div');
  tmpPage.className = 'page';
  tmpPage.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;height:297mm';
  var tmpInner = document.createElement('div');
  tmpInner.className = 'page-inner';
  // Clone cont-header to get its real height
  var hdrClone = document.getElementById('tpl-header').content.cloneNode(true);
  tmpInner.appendChild(hdrClone);
  var marker = document.createElement('div');
  marker.style.cssText = 'width:1px;height:1px';
  tmpInner.appendChild(marker);
  var ftrClone = document.getElementById('tpl-footer').content.cloneNode(true);
  tmpPage.appendChild(tmpInner);
  tmpPage.appendChild(ftrClone);
  document.body.appendChild(tmpPage);

  var footerEl = tmpPage.querySelector('.page-footer');
  var innerRect = tmpInner.getBoundingClientRect();
  var footerRect = footerEl.getBoundingClientRect();
  var innerStyle = window.getComputedStyle(tmpInner);
  var iPadTop = parseFloat(innerStyle.paddingTop);
  var iPadBottom = parseFloat(innerStyle.paddingBottom);
  // Available = from after cont-header to footer top, minus bottom padding
  // But we need to subtract the cont-header height from inner
  var contHdrEl = tmpInner.querySelector('.cont-header');
  var contHdrH = contHdrEl ? contHdrEl.offsetHeight + parseFloat(window.getComputedStyle(contHdrEl).marginBottom) : 0;
  var availableH = footerRect.top - innerRect.top - iPadTop - iPadBottom - contHdrH - 3;
  document.body.removeChild(tmpPage);

  // Measure rows
  var container = document.getElementById('measure-container');
  var rows = container.querySelectorAll('[data-row]');
  var heights = [];
  for (var i = 0; i < rows.length; i++) {
    heights.push({
      el: rows[i],
      h: rows[i].offsetHeight,
      sticky: rows[i].hasAttribute('data-sticky')
    });
  }
  container.remove();

  // Build pages
  var dataPages = [];
  var idx = 0;
  while (idx < heights.length) {
    var pageRows = [];
    var usedH = 0;
    while (idx < heights.length) {
      var rowH = heights[idx].h;
      if (usedH + rowH > availableH && pageRows.length > 0) break;
      pageRows.push(heights[idx]);
      usedH += rowH;
      idx++;
    }
    while (pageRows.length > 1 && pageRows[pageRows.length - 1].sticky) {
      idx--;
      pageRows.pop();
    }
    dataPages.push(pageRows);
  }

  var totalPages = 1 + dataPages.length;

  // Fix page 1 footer
  var p1Ftr = document.querySelector('#page-1 .page-footer-text');
  if (p1Ftr) p1Ftr.textContent = 'Page 1 of ' + totalPages;

  // Build page divs
  for (var p = 0; p < dataPages.length; p++) {
    var pageNum = p + 2;
    var pageDiv = document.createElement('div');
    pageDiv.className = 'page';

    var innerDiv = document.createElement('div');
    innerDiv.className = 'page-inner';

    // Cont header
    var hdr = document.getElementById('tpl-header').content.cloneNode(true);
    innerDiv.appendChild(hdr);

    // User section wrapper
    var section = document.createElement('div');
    section.className = 'user-section';
    for (var r = 0; r < dataPages[p].length; r++) {
      // Strip divider from first row on page
      if (r === 0) {
        var hdrEl = dataPages[p][r].el.querySelector('.user-header');
        if (hdrEl) hdrEl.classList.remove('has-divider');
      }
      section.appendChild(dataPages[p][r].el);
    }
    innerDiv.appendChild(section);
    pageDiv.appendChild(innerDiv);

    // Footer
    var ftr = document.getElementById('tpl-footer').content.cloneNode(true);
    ftr.querySelector('.page-footer-text').textContent = 'Page ' + pageNum + ' of ' + totalPages;
    pageDiv.appendChild(ftr);

    document.body.appendChild(pageDiv);
  }

  document.getElementById('tpl-header').remove();
  document.getElementById('tpl-footer').remove();
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
${page1Html}
${measureHtml}
${headerTpl}
${footerTpl}
${paginationScript}
</body>
</html>`;
}
