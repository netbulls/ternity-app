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

.page-content { padding: 8mm 20mm 10mm 20mm; }

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

.section-header-row td {
  padding: 10px 8px 8px 8px !important;
  border-bottom: 2px solid #e5e5e5 !important;
  background: #fff !important;
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
  font-size: 14px; font-weight: 600; color: #0a0a0a; letter-spacing: 0.5px;
}
.section-header-row .user-info .user-stats { font-size: 9px; color: #999; }
.section-header-row .user-total { margin-left: auto; text-align: right; }
.section-header-row .user-total .total-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 18px; font-weight: 700; color: #00D4AA;
}
.section-header-row .user-total .total-label {
  font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 1px;
}
/* Extra top margin for non-first user headers */
.section-header-row.has-divider td { padding-top: 16px !important; border-top: 1px solid #e5e5e5; }

.entries-table {
  width: 100%; border-collapse: collapse;
  font-size: 9px;
}

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

  // ── Build all data rows as HTML ──────────────────────────────────
  const COLGROUP = `<colgroup><col style="width:70px"><col style="width:120px"><col><col style="width:60px"><col style="width:65px"></colgroup>`;

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
  <td colspan="4"><strong>${esc(formatDate(dg.date))}</strong></td>
  <td class="duration-cell"><span class="day-total">${formatDuration(dg.dayTotalSeconds)}</span></td>
</tr>`);

      for (const entry of dg.entries) {
        allRowsHtml.push(`<tr>
  <td class="date-cell">${esc(entry.startTime)}</td>
  <td><div class="project-cell"><span class="project-dot" style="background: ${entry.projectColor}"></span>${esc(entry.projectName)}</div></td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td style="color: ${entry.jiraIssueKey ? '#6c8eef' : '#666'}; font-size: 8px">${entry.jiraIssueKey ? esc(entry.jiraIssueKey) : '—'}</td>
  <td class="duration-cell">${formatDuration(entry.durationSeconds)}</td>
</tr>`);
      }
    }
  }

  // ── Page 1 assembled statically ─────────────────────────────────
  const page1Html = `<div class="page" id="page-1">
  ${pageHeader(`Generated: ${formatGeneratedAt(data.generatedAt)}`)}
  <div class="page-content">${page1}</div>
  ${pageFooter(data, 1, 0)}
</div>`;

  // ── Measurement container + pagination script ───────────────────
  // All rows go into a hidden table so Chromium can measure real heights.
  // A script then distributes them into proper page divs.
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

  const paginationScript = `<script>
(function() {
  // Measure available height by creating a temp page with the real layout
  var tmpPage = document.createElement('div');
  tmpPage.className = 'page';
  tmpPage.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;height:297mm';
  var hdr = document.getElementById('tpl-header').content.cloneNode(true);
  var ftr = document.getElementById('tpl-footer').content.cloneNode(true);
  var tmpContent = document.createElement('div');
  tmpContent.className = 'page-content';
  // Use a marker div to measure the space between content top and footer top
  var marker = document.createElement('div');
  marker.style.cssText = 'width:1px;height:1px';
  tmpContent.appendChild(marker);
  tmpPage.appendChild(hdr);
  tmpPage.appendChild(tmpContent);
  tmpPage.appendChild(ftr);
  document.body.appendChild(tmpPage);
  // Available height = distance from content area start to where the footer begins
  var footerEl = tmpPage.querySelector('.page-footer');
  var contentRect = tmpContent.getBoundingClientRect();
  var footerRect = footerEl.getBoundingClientRect();
  // The content padding-top is already in contentRect, we want from the inner padding start
  var contentStyle = window.getComputedStyle(tmpContent);
  var cPadTop = parseFloat(contentStyle.paddingTop);
  var cPadBottom = parseFloat(contentStyle.paddingBottom);
  // Available height for table content inside .page-content:
  // From content inner top (after padding) to footer top, minus content padding-bottom
  var availableH = footerRect.top - contentRect.top - cPadTop - cPadBottom - 3;
  document.body.removeChild(tmpPage);

  // Get all measured rows
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

  // Remove measurement container
  container.remove();

  // Build data pages
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

    // Handle sticky: if last row is sticky, pull it back (unless it's the only row)
    while (pageRows.length > 1 && pageRows[pageRows.length - 1].sticky) {
      idx--;
      pageRows.pop();
    }

    dataPages.push(pageRows);
  }

  // Total pages = 1 (cover) + data pages
  var totalPages = 1 + dataPages.length;

  // Fix page 1 footer
  var page1Footer = document.querySelector('#page-1 .page-number');
  if (page1Footer) page1Footer.textContent = 'Page 1 of ' + totalPages;

  // Colgroup for new tables
  var colgroup = '${COLGROUP.replace(/'/g, "\\'")}';

  // Build page divs
  for (var p = 0; p < dataPages.length; p++) {
    var pageNum = p + 2;
    var pageDiv = document.createElement('div');
    pageDiv.className = 'page';

    // Header
    var hdrClone = document.getElementById('tpl-header').content.cloneNode(true);
    pageDiv.appendChild(hdrClone);

    // Content
    var contentDiv = document.createElement('div');
    contentDiv.className = 'page-content';
    var table = document.createElement('table');
    table.className = 'entries-table';
    table.innerHTML = colgroup;
    var tbody = document.createElement('tbody');
    for (var r = 0; r < dataPages[p].length; r++) {
      // Strip divider from first row on page — no content above to separate from
      if (r === 0) dataPages[p][r].el.classList.remove('has-divider');
      tbody.appendChild(dataPages[p][r].el);
    }
    table.appendChild(tbody);
    contentDiv.appendChild(table);
    pageDiv.appendChild(contentDiv);

    // Footer
    var ftrClone = document.getElementById('tpl-footer').content.cloneNode(true);
    ftrClone.querySelector('.page-number').textContent = 'Page ' + pageNum + ' of ' + totalPages;
    pageDiv.appendChild(ftrClone);

    document.body.appendChild(pageDiv);
  }

  // Clean up templates
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
