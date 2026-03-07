/**
 * V5 — Dashboard Print
 * Web dashboard translated to paper. Card-based layout with light gray
 * background, white cards with subtle borders and shadows.
 * Stat cards, donut chart, team bars on page 1; user detail cards on inner pages.
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

:root {
  --teal: #00d4aa;
  --bg: #f5f6f8;
  --card: #ffffff;
  --card-border: #e5e8ec;
  --text-primary: #1a1e26;
  --text-secondary: #5f6b7a;
  --text-tertiary: #8d96a3;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  color: var(--text-primary);
  line-height: 1.5;
  background: var(--bg);
}

.page {
  width: 210mm;
  min-height: 297mm;
  position: relative;
  padding: 10mm 12mm 18mm 12mm;
  overflow: hidden;
  page-break-after: always;
  background: var(--bg);
}
.page:last-child { page-break-after: auto; }

/* ── Cards ─────────────────────────────────────── */

.card {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* ── Nav bar card ──────────────────────────────── */

.nav-bar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  margin-bottom: 5mm;
}
.nav-bar .logo-symbol svg { width: 22px; height: 27px; }
.nav-bar .logo-title {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600; font-size: 14px;
  letter-spacing: 2.5px; color: var(--text-primary);
  text-transform: uppercase;
  margin-left: 8px;
}
.nav-bar .nav-sep {
  width: 1px; height: 20px;
  background: var(--card-border);
  margin: 0 12px;
}
.nav-bar .nav-subtitle {
  font-family: 'Oxanium', sans-serif;
  font-weight: 400; font-size: 11px;
  letter-spacing: 1px; color: var(--text-secondary);
  text-transform: uppercase;
}
.nav-bar .nav-date {
  margin-left: auto;
  font-size: 9px; color: var(--text-tertiary);
}

.nav-bar-compact { padding: 8px 14px; margin-bottom: 4mm; }
.nav-bar-compact .logo-symbol svg { width: 18px; height: 22px; }
.nav-bar-compact .logo-title { font-size: 11px; letter-spacing: 2px; }
.nav-bar-compact .nav-sep { height: 16px; margin: 0 10px; }
.nav-bar-compact .nav-subtitle { font-size: 9px; }
.nav-bar-compact .nav-date { font-size: 8px; }

/* ── Stat cards ────────────────────────────────── */

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4mm;
  margin-bottom: 5mm;
}
.stat-card { padding: 14px 16px; }
.stat-card .stat-label {
  font-size: 8px; text-transform: uppercase;
  letter-spacing: 1px; color: var(--text-tertiary);
  margin-bottom: 6px;
}
.stat-card .stat-value {
  font-family: 'Oxanium', sans-serif;
  font-size: 22px; font-weight: 700; color: var(--teal);
  line-height: 1.2;
}
.stat-card .stat-detail {
  font-size: 8px; color: var(--text-tertiary); margin-top: 4px;
}

/* ── Chart card ────────────────────────────────── */

.chart-card {
  padding: 16px 20px;
  margin-bottom: 5mm;
}
.chart-card-heading {
  font-family: 'Oxanium', sans-serif;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.5px; color: var(--text-primary);
  margin-bottom: 12px;
}
.chart-card-body {
  display: flex;
  align-items: center;
  gap: 20px;
}
.chart-container { flex-shrink: 0; }
.chart-legend-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  padding: 4px 0;
}
.legend-dot {
  width: 8px; height: 8px;
  border-radius: 50%; flex-shrink: 0;
}
.legend-name { flex: 1; color: var(--text-primary); }
.legend-hours {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600; color: var(--text-primary);
  white-space: nowrap;
}
.legend-pct {
  color: var(--text-tertiary);
  min-width: 30px; text-align: right;
  font-size: 8px;
}

/* ── Team card ─────────────────────────────────── */

