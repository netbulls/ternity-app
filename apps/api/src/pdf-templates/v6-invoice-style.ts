/**
 * V6 — Invoice Style
 * Dense, utilitarian layout. Maximum data per page. Invoice/billing statement feel.
 * Single continuous table with user-header separator rows.
 */

import type { ReportData } from '@ternity/shared';
import {
  LOGO_SVG,
  FONTS_LINK,
  formatHours,
  formatDateShort,
  formatDateRange,
  formatGeneratedAt,
  esc,
} from './shared.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Report number derived from the date range */
function reportNo(data: ReportData): string {
  const from = data.dateFrom.replace(/-/g, '');
  const to = data.dateTo.replace(/-/g, '');
  return `TR-${from}-${to}`;
}

/** Format date as MM-DD for the dense table */
function fmtMMDD(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format time range from HH:MM start + duration in seconds → "HH:MM–HH:MM" */
function fmtTimeRange(startTime: string, durationSeconds: number): string {
  // startTime is "HH:MM" from the SQL query (NOT an ISO datetime)
  const [sh, sm] = startTime.split(':').map(Number);
  const startMinutes = (sh ?? 0) * 60 + (sm ?? 0);
  const endMinutes = startMinutes + Math.round(durationSeconds / 60);
  const eh = Math.floor(endMinutes / 60) % 24;
  const em = endMinutes % 60;
  return `${startTime}–${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

/** Decimal hours (e.g. 2.50) */
function decimalHours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

// ── CSS ──────────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4; margin: 0; }

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 8.5px;
  color: #1a1a1a;
  line-height: 1.45;
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

.page-content { padding: 12mm 15mm 18mm 15mm; }

/* ── Invoice header (page 1) ── */
.inv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10mm 15mm 6mm 15mm;
}
.inv-header-left { display: flex; align-items: center; gap: 10px; }
.inv-header-left svg { width: 24px; height: 29px; }
.inv-header-left .wordmark {
  font-family: 'Oxanium', sans-serif;
  font-weight: 700; font-size: 15px;
  letter-spacing: 4px; color: #0a0a0a;
  text-transform: uppercase;
}
.inv-header-right { text-align: right; }
.inv-header-right .doc-type {
  font-family: 'Oxanium', sans-serif;
  font-weight: 700; font-size: 13px;
  letter-spacing: 2px; text-transform: uppercase;
  color: #0a0a0a; margin-bottom: 6px;
}
.inv-meta-table {
  border-collapse: collapse; font-size: 8px;
  margin-left: auto;
}
.inv-meta-table td {
  padding: 2px 0; vertical-align: top;
}
.inv-meta-table .meta-label {
  color: #666; text-align: right; padding-right: 8px;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
  white-space: nowrap;
}
.inv-meta-table .meta-value {
  color: #1a1a1a; font-weight: 500; white-space: nowrap;
}

/* ── Compact header (continuation pages) ── */
.compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8mm 15mm 5mm 15mm;
}
.compact-header-left { display: flex; align-items: center; gap: 8px; }
.compact-header-left svg { width: 18px; height: 22px; }
.compact-header-left .wordmark {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600; font-size: 11px;
  letter-spacing: 3px; color: #0a0a0a;
  text-transform: uppercase;
}
.compact-header-right {
  font-family: 'Oxanium', sans-serif;
  font-size: 9px; color: #444;
  letter-spacing: 0.5px;
}

/* ── Double rule separator ── */
.double-rule {
  margin: 0 15mm;
  border: none;
  border-top: 2px solid #1a1a1a;
  padding-top: 2px;
  border-bottom: 1px solid #999;
  height: 0;
}

/* ── Section titles ── */
.section-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 10px; font-weight: 700;
  letter-spacing: 1.5px; text-transform: uppercase;
  color: #0a0a0a; margin: 5mm 0 3mm 0;
  padding-bottom: 2mm;
  border-bottom: 1px solid #ccc;
}

/* ── Summary table ── */
.summary-table {
  width: 100%; border-collapse: collapse;
  margin-bottom: 5mm;
}
.summary-table th {
  background: #f4f5f6;
  border: 1px solid #ccc;
  padding: 4px 8px;
  text-align: left;
  font-size: 7px; font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #555;
}
.summary-table td {
  border: 1px solid #ccc;
  padding: 4px 8px;
  font-size: 8.5px;
}
.summary-table .val { font-weight: 700; color: #0a0a0a; }
.summary-table .detail { color: #666; }
.summary-table .notes { color: #999; font-style: italic; font-size: 7.5px; }

/* ── Dense time log table ── */
.log-table {
  width: 100%; border-collapse: collapse;
  font-size: 8px;
}
.log-table thead th {
  background: #f4f5f6;
  border: 1px solid #bbb;
  padding: 3px 6px;
  text-align: left;
  font-size: 7px; font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #555;
}
.log-table thead th:last-child { text-align: right; }
.log-table tbody td {
  border: 1px solid #ddd;
  padding: 3px 6px;
  vertical-align: top;
}
.log-table tbody tr:nth-child(even) td { background: #fafbfc; }

/* User header row */
.log-table .user-header-row td {
  background: #ebedf0 !important;
  border: 1px solid #bbb;
  padding: 5px 6px;
  font-weight: 700;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #333;
}
.log-table .user-header-row .user-hours {
  text-align: right;
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  color: #0a0a0a;
}

/* Subtotal row */
.log-table .subtotal-row td {
  background: #f4f5f6 !important;
  border: 1px solid #bbb;
  padding: 3px 6px;
  font-weight: 700;
  font-size: 8px;
  color: #333;
}
.log-table .subtotal-row .subtotal-hours {
  text-align: right;
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  color: #0a0a0a;
}
.log-table .subtotal-row .subtotal-label {
  text-align: right;
  font-style: italic;
  color: #555;
}

/* Grand total row */
.log-table .grand-total-row td {
  background: #111 !important;
  border: 1px solid #111;
  color: #fff;
  padding: 5px 6px;
  font-weight: 700;
  font-size: 8.5px;
}
.log-table .grand-total-row .grand-total-hours {
  text-align: right;
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  color: #00D4AA;
  font-size: 9px;
}

/* Mono style for dates/times/jira */
.mono {
  font-family: 'Oxanium', monospace;
  letter-spacing: 0.3px;
}

/* Duration cells */
.dur { text-align: right; font-family: 'Oxanium', sans-serif; font-weight: 600; white-space: nowrap; }

/* Desc cell */
.desc-cell { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }

/* Jira cell */
.jira-cell { color: #6c8eef; font-size: 7.5px; white-space: nowrap; }
.jira-cell.empty { color: #bbb; }

/* ── Appendix tables ── */
.app-table {
  width: 100%; border-collapse: collapse;
  margin-bottom: 5mm; font-size: 8px;
}
.app-table th {
  background: #f4f5f6;
  border: 1px solid #ccc;
  padding: 4px 6px;
  text-align: left;
  font-size: 7px; font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #555;
}
.app-table th.r, .app-table td.r { text-align: right; }
.app-table td {
  border: 1px solid #ccc;
  padding: 3px 6px;
}
.app-table tbody tr:nth-child(even) td { background: #fafbfc; }

/* ── Signature block ── */
.sig-block {
  display: flex; gap: 20mm;
  margin-top: 10mm; padding-top: 3mm;
}
.sig-field { flex: 1; }
.sig-line {
  border-bottom: 1px solid #999;
  height: 15mm;
}
.sig-label {
  font-size: 7px; color: #666;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-top: 2px;
}

/* ── Legal footer ── */
.legal {
  margin-top: 6mm;
  font-size: 7px; color: #999;
  font-style: italic; line-height: 1.5;
  border-top: 1px solid #ddd;
  padding-top: 3mm;
}

/* ── Page footer ── */
.page-footer {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; align-items: center;
  padding: 4mm 15mm 8mm 15mm;
  border-top: 1px solid #ddd;
  font-size: 7px; color: #999;
}
.page-footer .pf-left { text-align: left; }
.page-footer .pf-center {
  text-align: center;
  font-family: 'Oxanium', sans-serif;
  letter-spacing: 1px; text-transform: uppercase;
  color: #bbb;
}
.page-footer .pf-right { font-weight: 600; color: #666; }
`;

// ── Header partials ──────────────────────────────────────────────────────

function invoiceHeader(data: ReportData): string {
  return `<div class="inv-header">
  <div class="inv-header-left">
    ${LOGO_SVG}
    <span class="wordmark">Ternity</span>
  </div>
  <div class="inv-header-right">
    <div class="doc-type">Time Report</div>
    <table class="inv-meta-table">
      <tr><td class="meta-label">Report No</td><td class="meta-value">${esc(reportNo(data))}</td></tr>
      <tr><td class="meta-label">Date</td><td class="meta-value">${esc(formatDateShort(data.generatedAt.slice(0, 10)))}</td></tr>
      <tr><td class="meta-label">Period</td><td class="meta-value">${esc(formatDateRange(data.dateFrom, data.dateTo))}</td></tr>
      <tr><td class="meta-label">Team</td><td class="meta-value">${data.summary.userCount} member${data.summary.userCount !== 1 ? 's' : ''}</td></tr>
    </table>
  </div>
</div>
<hr class="double-rule"/>`;
}

function compactHeader(data: ReportData): string {
  return `<div class="compact-header">
  <div class="compact-header-left">
    ${LOGO_SVG}
    <span class="wordmark">Ternity</span>
  </div>
  <div class="compact-header-right">Time Report &mdash; ${esc(reportNo(data))}</div>
</div>
<hr class="double-rule"/>`;
}

function pageFooter(data: ReportData, pageNum: number, totalPages: number): string {
  return `<div class="page-footer">
  <span class="pf-left">${esc(reportNo(data))}</span>
  <span class="pf-center">Ternity &middot; ${esc(formatDateRange(data.dateFrom, data.dateTo))}</span>
  <span class="pf-right">Page ${pageNum} of ${totalPages}</span>
</div>`;
}

// ── Table header row (reusable for continuation pages) ───────────────────

const LOG_TABLE_HEAD = `<thead><tr>
  <th style="width:38px">Date</th>
  <th style="width:72px">Time</th>
  <th style="width:90px">Project</th>
  <th>Description</th>
  <th style="width:58px">Jira</th>
  <th style="width:44px" class="r">Hours</th>
</tr></thead>`;

// ── Main render ──────────────────────────────────────────────────────────

export function renderV6(data: ReportData): string {
  // We collect pages, then assemble with page numbers at the end
  const pages: Array<{ html: string; headerType: 'invoice' | 'compact' }> = [];

  // ── Page 1: Summary + start of time log ────────────────────────
  let p1 = '';

  // Summary section
  const avgPerDay =
    data.summary.workingDays > 0
      ? formatHours(data.summary.totalSeconds / data.summary.workingDays)
      : '—';
  const avgPerPerson =
    data.summary.userCount > 0
      ? formatHours(data.summary.totalSeconds / data.summary.userCount)
      : '—';

  p1 += `<div class="section-title">Summary</div>`;
  p1 += `<table class="summary-table">
<thead><tr>
  <th style="width:120px">Metric</th>
  <th style="width:80px">Value</th>
  <th style="width:140px">Detail</th>
  <th>Notes</th>
</tr></thead>
<tbody>
  <tr>
    <td class="val">Total Hours</td>
    <td class="val">${formatHours(data.summary.totalSeconds)}</td>
    <td class="detail">${decimalHours(data.summary.totalSeconds)} decimal hours</td>
    <td class="notes">Across all team members</td>
  </tr>
  <tr>
    <td class="val">Total Entries</td>
    <td class="val">${data.summary.totalEntries}</td>
    <td class="detail">${data.summary.workingDays} working days</td>
    <td class="notes">Average ${avgPerDay} / day</td>
  </tr>
  <tr>
    <td class="val">Team Members</td>
    <td class="val">${data.summary.userCount}</td>
    <td class="detail">${avgPerPerson} average per person</td>
    <td class="notes">${data.summary.projectCount} project${data.summary.projectCount !== 1 ? 's' : ''} tracked</td>
  </tr>
</tbody>
</table>`;

  // Start time log
  p1 += `<div class="section-title">Detailed Time Log</div>`;
  p1 += `<table class="log-table">`;
  p1 += LOG_TABLE_HEAD;
  p1 += `<tbody>`;

  // Build all entry rows first, then paginate
  // We'll build the full tbody content and split across pages
  type RowEntry = { html: string };
  const allRows: RowEntry[] = [];

  for (let ui = 0; ui < data.userDetails.length; ui++) {
    const user = data.userDetails[ui]!;

    // User header row
    allRows.push({
      html: `<tr class="user-header-row">
  <td colspan="5">${esc(user.userName.toUpperCase())}</td>
  <td class="user-hours">${decimalHours(user.totalSeconds)}</td>
</tr>`,
    });

    // Entry rows
    for (const dg of user.dayGroups) {
      const dateStr = fmtMMDD(dg.date);
      for (const entry of dg.entries) {
        const timeRange = fmtTimeRange(entry.startTime, entry.durationSeconds);
        const jiraHtml = entry.jiraIssueKey
          ? `<span class="mono jira-cell">${esc(entry.jiraIssueKey)}</span>`
          : `<span class="jira-cell empty">&mdash;</span>`;

        allRows.push({
          html: `<tr>
  <td class="mono">${dateStr}</td>
  <td class="mono">${timeRange}</td>
  <td>${esc(entry.projectName)}</td>
  <td class="desc-cell">${esc(entry.description)}</td>
  <td>${jiraHtml}</td>
  <td class="dur">${decimalHours(entry.durationSeconds)}</td>
</tr>`,
        });
      }
    }

    // Subtotal row
    allRows.push({
      html: `<tr class="subtotal-row">
  <td colspan="5" class="subtotal-label">Subtotal — ${esc(user.userName)}</td>
  <td class="subtotal-hours">${decimalHours(user.totalSeconds)}</td>
</tr>`,
    });
  }

  // Grand total row
  allRows.push({
    html: `<tr class="grand-total-row">
  <td colspan="5">GRAND TOTAL</td>
  <td class="grand-total-hours">${decimalHours(data.summary.totalSeconds)}</td>
</tr>`,
  });

  // Paginate rows — page 1 has less room (summary takes space)
  // Estimate: ~38 entry rows on page 1, ~52 on continuation pages
  const PAGE1_ROWS = 38;
  const CONT_ROWS = 52;

  let rowIdx = 0;

  // Page 1 rows
  const page1Limit = Math.min(PAGE1_ROWS, allRows.length);
  for (let i = 0; i < page1Limit; i++) {
    p1 += allRows[rowIdx]!.html;
    rowIdx++;
  }

  if (rowIdx >= allRows.length) {
    // Everything fits on page 1
    p1 += `</tbody></table>`;
    pages.push({ html: p1, headerType: 'invoice' });
  } else {
    // Close page 1 table (will continue on next page)
    p1 += `</tbody></table>`;
    pages.push({ html: p1, headerType: 'invoice' });

    // Continuation pages
    while (rowIdx < allRows.length) {
      let contHtml = '';
      contHtml += `<table class="log-table">`;
      contHtml += LOG_TABLE_HEAD;
      contHtml += `<tbody>`;

      const contLimit = Math.min(CONT_ROWS, allRows.length - rowIdx);
      for (let i = 0; i < contLimit; i++) {
        contHtml += allRows[rowIdx]!.html;
        rowIdx++;
      }

      contHtml += `</tbody></table>`;
      pages.push({ html: contHtml, headerType: 'compact' });
    }
  }

  // ── Appendix page ──────────────────────────────────────────────
  let appendix = '';

  // Project Breakdown
  appendix += `<div class="section-title">Appendix — Project Breakdown</div>`;
  appendix += `<table class="app-table">
<thead><tr>
  <th>Project</th>
  <th>Client</th>
  <th class="r">Total Hours</th>
  <th class="r">% of Total</th>
  <th class="r">Entries</th>
</tr></thead>
<tbody>`;

  for (const proj of data.projectBreakdown) {
    // Count entries for this project across all users
    let projEntries = 0;
    for (const user of data.userDetails) {
      for (const dg of user.dayGroups) {
        for (const entry of dg.entries) {
          if (entry.projectName === proj.projectName) projEntries++;
        }
      }
    }
    appendix += `<tr>
  <td>${esc(proj.projectName)}</td>
  <td>${proj.clientName ? esc(proj.clientName) : '&mdash;'}</td>
  <td class="r">${decimalHours(proj.totalSeconds)}</td>
  <td class="r">${proj.percentage.toFixed(1)}%</td>
  <td class="r">${projEntries}</td>
</tr>`;
  }
  appendix += `</tbody></table>`;

  // User Summary
  appendix += `<div class="section-title">User Summary</div>`;
  appendix += `<table class="app-table">
<thead><tr>
  <th>User</th>
  <th class="r">Days Active</th>
  <th class="r">Entries</th>
  <th class="r">Hours</th>
  <th class="r">Rate</th>
  <th class="r">Amount</th>
</tr></thead>
<tbody>`;

  for (const user of data.userDetails) {
    appendix += `<tr>
  <td>${esc(user.userName)}</td>
  <td class="r">${user.daysActive}</td>
  <td class="r">${user.entryCount}</td>
  <td class="r">${decimalHours(user.totalSeconds)}</td>
  <td class="r">&mdash;</td>
  <td class="r">&mdash;</td>
</tr>`;
  }
  appendix += `</tbody></table>`;

  // Signature block
  appendix += `<div class="sig-block">
  <div class="sig-field">
    <div class="sig-line"></div>
    <div class="sig-label">Authorized by</div>
  </div>
  <div class="sig-field">
    <div class="sig-line"></div>
    <div class="sig-label">Date</div>
  </div>
</div>`;

  // Legal footer
  appendix += `<div class="legal">
  This time report is generated automatically by Ternity and reflects tracked time entries for the specified period.
  Hours shown are based on individual start/stop records and may not represent contracted or billable hours.
  This document does not constitute an invoice. For billing purposes, refer to the corresponding invoice issued by the service provider.
</div>`;

  pages.push({ html: appendix, headerType: 'compact' });

  // ── Assemble final HTML ────────────────────────────────────────
  const totalPages = pages.length;

  const pagesHtml = pages
    .map(
      (p, i) => `<div class="page">
  ${p.headerType === 'invoice' ? invoiceHeader(data) : compactHeader(data)}
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
