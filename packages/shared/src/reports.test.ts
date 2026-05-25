import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CreateReportTemplateSchema,
  DATE_RANGE_PRESETS,
  GeneratePdfRequestSchema,
  PDF_TEMPLATES,
  PDF_TEMPLATE_META,
  PdfTemplateSchema,
  ReportConfigSchema,
  ReportDataSchema,
  SavedReportTemplateSchema,
  UpdateReportTemplateSchema,
  resolveDateRangePreset,
} from './reports.js';

// Characterization tests — these pin down the CURRENT behavior of reports.ts so
// it can be refactored safely. They document what the code does, not necessarily
// what it "should" do. Date math runs under TZ=UTC (set in the test script) so
// the local-time Date constructors used by the code are deterministic.

describe('resolveDateRangePreset', () => {
  // 2026-05-21 is a Thursday (getDay() === 4).
  const NOW = new Date('2026-05-21T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('this-month spans the first to the last day of the current month', () => {
    expect(resolveDateRangePreset('this-month')).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    });
  });

  it('last-month spans the previous calendar month', () => {
    expect(resolveDateRangePreset('last-month')).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('this-week runs Monday..Sunday containing today (Thu 2026-05-21)', () => {
    expect(resolveDateRangePreset('this-week')).toEqual({
      from: '2026-05-18',
      to: '2026-05-24',
    });
  });

  it('last-week runs the Monday..Sunday before this week', () => {
    expect(resolveDateRangePreset('last-week')).toEqual({
      from: '2026-05-11',
      to: '2026-05-17',
    });
  });

  it('custom throws — must be resolved with explicit dates', () => {
    expect(() => resolveDateRangePreset('custom')).toThrowError(
      'Cannot resolve "custom" preset — use explicit dateFrom/dateTo',
    );
  });

  it('last-month rolls back across a year boundary (January → previous December)', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(resolveDateRangePreset('last-month')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('this-week can span two months (week of Fri 2026-05-01)', () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
    expect(resolveDateRangePreset('this-week')).toEqual({
      from: '2026-04-27',
      to: '2026-05-03',
    });
  });

  it('zero-pads single-digit months and days (isoDate format)', () => {
    vi.setSystemTime(new Date('2026-03-05T12:00:00Z'));
    expect(resolveDateRangePreset('this-month')).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });
});

describe('ReportConfigSchema defaults', () => {
  it('applies defaults for omitted optional fields', () => {
    const parsed = ReportConfigSchema.parse({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      projectIds: [],
      userIds: [],
      clientIds: [],
      tagIds: [],
    });
    expect(parsed).toMatchObject({
      dateRangePreset: 'custom',
      groupBy: 'user',
      showStartTime: false,
      pdfTemplate: 'classic-corporate',
    });
  });

  it('accepts every groupBy value and rejects unknown ones', () => {
    const base = {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      projectIds: [],
      userIds: [],
      clientIds: [],
      tagIds: [],
    };
    for (const groupBy of ['user', 'project', 'date']) {
      expect(ReportConfigSchema.safeParse({ ...base, groupBy }).success).toBe(true);
    }
    expect(ReportConfigSchema.safeParse({ ...base, groupBy: 'client' }).success).toBe(false);
  });

  it('rejects non-uuid ids', () => {
    const result = ReportConfigSchema.safeParse({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      projectIds: ['not-a-uuid'],
      userIds: [],
      clientIds: [],
      tagIds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateReportTemplateSchema', () => {
  const baseConfig = {
    dateFrom: '2026-05-01',
    dateTo: '2026-05-31',
    projectIds: [],
    userIds: [],
    clientIds: [],
    tagIds: [],
  };

  it('defaults isFavorite to false', () => {
    const parsed = CreateReportTemplateSchema.parse({ name: 'Q2', config: baseConfig });
    expect(parsed.isFavorite).toBe(false);
  });

  it('requires a non-empty name (min 1)', () => {
    expect(CreateReportTemplateSchema.safeParse({ name: '', config: baseConfig }).success).toBe(
      false,
    );
  });

  it('rejects names longer than 200 chars (max 200)', () => {
    expect(
      CreateReportTemplateSchema.safeParse({ name: 'x'.repeat(201), config: baseConfig }).success,
    ).toBe(false);
    expect(
      CreateReportTemplateSchema.safeParse({ name: 'x'.repeat(200), config: baseConfig }).success,
    ).toBe(true);
  });
});

describe('PDF template metadata', () => {
  it('exposes exactly the 7 known templates', () => {
    expect(PDF_TEMPLATES).toHaveLength(7);
  });

  it('has metadata for every template and nothing extra', () => {
    expect(Object.keys(PDF_TEMPLATE_META).sort()).toEqual([...PDF_TEMPLATES].sort());
  });

  it('only uses print or screen as medium', () => {
    for (const meta of Object.values(PDF_TEMPLATE_META)) {
      expect(['print', 'screen']).toContain(meta.medium);
    }
  });

  it('PdfTemplateSchema accepts known and rejects unknown templates', () => {
    expect(PdfTemplateSchema.safeParse('classic-corporate').success).toBe(true);
    expect(PdfTemplateSchema.safeParse('nope').success).toBe(false);
  });
});

describe('DATE_RANGE_PRESETS', () => {
  it('lists the five known presets', () => {
    expect(DATE_RANGE_PRESETS).toEqual([
      'this-month',
      'last-month',
      'this-week',
      'last-week',
      'custom',
    ]);
  });
});

// ── Schemas previously untested (closing mutation-testing gaps) ─────────────

const validConfig = {
  dateFrom: '2026-05-01',
  dateTo: '2026-05-31',
  projectIds: [],
  userIds: [],
  clientIds: [],
  tagIds: [],
};
const UUID = '11111111-1111-1111-1111-111111111111';

describe('SavedReportTemplateSchema', () => {
  const valid = {
    id: UUID,
    name: 'Q2 Report',
    config: validConfig,
    isFavorite: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('accepts a full valid template', () => {
    expect(SavedReportTemplateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty object (id/name/config/... are required)', () => {
    expect(SavedReportTemplateSchema.safeParse({}).success).toBe(false);
  });

  it('requires a uuid id and the timestamps', () => {
    expect(SavedReportTemplateSchema.safeParse({ ...valid, id: 'not-a-uuid' }).success).toBe(false);
    const { createdAt, ...noCreatedAt } = valid;
    void createdAt;
    expect(SavedReportTemplateSchema.safeParse(noCreatedAt).success).toBe(false);
  });
});

describe('UpdateReportTemplateSchema', () => {
  it('accepts an empty object (every field optional)', () => {
    expect(UpdateReportTemplateSchema.safeParse({}).success).toBe(true);
  });

  it('enforces the name length bounds when name is present (min 1, max 200)', () => {
    expect(UpdateReportTemplateSchema.safeParse({ name: 'ok' }).success).toBe(true);
    expect(UpdateReportTemplateSchema.safeParse({ name: '' }).success).toBe(false);
    expect(UpdateReportTemplateSchema.safeParse({ name: 'x'.repeat(200) }).success).toBe(true);
    expect(UpdateReportTemplateSchema.safeParse({ name: 'x'.repeat(201) }).success).toBe(false);
  });

  it('validates a provided config', () => {
    expect(UpdateReportTemplateSchema.safeParse({ config: validConfig }).success).toBe(true);
    expect(
      UpdateReportTemplateSchema.safeParse({ config: { ...validConfig, projectIds: ['nope'] } })
        .success,
    ).toBe(false);
  });
});

describe('GeneratePdfRequestSchema', () => {
  it('accepts a known template + valid config', () => {
    expect(
      GeneratePdfRequestSchema.safeParse({ template: 'classic-corporate', config: validConfig })
        .success,
    ).toBe(true);
  });

  it('rejects an empty object and an unknown template', () => {
    expect(GeneratePdfRequestSchema.safeParse({}).success).toBe(false);
    expect(GeneratePdfRequestSchema.safeParse({ template: 'nope', config: validConfig }).success).toBe(
      false,
    );
    expect(GeneratePdfRequestSchema.safeParse({ template: 'classic-corporate' }).success).toBe(false);
  });
});

describe('ReportDataSchema', () => {
  const validReportData = () => ({
    dateFrom: '2026-05-01',
    dateTo: '2026-05-31',
    generatedAt: '2026-05-31T12:00:00Z',
    summary: {
      totalSeconds: 3600,
      totalEntries: 1,
      userCount: 1,
      projectCount: 1,
      workingDays: 20,
    },
    userBreakdown: [
      { userId: 'u1', userName: 'Elena', userAvatarUrl: null, totalSeconds: 3600, percentage: 100, entryCount: 1 },
    ],
    userDetails: [
      {
        userId: 'u1',
        userName: 'Elena',
        userAvatarUrl: null,
        totalSeconds: 3600,
        entryCount: 1,
        daysActive: 1,
        dayGroups: [
          {
            date: '2026-05-20',
            dayTotalSeconds: 3600,
            entries: [
              {
                id: 'e1',
                description: 'Work',
                projectName: 'Web',
                projectColor: '#fff',
                clientName: null,
                jiraIssueKey: null,
                startTime: '09:00',
                durationSeconds: 3600,
              },
            ],
          },
        ],
      },
    ],
    projectBreakdown: [
      { projectId: 'p1', projectName: 'Web', projectColor: '#fff', clientName: null, totalSeconds: 3600, percentage: 100, entryCount: 1 },
    ],
  });

  it('accepts a full valid report payload', () => {
    expect(ReportDataSchema.safeParse(validReportData()).success).toBe(true);
  });

  it('rejects an empty object (top-level fields required)', () => {
    expect(ReportDataSchema.safeParse({}).success).toBe(false);
  });

  it('rejects when the summary is missing a required field', () => {
    const data = validReportData();
    delete (data.summary as { workingDays?: number }).workingDays;
    expect(ReportDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejects when a userBreakdown row is missing percentage', () => {
    const data = validReportData();
    delete (data.userBreakdown[0] as { percentage?: number }).percentage;
    expect(ReportDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejects when a day-group entry is missing durationSeconds', () => {
    const data = validReportData();
    delete (data.userDetails[0]!.dayGroups[0]!.entries[0] as { durationSeconds?: number })
      .durationSeconds;
    expect(ReportDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejects when a projectBreakdown row is missing totalSeconds', () => {
    const data = validReportData();
    delete (data.projectBreakdown[0] as { totalSeconds?: number }).totalSeconds;
    expect(ReportDataSchema.safeParse(data).success).toBe(false);
  });
});
