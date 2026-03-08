import { z } from 'zod';

// ── PDF Template identifiers ──────────────────────────────────────────────

export const PDF_TEMPLATES = [
  'classic-corporate',
  'dark-executive',
  'minimal-swiss',
  'magazine-spread',
  'dashboard-print',
  'invoice-style',
  'cover-chapters',
] as const;

export type PdfTemplate = (typeof PDF_TEMPLATES)[number];

export const PdfTemplateSchema = z.enum(PDF_TEMPLATES);

export const PDF_TEMPLATE_META: Record<
  PdfTemplate,
  { name: string; description: string; medium: 'print' | 'screen' }
> = {
  'classic-corporate': {
    name: 'Classic Corporate',
    description: 'Traditional table-heavy layout with repeating header/footer',
    medium: 'print',
  },
  'dark-executive': {
    name: 'Dark Executive',
    description: 'Dark background with teal accents, premium SaaS feel',
    medium: 'screen',
  },
  'minimal-swiss': {
    name: 'Minimal Swiss',
    description: 'Ultra-clean typography, no cards or borders',
    medium: 'print',
  },
  'magazine-spread': {
    name: 'Magazine Spread',
    description: 'Two-column cover with editorial layout and infographics',
    medium: 'print',
  },
  'dashboard-print': {
    name: 'Dashboard Print',
    description: 'Web dashboard on paper — cards, rounded corners, light theme',
    medium: 'print',
  },
  'invoice-style': {
    name: 'Invoice Style',
    description: 'Dense, utilitarian, maximum data per page with signature block',
    medium: 'print',
  },
  'cover-chapters': {
    name: 'Cover + Chapters',
    description: 'Dark cover page, table of contents, chapter-style breaks',
    medium: 'screen',
  },
};

// ── Date range presets ─────────────────────────────────────────────────────

export const DATE_RANGE_PRESETS = [
  'this-month',
  'last-month',
  'this-week',
  'last-week',
  'custom',
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const DateRangePresetSchema = z.enum(DATE_RANGE_PRESETS);

/** Resolve a preset to concrete ISO date strings (YYYY-MM-DD). */
export function resolveDateRangePreset(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date();
  switch (preset) {
    case 'this-month': {
      const y = now.getFullYear();
      const m = now.getMonth();
      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 0);
      return { from: isoDate(from), to: isoDate(to) };
    }
    case 'last-month': {
      const y = now.getFullYear();
      const m = now.getMonth() - 1;
      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 0);
      return { from: isoDate(from), to: isoDate(to) };
    }
    case 'this-week': {
      const day = now.getDay(); // 0=Sun
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: isoDate(monday), to: isoDate(sunday) };
    }
    case 'last-week': {
      const day = now.getDay();
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - ((day + 6) % 7));
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { from: isoDate(lastMonday), to: isoDate(lastSunday) };
    }
    case 'custom':
      throw new Error('Cannot resolve "custom" preset — use explicit dateFrom/dateTo');
  }
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Report config (saved template shape) ──────────────────────────────────

export const ReportConfigSchema = z.object({
  dateFrom: z.string(), // ISO date YYYY-MM-DD
  dateTo: z.string(), // ISO date YYYY-MM-DD
  dateRangePreset: DateRangePresetSchema.optional().default('custom'),
  projectIds: z.array(z.string().uuid()),
  userIds: z.array(z.string().uuid()),
  clientIds: z.array(z.string().uuid()),
  tagIds: z.array(z.string().uuid()),
  groupBy: z.enum(['user', 'project', 'date']).default('user'),
  showStartTime: z.boolean().optional().default(false),
  pdfTemplate: PdfTemplateSchema.default('classic-corporate'),
});

export type ReportConfig = z.infer<typeof ReportConfigSchema>;

// ── Report data response ──────────────────────────────────────────────────

const ReportEntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  projectName: z.string(),
  projectColor: z.string(),
  clientName: z.string().nullable(),
  jiraIssueKey: z.string().nullable(),
  startTime: z.string(), // HH:MM
  durationSeconds: z.number(),
});

const ReportDayGroupSchema = z.object({
  date: z.string(),
  dayTotalSeconds: z.number(),
  entries: z.array(ReportEntrySchema),
});

const ReportUserDetailSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userAvatarUrl: z.string().nullable(),
  totalSeconds: z.number(),
  entryCount: z.number(),
  daysActive: z.number(),
  dayGroups: z.array(ReportDayGroupSchema),
});

const ReportUserBreakdownSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userAvatarUrl: z.string().nullable(),
  totalSeconds: z.number(),
  percentage: z.number(),
  entryCount: z.number(),
});

const ReportProjectBreakdownSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  projectColor: z.string(),
  clientName: z.string().nullable(),
  totalSeconds: z.number(),
  percentage: z.number(),
  entryCount: z.number(),
});

const ReportSummarySchema = z.object({
  totalSeconds: z.number(),
  totalEntries: z.number(),
  userCount: z.number(),
  projectCount: z.number(),
  workingDays: z.number(),
});

export const ReportDataSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  generatedAt: z.string(),
  summary: ReportSummarySchema,
  userBreakdown: z.array(ReportUserBreakdownSchema),
  userDetails: z.array(ReportUserDetailSchema),
  projectBreakdown: z.array(ReportProjectBreakdownSchema),
});

export type ReportData = z.infer<typeof ReportDataSchema>;
export type ReportEntry = z.infer<typeof ReportEntrySchema>;
export type ReportDayGroup = z.infer<typeof ReportDayGroupSchema>;
export type ReportUserDetail = z.infer<typeof ReportUserDetailSchema>;

// ── Saved template CRUD schemas ───────────────────────────────────────────

export const SavedReportTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  config: ReportConfigSchema,
  isFavorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SavedReportTemplate = z.infer<typeof SavedReportTemplateSchema>;

export const CreateReportTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  config: ReportConfigSchema,
  isFavorite: z.boolean().optional().default(false),
});

export const UpdateReportTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config: ReportConfigSchema.optional(),
  isFavorite: z.boolean().optional(),
});

export const GeneratePdfRequestSchema = z.object({
  template: PdfTemplateSchema,
  config: ReportConfigSchema,
});
