import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CreateReportTemplateSchema,
  DATE_RANGE_PRESETS,
  PDF_TEMPLATES,
  PDF_TEMPLATE_META,
  PdfTemplateSchema,
  ReportConfigSchema,
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
