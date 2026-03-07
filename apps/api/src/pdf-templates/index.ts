/**
 * PDF template registry.
 * Maps PdfTemplate identifiers to their render functions.
 */

import type { PdfTemplate, ReportData } from '@ternity/shared';
import { renderV1 } from './v1-classic-corporate.js';
import { renderV2 } from './v2-dark-executive.js';
import { renderV3 } from './v3-minimal-swiss.js';
import { renderV4 } from './v4-magazine-spread.js';
import { renderV5 } from './v5-dashboard-print.js';
import { renderV6 } from './v6-invoice-style.js';
import { renderV7 } from './v7-cover-chapters.js';

export type TemplateRenderer = (data: ReportData) => string;

/**
 * Render report data into a self-contained HTML document
 * suitable for Gotenberg HTML→PDF conversion.
 */
export function renderReportHtml(template: PdfTemplate, data: ReportData): string {
  const renderers: Record<PdfTemplate, TemplateRenderer> = {
    'classic-corporate': renderV1,
    'dark-executive': renderV2,
    'minimal-swiss': renderV3,
    'magazine-spread': renderV4,
    'dashboard-print': renderV5,
    'invoice-style': renderV6,
    'cover-chapters': renderV7,
  };

  const render = renderers[template] ?? renderV1;
  return render(data);
}