.team-card { padding: 16px 20px; margin-bottom: 5mm; }
.team-card-heading {
  font-family: 'Oxanium', sans-serif;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.5px; color: var(--text-primary);
  margin-bottom: 12px;
}
.team-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid #f0f2f5;
}
.team-row:last-child { border-bottom: none; }
.team-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Oxanium', sans-serif;
  font-weight: 700; font-size: 10px; color: #fff;
  flex-shrink: 0;
}
.team-name {
  font-size: 10px; font-weight: 500;
  color: var(--text-primary);
  min-width: 90px;
}
.team-role {
  font-size: 8px; color: var(--text-tertiary);
  min-width: 50px;
}
.team-bar-track {
  flex: 1; height: 6px;
  background: #f0f2f5; border-radius: 3px;
  overflow: hidden;
}
.team-bar-fill { height: 100%; border-radius: 3px; }
.team-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 10px; font-weight: 600;
  color: var(--text-primary);
  min-width: 50px; text-align: right;
}

/* ── User detail card ──────────────────────────── */

.user-detail-card { margin-bottom: 0; overflow: hidden; }
[data-row] { overflow: hidden; }
.user-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--card-border);
}
.user-detail-header.has-divider { border-top: 1px solid var(--card-border); }
.user-detail-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Oxanium', sans-serif;
  font-weight: 700; font-size: 14px; color: #fff;
  flex-shrink: 0;
}
.user-detail-info { flex: 1; }
.user-detail-name {
  font-family: 'Oxanium', sans-serif;
  font-size: 14px; font-weight: 600;
  color: var(--text-primary); letter-spacing: 0.3px;
}
.user-detail-role {
  font-size: 9px; color: var(--text-secondary); margin-top: 1px;
}
.user-detail-total {
  text-align: right;
}
.user-detail-hours {
  font-family: 'Oxanium', sans-serif;
  font-size: 20px; font-weight: 700; color: var(--teal);
  line-height: 1.2;
}
.user-detail-label {
  font-size: 7px; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 1px;
}

.user-detail-body { padding: 0; }

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 20px;
  background: #f7f8fa;
  border-bottom: 1px solid #eef0f3;
}
.day-header-date {
  font-size: 9px; font-weight: 600;
  color: var(--text-secondary);
}
.day-header-total {
  font-family: 'Oxanium', sans-serif;
  font-size: 9px; font-weight: 600; color: var(--teal);
}

.entry-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 20px;
  border-bottom: 1px solid #f5f6f8;
  font-size: 9px;
}
.entry-row:last-child { border-bottom: none; }

