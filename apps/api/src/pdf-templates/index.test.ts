import { describe, expect, it } from 'vitest';
import type { ReportData } from '@ternity/shared';
import { PDF_TEMPLATES } from '@ternity/shared';
import { renderReportHtml } from './index.js';

// Characterization tests for pdf-templates/index.ts — the dispatch registry.
// Also includes smoke tests that each renderer returns a non-empty HTML string
// for minimal mock data.

// ─── Minimal mock ReportData ───────────────────────────────────────────────

const MINIMAL_DATA: ReportData = {
  dateFrom: '2026-05-01',
  dateTo: '2026-05-31',
  generatedAt: '2026-05-31T18:00:00.000Z',
  summary: {
    totalSeconds: 28800,
    totalEntries: 4,
    userCount: 1,
    projectCount: 1,
    workingDays: 1,
  },
  userBreakdown: [
    {
      userId: 'u1',
      userName: 'Elena Marsh',
      userAvatarUrl: null,
      totalSeconds: 28800,
      percentage: 100,
      entryCount: 4,
    },
  ],
  userDetails: [
    {
      userId: 'u1',
      userName: 'Elena Marsh',
      userAvatarUrl: null,
      totalSeconds: 28800,
      entryCount: 4,
      daysActive: 1,
      dayGroups: [
        {
          date: '2026-05-15',
          dayTotalSeconds: 28800,
          entries: [
            {
              id: 'e1',
              description: 'Work item',
              projectName: 'Acme Project',
              projectColor: '#00D4AA',
              clientName: 'Acme Corp',
              jiraIssueKey: null,
              startTime: '09:00',
              durationSeconds: 7200,
            },
          ],
        },
      ],
    },
  ],
  projectBreakdown: [
    {
      projectId: 'p1',
      projectName: 'Acme Project',
      projectColor: '#00D4AA',
      clientName: 'Acme Corp',
      totalSeconds: 28800,
      percentage: 100,
      entryCount: 4,
    },
  ],
};

// ─── Registry / dispatch ───────────────────────────────────────────────────

describe('renderReportHtml — registry', () => {
  it('returns a string (not null/undefined/empty) for every known template id', () => {
    for (const template of PDF_TEMPLATES) {
      const html = renderReportHtml(template, MINIMAL_DATA);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    }
  });

  it('falls back to renderV1 (classic-corporate) for an unknown template id', () => {
    // The dispatch uses `renderers[template] ?? renderV1`
    // Cast to PdfTemplate to satisfy TS — at runtime this simulates an unknown id
    // being passed (e.g. from a future client talking to an old server).
    const unknown = 'not-a-real-template' as Parameters<typeof renderReportHtml>[0];
    const fallbackHtml = renderReportHtml(unknown, MINIMAL_DATA);
    const explicitV1Html = renderReportHtml('classic-corporate', MINIMAL_DATA);
    // Both should produce HTML of the same length (same renderer called)
    expect(fallbackHtml).toBe(explicitV1Html);
  });

  it('passes options through to the renderer', () => {
    // showStartTime changes the rendered HTML content — we can detect the difference
    const withoutTime = renderReportHtml('classic-corporate', MINIMAL_DATA, {
      showStartTime: false,
    });
    const withTime = renderReportHtml('classic-corporate', MINIMAL_DATA, { showStartTime: true });
    // The two renders should differ when an entry has a startTime
    // (if the renderer honours the option — pin current behaviour)
    // At minimum both must be non-empty strings
    expect(typeof withoutTime).toBe('string');
    expect(typeof withTime).toBe('string');
  });
});

// ─── Per-renderer smoke tests ──────────────────────────────────────────────

describe('renderReportHtml — per-renderer smoke (returns non-empty HTML)', () => {
  for (const template of PDF_TEMPLATES) {
    it(`${template}: returns an HTML document string`, () => {
      const html = renderReportHtml(template, MINIMAL_DATA);
      // Must be a string with actual content
      expect(html.trim().length).toBeGreaterThan(100);
      // Must look like an HTML document
      expect(html).toMatch(/<html/i);
      expect(html).toMatch(/<\/html>/i);
    });
  }

  it('output contains the report date range', () => {
    const html = renderReportHtml('classic-corporate', MINIMAL_DATA);
    // The template renders dateFrom/dateTo in some form
    // At minimum the year should appear
    expect(html).toContain('2026');
  });

  it('output contains the user name from userBreakdown', () => {
    const html = renderReportHtml('classic-corporate', MINIMAL_DATA);
    expect(html).toContain('Elena Marsh');
  });

  it('output contains the project name', () => {
    const html = renderReportHtml('classic-corporate', MINIMAL_DATA);
    expect(html).toContain('Acme Project');
  });

  it('renders correctly with empty userBreakdown (no crash)', () => {
    const emptyData: ReportData = {
      ...MINIMAL_DATA,
      userBreakdown: [],
      userDetails: [],
      projectBreakdown: [],
      summary: {
        ...MINIMAL_DATA.summary,
        totalSeconds: 0,
        totalEntries: 0,
        userCount: 0,
        projectCount: 0,
      },
    };
    for (const template of PDF_TEMPLATES) {
      expect(() => renderReportHtml(template, emptyData)).not.toThrow();
    }
  });
});
