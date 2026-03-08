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

.page-content { padding: 8mm 20mm 10mm 20mm; }

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

.section-header-row td {
  padding: 10px 8px 4px 8px !important;
  border-bottom: 2px solid #222 !important;
  background: #111 !important;
}
.section-header-row .section-header-inner {
  display: flex; align-items: center; gap: 12px;
}
.section-header-row .user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 13px; color: #0a0a0a;
  flex-shrink: 0;
}
.section-header-row .user-info h2 {
  font-family: 'Oxanium', sans-serif;
  font-size: 14px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;
}
.section-header-row .user-info .user-stats { font-size: 9px; color: rgba(255,255,255,0.5); }
.section-header-row .user-total { margin-left: auto; text-align: right; }
.section-header-row .user-total .total-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 18px; font-weight: 700; color: #00D4AA;
}
.section-header-row .user-total .total-label {
  font-size: 8px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px;
}
.section-header-row.has-divider td { padding-top: 24px !important; border-top: 1px solid #222; }

.entries-table {
  width: 100%; border-collapse: collapse;
  font-size: 9px;
}

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

export function renderV2(
  data: ReportData,
  options?: import('./index.js').TemplateRenderOptions,
): string {
  const showTime = options?.showStartTime ?? false;
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

  // ── Build all data rows as HTML ──────────────────────────────────
  const COLGROUP = showTime
    ? `<colgroup><col style="width:70px"><col style="width:120px"><col><col style="width:60px"><col style="width:65px"></colgroup>`
    : `<colgroup><col style="width:120px"><col><col style="width:60px"><col style="width:65px"></colgroup>`;

  const allRowsHtml: string[] = [];

  for (let ui = 0; ui < data.userDetails.length; ui++) {
    const user = data.userDetails[ui]!;
    const color = CHART_COLORS[ui % CHART_COLORS.length];
    const dividerCls = ui > 0 ? ' has-divider' : '';

    // User section header — sticky (must not be last on a page)
    allRowsHtml.push(`<tr class="section-header-row${dividerCls}" data-sticky>
  <td colspan="5"><div class="section-header-inner">
    <div class="user-avatar" style="background: ${color}">${esc(initials(user.userName))}</div>
    <div class="user-info">
      <h2>${esc(user.userName)}</h2>
      <div class="user-stats">${user.entryCount} entries &middot; ${user.daysActive} days active</div>
    </div>
    <div class="user-total">
      <div class="total-hours">${formatHours(user.totalSeconds)}</div>
      <div class="total-label">Total Hours</div>
    </div>
  </div></td>
</tr>`);

    for (const dg of user.dayGroups) {
      // Day group header — sticky
      allRowsHtml.push(`<tr class="day-group-row" data-sticky>
  <td colspan="${showTime ? 4 : 3}"><strong>${esc(formatDate(dg.date))}</strong></td>
  <td class="duration-cell"><span class="day-total">${formatDuration(dg.dayTotalSeconds)}</span></td>
</tr>`);

      for (const entry of dg.entries) {
        allRowsHtml.push(`<tr>
  ${showTime ? `<td class="date-cell">${esc(entry.startTime)}</td>` : ''}
  <td><div class="project-cell"><span class="project-dot" style="background: ${entry.projectColor}"></span>${esc(entry.projectName)}</div></td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td style="color: ${entry.jiraIssueKey ? '#6c8eef' : 'rgba(255,255,255,0.25)'}; font-size: 8px">${entry.jiraIssueKey ? esc(entry.jiraIssueKey) : '—'}</td>
  <td class="duration-cell">${formatDuration(entry.durationSeconds)}</td>
</tr>`);
      }
    }
  }

  const endOfReport = `<div class="end-of-report">
  <div class="eor-label">End of Report</div>
  <div>${esc(formatDateRange(data.dateFrom, data.dateTo))} &middot; ${data.summary.userCount} team member${data.summary.userCount !== 1 ? 's' : ''} &middot; ${formatHours(data.summary.totalSeconds)} total</div>
</div>`;

  // ── Page 1 assembled statically ─────────────────────────────────
  const page1Html = `<div class="page" id="page-1">
  ${pageHeader(`Generated: ${formatGeneratedAt(data.generatedAt)}`)}
  <div class="page-content">${page1}</div>
  ${pageFooter(data, 1, 0)}
</div>`;

  // ── Measurement container + pagination script ───────────────────
  const measureHtml = `<div id="measure-container" style="position:absolute;left:0;top:0;width:210mm;visibility:hidden">
  <div style="padding:8mm 20mm 10mm 20mm">
    <table class="entries-table">${COLGROUP}<tbody>
      ${allRowsHtml.join('\n')}
    </tbody></table>
  </div>
</div>`;

  // Header/footer templates (hidden, cloned by script)
  const headerTpl = `<template id="tpl-header">${pageHeader()}</template>`;
  const footerTpl = `<template id="tpl-footer"><div class="page-footer">
  <span class="footer-brand">Ternity &middot; app.ternity.xyz</span>
  <span>Time Report &mdash; ${esc(formatDateRange(data.dateFrom, data.dateTo))}</span>
  <span class="page-number"></span>
</div></template>`;

  // End-of-report template
  const eorTpl = `<template id="tpl-eor">${endOfReport}</template>`;

  const paginationScript = `<script>
(function() {
  var tmpPage = document.createElement('div');
  tmpPage.className = 'page';
  tmpPage.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;height:297mm';
  var hdr = document.getElementById('tpl-header').content.cloneNode(true);
  var ftr = document.getElementById('tpl-footer').content.cloneNode(true);
  var tmpContent = document.createElement('div');
  tmpContent.className = 'page-content';
  var marker = document.createElement('div');
  marker.style.cssText = 'width:1px;height:1px';
  tmpContent.appendChild(marker);
  tmpPage.appendChild(hdr);
  tmpPage.appendChild(tmpContent);
  tmpPage.appendChild(ftr);
  document.body.appendChild(tmpPage);
  var footerEl = tmpPage.querySelector('.page-footer');
  var contentRect = tmpContent.getBoundingClientRect();
  var footerRect = footerEl.getBoundingClientRect();
  var contentStyle = window.getComputedStyle(tmpContent);
  var cPadTop = parseFloat(contentStyle.paddingTop);
  var cPadBottom = parseFloat(contentStyle.paddingBottom);
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

  var totalPages = 1 + dataPages.length;

  var page1Footer = document.querySelector('#page-1 .page-number');
  if (page1Footer) page1Footer.textContent = 'Page 1 of ' + totalPages;

  var colgroup = '${COLGROUP.replace(/'/g, "\\'")}';

  for (var p = 0; p < dataPages.length; p++) {
    var pageNum = p + 2;
    var isLast = (p === dataPages.length - 1);
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
      if (r === 0) dataPages[p][r].el.classList.remove('has-divider');
      tbody.appendChild(dataPages[p][r].el);
    }
    table.appendChild(tbody);
    contentDiv.appendChild(table);
    if (isLast) {
      var eorClone = document.getElementById('tpl-eor').content.cloneNode(true);
      contentDiv.appendChild(eorClone);
    }
    pageDiv.appendChild(contentDiv);

    var ftrClone = document.getElementById('tpl-footer').content.cloneNode(true);
    ftrClone.querySelector('.page-number').textContent = 'Page ' + pageNum + ' of ' + totalPages;
    pageDiv.appendChild(ftrClone);

    document.body.appendChild(pageDiv);
  }

  document.getElementById('tpl-header').remove();
  document.getElementById('tpl-footer').remove();
  document.getElementById('tpl-eor').remove();
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
${eorTpl}
${paginationScript}
</body>
</html>`;
}