.entry-project {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 110px;
  flex-shrink: 0;
}
.project-dot {
  width: 7px; height: 7px;
  border-radius: 50%; flex-shrink: 0;
}
.entry-project-name {
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.entry-description {
  flex: 1;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.entry-jira {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(0,212,170,0.1);
  color: #00a886;
  font-size: 8px; font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}
.entry-jira-empty {
  min-width: 50px;
  flex-shrink: 0;
}
.entry-duration {
  font-family: 'Oxanium', sans-serif;
  font-size: 9px; font-weight: 600;
  color: var(--text-primary);
  min-width: 55px; text-align: right;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Generation info card ──────────────────────── */

.gen-info-card {
  padding: 14px 20px;
  text-align: center;
  font-size: 9px;
  color: var(--text-tertiary);
}
.gen-info-card .gen-label {
  font-size: 7px; text-transform: uppercase;
  letter-spacing: 1px; color: var(--text-tertiary);
  margin-bottom: 4px;
}
.gen-info-card .gen-value {
  color: var(--text-secondary);
}

/* ── Page footer ───────────────────────────────── */

.page-footer {
  position: absolute;
  bottom: 8mm; left: 12mm; right: 12mm;
  text-align: center;
  padding: 8px 16px;
  font-size: 8px;
  color: var(--text-tertiary);
}
`;

// ── Nav bar partial ──────────────────────────────────────────────────────

function navBar(data: ReportData, compact?: boolean): string {
  const cls = compact ? ' nav-bar-compact' : '';
  return `<div class="card nav-bar${cls}">
  <div class="logo-symbol">${LOGO_SVG}</div>
  <span class="logo-title">Ternity</span>
  <div class="nav-sep"></div>
  <span class="nav-subtitle">Time Report</span>
  <span class="nav-date">${esc(formatDateRange(data.dateFrom, data.dateTo))}</span>
</div>`;
}

// ── Page footer partial ──────────────────────────────────────────────────

function pageFooter(data: ReportData, pageNum: number, totalPages: number): string {
  return `<div class="page-footer card">
  Generated by Ternity &middot; ${esc(formatDateShort(data.dateFrom))} – ${esc(formatDateShort(data.dateTo))} &middot; Page ${pageNum} of ${totalPages}
</div>`;
}

// ── Main render ──────────────────────────────────────────────────────────

export function renderV5(data: ReportData): string {
  const pages: string[] = [];

  // ── Page 1: Dashboard Overview ────────────────────────────────────

  let page1 = '';

  // Nav bar
  page1 += navBar(data);

  // Stat cards
  const avgPerDay =
    data.summary.workingDays > 0
      ? formatHours(data.summary.totalSeconds / data.summary.workingDays)
      : '—';

  page1 += `<div class="stat-grid">
  <div class="card stat-card">
    <div class="stat-label">Total Hours</div>
    <div class="stat-value">${formatHours(data.summary.totalSeconds)}</div>
    <div class="stat-detail">across ${data.summary.workingDays} working days</div>
  </div>
  <div class="card stat-card">
    <div class="stat-label">Total Entries</div>
    <div class="stat-value">${data.summary.totalEntries}</div>
    <div class="stat-detail">${data.summary.userCount} team member${data.summary.userCount !== 1 ? 's' : ''}</div>
  </div>
  <div class="card stat-card">
    <div class="stat-label">Avg / Day</div>
    <div class="stat-value">${avgPerDay}</div>
    <div class="stat-detail">per working day</div>
  </div>
  <div class="card stat-card">
    <div class="stat-label">Projects</div>
    <div class="stat-value">${data.summary.projectCount}</div>
    <div class="stat-detail">${data.projectBreakdown.length} tracked</div>
  </div>
</div>`;

  // Chart card — donut + 2x2 legend grid
  const donutChart = generatePieChart(data, { size: 140, strokeWidth: 22, type: 'donut' });
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

  page1 += `<div class="card chart-card">
  <div class="chart-card-heading">Hours Distribution by Team Member</div>
  <div class="chart-card-body">
    <div class="chart-container">${donutChart}</div>
    <div class="chart-legend-grid">
      ${legendItems}
    </div>
  </div>
</div>`;

  // Team card — rows with avatar, name, role, bar, hours
  const maxUserSeconds = Math.max(...data.userBreakdown.map((u) => u.totalSeconds), 1);

  let teamRows = '';
  for (let i = 0; i < data.userBreakdown.length; i++) {
    const u = data.userBreakdown[i]!;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const barPct = Math.max((u.totalSeconds / maxUserSeconds) * 100, 2);

    teamRows += `<div class="team-row">
    <div class="team-avatar" style="background: ${color}">${esc(initials(u.userName))}</div>
    <span class="team-name">${esc(u.userName)}</span>
    <span class="team-role">Member</span>
    <div class="team-bar-track"><div class="team-bar-fill" style="width: ${barPct.toFixed(1)}%; background: ${color}"></div></div>
    <span class="team-hours">${formatHours(u.totalSeconds)}</span>
  </div>`;
  }

  const teamCardHtml = `<div class="card team-card">
  <div class="team-card-heading">Team Overview</div>
  ${teamRows}
</div>`;

  // With >10 users the team card overflows A4 when combined with stat + chart cards.
  // Split it to a second page so Chromium doesn't create an extra physical page without header/footer.
  const V5_TEAM_USER_THRESHOLD = 10;
  if (data.userBreakdown.length <= V5_TEAM_USER_THRESHOLD) {
    page1 += teamCardHtml;
    pages.push(page1);
  } else {
    pages.push(page1);
    let teamPage = navBar(data, true);
    teamPage += teamCardHtml;
    pages.push(teamPage);
  }

  // ── Build all data rows as HTML ────────────────────────────────────
  // Each row is wrapped in <div data-row> for measurement.
  // Sticky rows (user headers, day headers) get data-sticky.
  const allRowsHtml: string[] = [];

  for (let ui = 0; ui < data.userDetails.length; ui++) {
    const user = data.userDetails[ui]!;
    const color = CHART_COLORS[ui % CHART_COLORS.length];
    const dividerCls = ui > 0 ? ' has-divider' : '';

    // User detail header — sticky
    allRowsHtml.push(`<div data-row data-sticky>
  <div class="user-detail-header${dividerCls}">
    <div class="user-detail-avatar" style="background: ${color}">${esc(initials(user.userName))}</div>
    <div class="user-detail-info">
      <div class="user-detail-name">${esc(user.userName)}</div>
      <div class="user-detail-role">${user.entryCount} entries &middot; ${user.daysActive} days active</div>
    </div>
    <div class="user-detail-total">
      <div class="user-detail-hours">${formatHours(user.totalSeconds)}</div>
      <div class="user-detail-label">Total Hours</div>
    </div>
  </div>
</div>`);

    for (const dg of user.dayGroups) {
      // Day header — sticky
      allRowsHtml.push(`<div data-row data-sticky>
  <div class="day-header">
    <span class="day-header-date">${esc(formatDate(dg.date))}</span>
    <span class="day-header-total">${formatDuration(dg.dayTotalSeconds)}</span>
  </div>
</div>`);

      for (const entry of dg.entries) {
        const jiraHtml = entry.jiraIssueKey
          ? `<span class="entry-jira">${esc(entry.jiraIssueKey)}</span>`
          : `<span class="entry-jira-empty"></span>`;
        allRowsHtml.push(`<div data-row>
  <div class="entry-row">
    <div class="entry-project">
      <span class="project-dot" style="background: ${entry.projectColor}"></span>
      <span class="entry-project-name">${esc(entry.projectName)}</span>
    </div>
    <span class="entry-description">${esc(entry.description)}</span>
    ${jiraHtml}
    <span class="entry-duration">${formatDuration(entry.durationSeconds)}</span>
  </div>
</div>`);
      }
    }
  }

  // ── Generation info card (appended to last page by script) ────────
  const genInfoHtml = `<div class="card gen-info-card" style="margin-top: auto;">
  <div class="gen-label">Report Generated</div>
  <div class="gen-value">${esc(formatGeneratedAt(data.generatedAt))}</div>
</div>`;

  // ── Static pages (cover / team overflow) ──────────────────────────
  const staticPageCount = pages.length;
  const staticPagesHtml = pages
    .map(
      (content, i) => `<div class="page" id="page-${i + 1}">
  ${content}
  <div class="page-footer card">
    Generated by Ternity \u00b7 ${esc(formatDateShort(data.dateFrom))} \u2013 ${esc(formatDateShort(data.dateTo))} \u00b7 Page ${i + 1} of 0
  </div>
</div>`,
    )
    .join('\n');

  // ── Measurement container ─────────────────────────────────────────
  const navBarCompact = navBar(data, true);
  const measureHtml = `<div id="measure-container" style="position:absolute;left:0;top:0;width:210mm;visibility:hidden">
  <div class="page" style="height:auto;min-height:0;padding:10mm 12mm 18mm 12mm">
    ${navBarCompact}
    <div class="card user-detail-card"><div class="user-detail-body">
      ${allRowsHtml.join('\n')}
    </div></div>
  </div>
</div>`;

  // ── Templates ─────────────────────────────────────────────────────
  const navTpl = `<template id="tpl-nav">${navBarCompact}</template>`;
  const footerTpl = `<template id="tpl-footer"><div class="page-footer card"></div></template>`;
  const genInfoTpl = `<template id="tpl-geninfo">${genInfoHtml}</template>`;

  const paginationScript = `<script>
(function() {
  var staticPageCount = ${staticPageCount};

  // Measure available height
  var tmpPage = document.createElement('div');
  tmpPage.className = 'page';
  tmpPage.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;height:297mm';

  // Nav bar
  var navClone = document.getElementById('tpl-nav').content.cloneNode(true);
  tmpPage.appendChild(navClone);

  // Card wrapper (like data pages have)
  var tmpCard = document.createElement('div');
  tmpCard.className = 'card user-detail-card';
  var tmpBody = document.createElement('div');
  tmpBody.className = 'user-detail-body';
  var marker = document.createElement('div');
  marker.style.cssText = 'width:1px;height:1px';
  tmpBody.appendChild(marker);
  tmpCard.appendChild(tmpBody);
  tmpPage.appendChild(tmpCard);

  // Footer
  var ftrClone = document.getElementById('tpl-footer').content.cloneNode(true);
  tmpPage.appendChild(ftrClone);
  document.body.appendChild(tmpPage);

  var markerRect = marker.getBoundingClientRect();
  var footerEl = tmpPage.querySelector('.page-footer');
  var footerRect = footerEl.getBoundingClientRect();
  // Available = from content marker to footer top minus 3px safety
  var availableH = footerRect.top - markerRect.top - 3;
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
    // Pull back trailing sticky rows
    while (pageRows.length > 1 && pageRows[pageRows.length - 1].sticky) {
      idx--;
      pageRows.pop();
    }
    dataPages.push(pageRows);
  }

  var totalPages = staticPageCount + dataPages.length;

  // Fix static page footers (replace "of 0")
  for (var s = 0; s < staticPageCount; s++) {
    var sFtr = document.getElementById('page-' + (s + 1)).querySelector('.page-footer');
    if (sFtr) sFtr.textContent = sFtr.textContent.replace('of 0', 'of ' + totalPages);
  }

  // Build data page divs
  var dateRange = '${esc(formatDateShort(data.dateFrom))} \\u2013 ${esc(formatDateShort(data.dateTo))}';
  for (var p = 0; p < dataPages.length; p++) {
    var pageNum = staticPageCount + p + 1;
    var pageDiv = document.createElement('div');
    pageDiv.className = 'page';

    // Nav bar
    var nav = document.getElementById('tpl-nav').content.cloneNode(true);
    pageDiv.appendChild(nav);

    // Card wrapper
    var card = document.createElement('div');
    card.className = 'card user-detail-card';
    var body = document.createElement('div');
    body.className = 'user-detail-body';
    for (var r = 0; r < dataPages[p].length; r++) {
      // Strip divider from first row on page (widow divider fix)
      if (r === 0) {
        var hdrEl = dataPages[p][r].el.querySelector('.user-detail-header');
        if (hdrEl) hdrEl.classList.remove('has-divider');
      }
      body.appendChild(dataPages[p][r].el);
    }
    card.appendChild(body);
    pageDiv.appendChild(card);

    // Gen-info card on last page
    if (p === dataPages.length - 1) {
      var gi = document.getElementById('tpl-geninfo').content.cloneNode(true);
      pageDiv.appendChild(gi);
    }

    // Footer
    var ftr = document.getElementById('tpl-footer').content.cloneNode(true);
    ftr.querySelector('.page-footer').textContent =
      'Generated by Ternity \\u00b7 ' + dateRange + ' \\u00b7 Page ' + pageNum + ' of ' + totalPages;
    pageDiv.appendChild(ftr);

    document.body.appendChild(pageDiv);
  }

  // Cleanup templates
  document.getElementById('tpl-nav').remove();
  document.getElementById('tpl-footer').remove();
  document.getElementById('tpl-geninfo').remove();
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
${navTpl}
${footerTpl}
${genInfoTpl}
${paginationScript}
</body>
</html>`;
}
