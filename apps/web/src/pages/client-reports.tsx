import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  Building2,
  Users,
  Eye,
  Download,
  Save,
  Trash2,
  Star,
  Pencil,
  MoreHorizontal,
  Plus,
  X,
  Calendar,
  FileText,
  Clock,
  User,
} from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { scaled } from '@/lib/scaled';
import { apiFetch, apiFetchRaw } from '@/lib/api';
import { useProjects, useUsers } from '@/hooks/use-reference-data';
import { useAdminClients } from '@/hooks/use-admin-projects';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { SelectPopover } from '@/components/ui/select-popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PDF_TEMPLATES,
  PDF_TEMPLATE_META,
  DATE_RANGE_PRESETS,
  resolveDateRangePreset,
  type PdfTemplate,
  type DateRangePreset,
  type ReportData,
  type ReportConfig,
  type SavedReportTemplate,
} from '@ternity/shared';

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// ── API hooks ────────────────────────────────────────────────────────────

function useReportData(config: {
  dateFrom: string;
  dateTo: string;
  projectIds: string[];
  userIds: string[];
  clientIds: string[];
  tagIds: string[];
}) {
  return useQuery<ReportData>({
    queryKey: ['reports', 'data', config],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: config.dateFrom,
        dateTo: config.dateTo,
      });
      if (config.projectIds.length > 0) params.set('projectIds', config.projectIds.join(','));
      if (config.userIds.length > 0) params.set('userIds', config.userIds.join(','));
      if (config.clientIds.length > 0) params.set('clientIds', config.clientIds.join(','));
      if (config.tagIds.length > 0) params.set('tagIds', config.tagIds.join(','));

      return apiFetch<ReportData>(`/reports/data?${params}`);
    },
    enabled: !!config.dateFrom && !!config.dateTo,
  });
}

function useSavedTemplates() {
  return useQuery<SavedReportTemplate[]>({
    queryKey: ['reports', 'templates'],
    queryFn: () => apiFetch<SavedReportTemplate[]>('/reports/templates'),
  });
}

// ── Preview constants ────────────────────────────────────────────────────

// A4 in pixels at 96 dpi
const A4_W = 793.7;
const A4_H = 1122.5;
// Visual padding we want around the page (in screen pixels)
const VISUAL_PAD = 20;

type PreviewFit = 'width' | 'height';

/** CSS injected into iframe — no zoom, natural layout */
const PREVIEW_CSS = `
html, body {
  margin: 0 !important;
  padding: 0 !important;
}
body {
  padding: ${VISUAL_PAD}px !important;
  background: #b0b0b0 !important;
}
.page {
  margin: 0 auto 12px auto !important;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25) !important;
  border-radius: 3px !important;
  page-break-after: auto !important;
}
.page:last-child {
  margin-bottom: 0 !important;
}
`;

/** Compute scale so the A4 page + padding fits the container */
function computeScale(containerW: number, containerH: number, fit: PreviewFit): number {
  // The iframe renders at natural A4 width + padding on both sides
  const naturalW = A4_W + VISUAL_PAD * 2;
  const naturalH = A4_H + VISUAL_PAD * 2;
  if (fit === 'width') return containerW / naturalW;
  return containerH / naturalH;
}

/** Scale the iframe via CSS transform — scrolling stays in the outer container */
function PreviewIframe({ html, fit }: { html: string; fit: PreviewFit }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scaledH, setScaledH] = useState(0);
  const [scale, setScale] = useState(1);

  // Always use the same natural width — A4 page + padding on both sides
  const naturalW = A4_W + VISUAL_PAD * 2;

  useEffect(() => {
    const iframe = iframeRef.current;
    const wrapper = wrapperRef.current;
    if (!iframe || !wrapper || !html) return;

    const containerW = wrapper.clientWidth;
    // Use the scroll container (parent) height for viewport measurement,
    // not the wrapper which may be expanded by previous content.
    const scrollContainer = wrapper.parentElement;
    const containerH = scrollContainer ? scrollContainer.clientHeight : wrapper.clientHeight;
    const s = computeScale(containerW, containerH, fit);
    setScale(s);

    // Write the HTML into the iframe
    const augmented = html.replace('</head>', `<style>${PREVIEW_CSS}</style></head>`);
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(augmented);
    doc.close();

    iframe.style.width = naturalW + 'px';
    iframe.style.overflow = 'hidden';

    // Measure natural content height, compute scaled height for spacer
    const resize = () => {
      if (doc.body) {
        const h = doc.body.scrollHeight;
        iframe.style.height = h + 'px';
        setScaledH(h * s);
      }
    };

    setTimeout(resize, 100);
    setTimeout(resize, 500);
    setTimeout(resize, 2000);
    if (doc.fonts?.ready) {
      doc.fonts.ready.then(() => setTimeout(resize, 50));
    }
  }, [html, fit]);

  // Horizontal offset to center the scaled iframe in the container
  const scaledW = naturalW * scale;

  return (
    <div ref={wrapperRef} className="w-full" style={{ minHeight: '100%' }}>
      <div style={{ height: scaledH, overflow: 'hidden', position: 'relative' }}>
        <iframe
          ref={iframeRef}
          title="Report Preview"
          sandbox="allow-same-origin allow-scripts"
          style={{
            border: 'none',
            display: 'block',
            position: 'absolute',
            left: '50%',
            marginLeft: -(scaledW / 2),
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
          }}
        />
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────

const TEMPLATE_SHORT_LABELS: Record<PdfTemplate, string> = {
  'classic-corporate': 'Classic',
  'dark-executive': 'Executive',
  'minimal-swiss': 'Swiss',
  'magazine-spread': 'Magazine',
  'dashboard-print': 'Dashboard',
  'invoice-style': 'Invoice',
  'cover-chapters': 'Chapters',
};

const PRESET_LABELS: Record<DateRangePreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-week': 'This Week',
  'last-week': 'Last Week',
  custom: 'Custom',
};

export function ClientReportsPage() {
  const initialRange = resolveDateRangePreset('this-month');
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate>('classic-corporate');
  const [showStartTime, setShowStartTime] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'excel'>('pdf');

  // Track which saved template is currently loaded (null = fresh/unsaved)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  /** Select a date range preset — resolves dates and updates both preset + date state */
  const selectPreset = useCallback((preset: DateRangePreset) => {
    if (preset === 'custom') {
      setDateRangePreset('custom');
      return;
    }
    const { from, to } = resolveDateRangePreset(preset);
    setDateRangePreset(preset);
    setDateFrom(from);
    setDateTo(to);
  }, []);

  const {
    data: reportData,
    isLoading,
    error,
  } = useReportData({
    dateFrom,
    dateTo,
    projectIds,
    userIds,
    clientIds,
    tagIds,
  });

  const { data: savedTemplates } = useSavedTemplates();
  const queryClient = useQueryClient();

  // ── Save / delete template mutations ─────────────────────────
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');

  const saveTemplateMutation = useMutation({
    mutationFn: async (body: { name: string; config: ReportConfig; isFavorite?: boolean }) =>
      apiFetch<SavedReportTemplate>('/reports/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
      setShowSaveDialog(false);
      setSaveTemplateName('');
      setActiveTemplateId(saved.id);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch<void>(`/reports/templates/${id}`, { method: 'DELETE' }),
    onSuccess: (_result, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
      if (activeTemplateId === deletedId) setActiveTemplateId(null);
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      apiFetch<SavedReportTemplate>(`/reports/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
    },
  });

  // ── Rename template state ────────────────────────────────────
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const renameTemplateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      apiFetch<SavedReportTemplate>(`/reports/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
      setRenamingTemplateId(null);
    },
  });

  const handleRename = useCallback(() => {
    if (!renamingTemplateId || !renameValue.trim()) return;
    renameTemplateMutation.mutate({ id: renamingTemplateId, name: renameValue.trim() });
  }, [renamingTemplateId, renameValue, renameTemplateMutation]);

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, config }: { id: string; config: ReportConfig }) =>
      apiFetch<SavedReportTemplate>(`/reports/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ config }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
    },
  });

  /** Build the current config snapshot */
  const currentConfig = useMemo(
    (): ReportConfig => ({
      dateFrom,
      dateTo,
      dateRangePreset,
      projectIds,
      userIds,
      clientIds,
      tagIds,
      groupBy: 'user',
      showStartTime,
      pdfTemplate: selectedTemplate,
    }),
    [
      dateFrom,
      dateTo,
      dateRangePreset,
      projectIds,
      userIds,
      clientIds,
      tagIds,
      showStartTime,
      selectedTemplate,
    ],
  );

  /** Check whether a saved template's config differs from current filters */
  const templateHasChanges = useCallback(
    (saved: ReportConfig): boolean => {
      const savedPreset = saved.dateRangePreset ?? 'custom';
      if (currentConfig.dateRangePreset !== savedPreset) return true;
      if (currentConfig.dateRangePreset === 'custom') {
        if (currentConfig.dateFrom !== saved.dateFrom || currentConfig.dateTo !== saved.dateTo)
          return true;
      }
      if (currentConfig.pdfTemplate !== saved.pdfTemplate) return true;
      if ((currentConfig.showStartTime ?? false) !== (saved.showStartTime ?? false)) return true;
      if (JSON.stringify(currentConfig.projectIds) !== JSON.stringify(saved.projectIds))
        return true;
      if (JSON.stringify(currentConfig.userIds) !== JSON.stringify(saved.userIds)) return true;
      if (JSON.stringify(currentConfig.clientIds) !== JSON.stringify(saved.clientIds)) return true;
      if (JSON.stringify(currentConfig.tagIds) !== JSON.stringify(saved.tagIds)) return true;
      return false;
    },
    [currentConfig],
  );

  const handleSaveTemplate = useCallback(() => {
    if (!saveTemplateName.trim()) return;
    const config: ReportConfig = {
      dateFrom,
      dateTo,
      dateRangePreset,
      projectIds,
      userIds,
      clientIds,
      tagIds,
      groupBy: 'user',
      showStartTime,
      pdfTemplate: selectedTemplate,
    };
    saveTemplateMutation.mutate({ name: saveTemplateName.trim(), config });
  }, [
    saveTemplateName,
    dateFrom,
    dateTo,
    dateRangePreset,
    projectIds,
    userIds,
    clientIds,
    tagIds,
    showStartTime,
    selectedTemplate,
    saveTemplateMutation,
  ]);

  // Reference data for filter pickers
  const { data: projects } = useProjects();
  const { data: clients } = useAdminClients();
  const { data: users } = useUsers();

  const projectOptions = useMemo(
    () =>
      (projects ?? []).map((p) => ({
        id: p.id,
        label: p.name,
        color: p.color,
        secondary: p.clientName,
      })),
    [projects],
  );

  const clientOptions = useMemo(
    () =>
      (clients ?? [])
        .filter((c) => c.isActive)
        .map((c) => ({
          id: c.id,
          label: c.name,
        })),
    [clients],
  );

  const userOptions = useMemo(
    () =>
      (users ?? [])
        .filter((u) => u.active)
        .map((u) => ({
          id: u.id,
          label: u.displayName,
        })),
    [users],
  );

  // ── Preview state ──────────────────────────────────────────────
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFit, setPreviewFit] = useState<PreviewFit>('width');

  const fetchPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    try {
      const config: ReportConfig = {
        dateFrom,
        dateTo,
        dateRangePreset,
        projectIds,
        userIds,
        clientIds,
        tagIds,
        groupBy: 'user',
        showStartTime,
        pdfTemplate: selectedTemplate,
      };

      const res = await apiFetchRaw('/reports/preview', {
        method: 'POST',
        body: JSON.stringify({ template: selectedTemplate, config }),
      });

      const html = await res.text();
      setPreviewHtml(html);
      setShowPreview(true);
    } catch {
      setPreviewHtml(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [
    dateFrom,
    dateTo,
    dateRangePreset,
    projectIds,
    userIds,
    clientIds,
    tagIds,
    showStartTime,
    selectedTemplate,
  ]);

  // Auto-refresh preview when template or options change (if preview is already open)
  const prevConfigRef = useRef({ selectedTemplate, showStartTime });
  useEffect(() => {
    const prev = prevConfigRef.current;
    if (
      (prev.selectedTemplate !== selectedTemplate || prev.showStartTime !== showStartTime) &&
      showPreview &&
      reportData
    ) {
      prevConfigRef.current = { selectedTemplate, showStartTime };
      fetchPreview();
    }
  }, [selectedTemplate, showStartTime, showPreview, reportData, fetchPreview]);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const config: ReportConfig = {
        dateFrom,
        dateTo,
        dateRangePreset,
        projectIds,
        userIds,
        clientIds,
        tagIds,
        groupBy: 'user',
        showStartTime,
        pdfTemplate: selectedTemplate,
      };

      const res = await apiFetchRaw('/reports/pdf', {
        method: 'POST',
        body: JSON.stringify({ template: selectedTemplate, config }),
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ternity-report-${dateFrom}-${dateTo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  }, [dateFrom, dateTo, dateRangePreset, projectIds, userIds, clientIds, tagIds, selectedTemplate]);

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h1
          className="font-brand font-semibold tracking-wide text-foreground"
          style={{ fontSize: scaled(18) }}
        >
          Client Reports
        </h1>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
          Generate branded PDF time reports for your clients
        </p>
      </div>

      {/* Filter bar */}
      <div
        className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
        style={{ fontSize: scaled(12) }}
      >
        {/* Date range preset toggle group */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {DATE_RANGE_PRESETS.filter(
            (p) => p !== 'custom' && p !== 'this-week' && p !== 'last-week',
          ).map((preset) => (
            <button
              key={preset}
              onClick={() => selectPreset(preset)}
              className="px-2.5 py-1 transition-colors border-r border-border last:border-r-0"
              style={{
                fontSize: scaled(11),
                backgroundColor:
                  dateRangePreset === preset ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                color: dateRangePreset === preset ? '#00D4AA' : 'hsl(var(--muted-foreground))',
                fontWeight: dateRangePreset === preset ? 600 : 400,
              }}
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}
        </div>

        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            setDateRangePreset('custom');
          }}
          className="w-auto"
        />

        <div className="h-5 w-px bg-border" />

        <MultiSelectCombobox
          value={projectIds}
          onChange={setProjectIds}
          options={projectOptions}
          placeholder="Projects"
          icon={FolderKanban}
          searchPlaceholder="Search projects..."
          emptyMessage="No projects found."
        />

        <MultiSelectCombobox
          value={clientIds}
          onChange={setClientIds}
          options={clientOptions}
          placeholder="Clients"
          icon={Building2}
          searchPlaceholder="Search clients..."
          emptyMessage="No clients found."
        />

        <MultiSelectCombobox
          value={userIds}
          onChange={setUserIds}
          options={userOptions}
          placeholder="Users"
          icon={Users}
          searchPlaceholder="Search users..."
          emptyMessage="No users found."
        />

        <div className="h-5 w-px bg-border" />

        <SelectPopover
          value={exportFormat}
          onChange={(v) => setExportFormat(v as 'pdf' | 'csv' | 'excel')}
          items={[
            { value: 'pdf', label: 'PDF' },
            { value: 'csv', label: 'CSV' },
            { value: 'excel', label: 'Excel' },
          ]}
          placeholder="Format"
          compact
        />

        {exportFormat === 'pdf' && (
          <SelectPopover
            value={selectedTemplate}
            onChange={(v) => setSelectedTemplate(v as PdfTemplate)}
            items={[
              ...PDF_TEMPLATES.filter((id) => PDF_TEMPLATE_META[id].medium === 'print').map(
                (id) => ({
                  value: id,
                  label: TEMPLATE_SHORT_LABELS[id],
                  group: 'Print',
                }),
              ),
              ...PDF_TEMPLATES.filter((id) => PDF_TEMPLATE_META[id].medium === 'screen').map(
                (id) => ({
                  value: id,
                  label: TEMPLATE_SHORT_LABELS[id],
                  group: 'Screen',
                }),
              ),
            ]}
            placeholder="Template"
            compact
          />
        )}

        <label
          className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
          style={{ fontSize: scaled(11) }}
        >
          <input
            type="checkbox"
            checked={showStartTime}
            onChange={(e) => setShowStartTime(e.target.checked)}
            className="accent-[#00D4AA]"
          />
          Times
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex items-center justify-center rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            disabled={!reportData || isLoadingPreview}
            onClick={fetchPreview}
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            className="flex items-center justify-center rounded-md border border-border p-1.5 transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              color: isDownloading ? 'hsl(var(--muted-foreground))' : '#00D4AA',
            }}
            disabled={!reportData || isDownloading}
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) 360px' }}>
        {/* Data preview */}
        <div className="min-w-0 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Loading report data...
            </div>
          )}

          {error && (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive"
              style={{ fontSize: scaled(12) }}
            >
              Failed to load report data. Check your filters and try again.
            </div>
          )}

          {reportData && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Hours', value: formatHours(reportData.summary.totalSeconds) },
                  { label: 'Entries', value: String(reportData.summary.totalEntries) },
                  { label: 'Team', value: String(reportData.summary.userCount) },
                  { label: 'Projects', value: String(reportData.summary.projectCount) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
                    <div
                      className="text-muted-foreground"
                      style={{
                        fontSize: scaled(10),
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {stat.label}
                    </div>
                    <div
                      className="font-brand mt-1 font-bold text-foreground"
                      style={{ fontSize: scaled(20) }}
                    >
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* User breakdown */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3
                  className="font-brand mb-3 font-semibold tracking-wide text-foreground"
                  style={{ fontSize: scaled(13) }}
                >
                  Team Composition
                </h3>

                {/* Stacked bar */}
                <div className="mb-4 flex h-3 overflow-hidden rounded-full">
                  {reportData.userBreakdown.map((u, i) => {
                    const colors = [
                      '#00D4AA',
                      '#6C8EEF',
                      '#F5A623',
                      '#E05C6E',
                      '#9B59B6',
                      '#3498DB',
                    ];
                    return (
                      <div
                        key={u.userId}
                        style={{
                          width: `${u.percentage}%`,
                          backgroundColor: colors[i % colors.length],
                        }}
                        title={`${u.userName}: ${u.percentage}%`}
                      />
                    );
                  })}
                </div>

                {/* Legend table (static) */}
                <div className="space-y-2">
                  {reportData.userBreakdown.map((u, i) => {
                    const colors = [
                      '#00D4AA',
                      '#6C8EEF',
                      '#F5A623',
                      '#E05C6E',
                      '#9B59B6',
                      '#3498DB',
                    ];
                    return (
                      <a
                        key={u.userId}
                        href={`#user-${u.userId}`}
                        className="flex items-center gap-3 rounded px-1 py-0.5 hover:bg-accent/50"
                        style={{ fontSize: scaled(12) }}
                      >
                        <div
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: colors[i % colors.length] }}
                        />
                        <span className="flex-1 text-foreground">{u.userName}</span>
                        <span className="font-brand font-semibold text-foreground">
                          {formatHours(u.totalSeconds)}
                        </span>
                        <span
                          className="text-muted-foreground"
                          style={{ minWidth: 40, textAlign: 'right' }}
                        >
                          {u.percentage}%
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* User details (all collapsed by default) */}
              {reportData.userDetails.map((user) => (
                <details
                  key={user.userId}
                  id={`user-${user.userId}`}
                  className="min-w-0 rounded-lg border border-border bg-card"
                >
                  <summary
                    className="flex cursor-pointer items-center gap-3 p-3 hover:bg-accent/50 rounded-lg"
                    style={{ fontSize: scaled(12) }}
                  >
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-brand text-xs font-bold"
                      style={{ backgroundColor: '#00D4AA', color: '#0a0a0a' }}
                    >
                      {user.userName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{user.userName}</div>
                      <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
                        {user.entryCount} entries &middot; {user.daysActive} days active
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-brand font-bold"
                        style={{ color: '#00D4AA', fontSize: scaled(16) }}
                      >
                        {formatHours(user.totalSeconds)}
                      </div>
                    </div>
                  </summary>
                  <div className="min-w-0 space-y-1 overflow-hidden border-t border-border px-3 pb-3 pt-2">
                    {user.dayGroups.map((dg) => (
                      <div key={dg.date}>
                        <div
                          className="flex items-center justify-between gap-2 rounded bg-accent/30 px-2 py-1"
                          style={{ fontSize: scaled(11) }}
                        >
                          <span className="min-w-0 truncate font-semibold text-foreground">
                            {new Date(dg.date + 'T12:00:00Z').toLocaleDateString('en-US', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                          <span
                            className="flex-shrink-0 whitespace-nowrap font-brand font-semibold"
                            style={{ color: '#00D4AA' }}
                          >
                            {formatDuration(dg.dayTotalSeconds)}
                          </span>
                        </div>
                        {dg.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-border/50 px-2 py-1.5"
                            style={{ fontSize: scaled(11) }}
                          >
                            <span
                              className="flex-shrink-0 text-muted-foreground"
                              style={{ width: 36 }}
                            >
                              {entry.startTime}
                            </span>
                            <div
                              className="flex flex-shrink-0 items-center gap-1.5"
                              style={{ maxWidth: 120 }}
                            >
                              <div
                                className="h-2 w-2 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: entry.projectColor }}
                              />
                              <span className="truncate text-muted-foreground">
                                {entry.projectName}
                              </span>
                            </div>
                            <span className="min-w-0 flex-1 truncate text-foreground">
                              {entry.description}
                            </span>
                            {entry.jiraIssueKey && (
                              <span
                                className="flex-shrink-0 whitespace-nowrap rounded bg-primary/10 px-1.5 py-0.5 text-primary"
                                style={{ fontSize: scaled(9) }}
                              >
                                {entry.jiraIssueKey}
                              </span>
                            )}
                            <span
                              className="flex-shrink-0 whitespace-nowrap font-brand font-semibold text-foreground"
                              style={{ width: 60, textAlign: 'right' }}
                            >
                              {formatDuration(entry.durationSeconds)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </>
          )}
        </div>

        {/* Sidebar: favourites + save */}
        <div className="space-y-4">
          {downloadError && (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive"
              style={{ fontSize: scaled(11) }}
            >
              {downloadError}
            </div>
          )}

          {/* Favourites card */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <h3
                className="font-brand flex-1 font-semibold tracking-wide text-foreground"
                style={{ fontSize: scaled(12) }}
              >
                Favourites
              </h3>
              {activeTemplateId ? (
                (() => {
                  const activeTpl = savedTemplates?.find((t) => t.id === activeTemplateId);
                  const hasChanges = activeTpl ? templateHasChanges(activeTpl.config) : false;
                  return (
                    <button
                      className="flex items-center gap-1.5 rounded px-2 py-1 transition-colors"
                      style={{
                        fontSize: scaled(10),
                        color: hasChanges ? '#00D4AA' : 'hsl(var(--muted-foreground) / 0.3)',
                        cursor: hasChanges ? 'pointer' : 'default',
                      }}
                      disabled={!hasChanges || updateTemplateMutation.isPending}
                      onClick={() => {
                        if (hasChanges && activeTpl) {
                          updateTemplateMutation.mutate({
                            id: activeTpl.id,
                            config: currentConfig,
                          });
                        }
                      }}
                      title={hasChanges ? 'Save changes to this favourite' : 'No changes to save'}
                    >
                      <Save className="h-3 w-3" />
                      Save
                    </button>
                  );
                })()
              ) : (
                <button
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  style={{ fontSize: scaled(10) }}
                  onClick={() => setShowSaveDialog(true)}
                  title="Save current filters as new favourite"
                >
                  <Plus className="h-3 w-3" />
                  Add new
                </button>
              )}
            </div>
            {savedTemplates && savedTemplates.length > 0 ? (
              <div className="space-y-1">
                {savedTemplates.map((t) => {
                  const isActive = t.id === activeTemplateId;
                  const cfg = t.config;

                  return (
                    <div
                      key={t.id}
                      className="cursor-pointer rounded border px-2 py-1.5 transition-colors hover:bg-accent/30"
                      style={{
                        fontSize: scaled(11),
                        borderColor: isActive ? 'hsl(var(--primary))' : 'hsl(var(--border) / 0.5)',
                      }}
                      onClick={() => {
                        if (isActive) {
                          setActiveTemplateId(null);
                          return;
                        }
                        const preset = cfg.dateRangePreset ?? 'custom';
                        if (preset !== 'custom') {
                          const { from, to } = resolveDateRangePreset(preset);
                          setDateFrom(from);
                          setDateTo(to);
                        } else {
                          setDateFrom(cfg.dateFrom);
                          setDateTo(cfg.dateTo);
                        }
                        setDateRangePreset(preset);
                        setProjectIds(cfg.projectIds);
                        setUserIds(cfg.userIds);
                        setClientIds(cfg.clientIds);
                        setTagIds(cfg.tagIds);
                        setShowStartTime(cfg.showStartTime ?? false);
                        setSelectedTemplate(cfg.pdfTemplate);
                        setActiveTemplateId(t.id);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          className="flex-shrink-0 transition-colors hover:text-yellow-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteMutation.mutate({
                              id: t.id,
                              isFavorite: !t.isFavorite,
                            });
                          }}
                          title={t.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            className="h-3.5 w-3.5"
                            style={{
                              fill: t.isFavorite ? '#facc15' : 'none',
                              color: t.isFavorite ? '#facc15' : 'hsl(var(--muted-foreground))',
                            }}
                          />
                        </button>
                        <span className="flex flex-1 items-center gap-1 truncate text-left text-foreground">
                          {t.name}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                              title="More actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              onClick={() => {
                                setRenamingTemplateId(t.id);
                                setRenameValue(t.name);
                              }}
                              style={{ fontSize: scaled(11) }}
                            >
                              <Pencil className="mr-2 h-3 w-3" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteTemplateMutation.mutate(t.id)}
                              style={{ fontSize: scaled(11) }}
                            >
                              <Trash2 className="mr-2 h-3 w-3" />
                              Delete
                            </DropdownMenuItem>
                            {isActive && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setActiveTemplateId(null)}
                                  style={{ fontSize: scaled(11) }}
                                >
                                  <X className="mr-2 h-3 w-3" />
                                  Close
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {isActive &&
                        (() => {
                          const savedPreset = cfg.dateRangePreset ?? 'custom';
                          const dateChanged =
                            dateRangePreset !== savedPreset ||
                            (dateRangePreset === 'custom' &&
                              (dateFrom !== cfg.dateFrom || dateTo !== cfg.dateTo));
                          const templateChanged = selectedTemplate !== cfg.pdfTemplate;
                          const timesChanged = showStartTime !== (cfg.showStartTime ?? false);

                          // Projects: current, saved, added, removed
                          const savedProjSet = new Set(cfg.projectIds);
                          const curProjSet = new Set(projectIds);
                          const removedProjects = cfg.projectIds.filter(
                            (id) => !curProjSet.has(id),
                          );
                          const addedProjects = projectIds.filter((id) => !savedProjSet.has(id));
                          const keptProjects = projectIds.filter((id) => savedProjSet.has(id));

                          // Clients
                          const savedCliSet = new Set(cfg.clientIds);
                          const curCliSet = new Set(clientIds);
                          const removedClients = cfg.clientIds.filter((id) => !curCliSet.has(id));
                          const addedClients = clientIds.filter((id) => !savedCliSet.has(id));
                          const keptClients = clientIds.filter((id) => savedCliSet.has(id));

                          // Users
                          const savedUsrSet = new Set(cfg.userIds);
                          const curUsrSet = new Set(userIds);
                          const removedUsers = cfg.userIds.filter((id) => !curUsrSet.has(id));
                          const addedUsers = userIds.filter((id) => !savedUsrSet.has(id));
                          const keptUsers = userIds.filter((id) => savedUsrSet.has(id));

                          const badgeBase = 'inline-flex items-center gap-1 rounded px-1.5 py-0.5';
                          const unchanged = `${badgeBase} bg-accent/50 text-muted-foreground`;
                          const added = `${badgeBase} bg-primary/15 text-primary`;
                          const removed = `${badgeBase} bg-destructive/10 text-muted-foreground/50 line-through`;

                          return (
                            <div
                              className="mt-1.5 flex flex-wrap gap-1"
                              style={{ fontSize: scaled(9) }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Date range */}
                              <span className={dateChanged ? added : unchanged}>
                                <Calendar className="h-2 w-2 flex-shrink-0" />
                                {dateRangePreset !== 'custom'
                                  ? PRESET_LABELS[dateRangePreset]
                                  : `${dateFrom} — ${dateTo}`}
                              </span>

                              {/* Template */}
                              <span className={templateChanged ? added : unchanged}>
                                <FileText className="h-2 w-2 flex-shrink-0" />
                                {PDF_TEMPLATE_META[selectedTemplate]?.name ?? selectedTemplate}
                              </span>

                              {/* Times */}
                              {showStartTime && (
                                <span className={timesChanged ? added : unchanged}>
                                  <Clock className="h-2 w-2 flex-shrink-0" />
                                  Times
                                  <button
                                    className="hover:text-foreground"
                                    onClick={() => setShowStartTime(false)}
                                  >
                                    <X className="h-2 w-2" />
                                  </button>
                                </span>
                              )}
                              {!showStartTime && (cfg.showStartTime ?? false) && (
                                <span className={removed}>
                                  <Clock className="h-2 w-2 flex-shrink-0" />
                                  Times
                                </span>
                              )}

                              {/* Projects — kept */}
                              {keptProjects.map((id) => {
                                const name = projects?.find((p) => p.id === id)?.name ?? id;
                                return (
                                  <span key={`p-${id}`} className={unchanged}>
                                    <FolderKanban className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                    <button
                                      className="hover:text-foreground"
                                      onClick={() =>
                                        setProjectIds((prev) => prev.filter((x) => x !== id))
                                      }
                                    >
                                      <X className="h-2 w-2" />
                                    </button>
                                  </span>
                                );
                              })}
                              {/* Projects — added */}
                              {addedProjects.map((id) => {
                                const name = projects?.find((p) => p.id === id)?.name ?? id;
                                return (
                                  <span key={`p-${id}`} className={added}>
                                    <FolderKanban className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                    <button
                                      className="hover:text-foreground"
                                      onClick={() =>
                                        setProjectIds((prev) => prev.filter((x) => x !== id))
                                      }
                                    >
                                      <X className="h-2 w-2" />
                                    </button>
                                  </span>
                                );
                              })}
                              {/* Projects — removed */}
                              {removedProjects.map((id) => {
                                const name = projects?.find((p) => p.id === id)?.name ?? id;
                                return (
                                  <span key={`p-${id}`} className={removed}>
                                    <FolderKanban className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                  </span>
                                );
                              })}

                              {/* Clients — kept */}
                              {keptClients.map((id) => {
                                const name = clients?.find((c) => c.id === id)?.name ?? id;
                                return (
                                  <span key={`c-${id}`} className={unchanged}>
                                    <Building2 className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                    <button
                                      className="hover:text-foreground"
                                      onClick={() =>
                                        setClientIds((prev) => prev.filter((x) => x !== id))
                                      }
                                    >
                                      <X className="h-2 w-2" />
                                    </button>
                                  </span>
                                );
                              })}
                              {addedClients.map((id) => {
                                const name = clients?.find((c) => c.id === id)?.name ?? id;
                                return (
                                  <span key={`c-${id}`} className={added}>
                                    <Building2 className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                    <button
                                      className="hover:text-foreground"
                                      onClick={() =>
                                        setClientIds((prev) => prev.filter((x) => x !== id))
                                      }
                                    >
                                      <X className="h-2 w-2" />
                                    </button>
                                  </span>
                                );
                              })}
                              {removedClients.map((id) => {
                                const name = clients?.find((c) => c.id === id)?.name ?? id;
                                return (
                                  <span key={`c-${id}`} className={removed}>
                                    <Building2 className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                  </span>
                                );
                              })}

                              {/* Users — kept */}
                              {keptUsers.map((id) => {
                                const name = users?.find((u) => u.id === id)?.displayName ?? id;
                                return (
                                  <span key={`u-${id}`} className={unchanged}>
                                    <User className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                    <button
                                      className="hover:text-foreground"
                                      onClick={() =>
                                        setUserIds((prev) => prev.filter((x) => x !== id))
                                      }
                                    >
                                      <X className="h-2 w-2" />
                                    </button>
                                  </span>
                                );
                              })}
                              {addedUsers.map((id) => {
                                const name = users?.find((u) => u.id === id)?.displayName ?? id;
                                return (
                                  <span key={`u-${id}`} className={added}>
                                    <User className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                    <button
                                      className="hover:text-foreground"
                                      onClick={() =>
                                        setUserIds((prev) => prev.filter((x) => x !== id))
                                      }
                                    >
                                      <X className="h-2 w-2" />
                                    </button>
                                  </span>
                                );
                              })}
                              {removedUsers.map((id) => {
                                const name = users?.find((u) => u.id === id)?.displayName ?? id;
                                return (
                                  <span key={`u-${id}`} className={removed}>
                                    <User className="h-2 w-2 flex-shrink-0" />
                                    {name}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground"
                style={{ fontSize: scaled(11) }}
              >
                <Star className="h-5 w-5" style={{ color: 'hsl(var(--muted-foreground) / 0.3)' }} />
                <p>No favourites yet</p>
                <p style={{ fontSize: scaled(9) }}>
                  Save your current filters to quickly load them later.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Preview modal ───────────────────────────────────────────── */}
      <Dialog
        open={showPreview && !!previewHtml}
        onOpenChange={(open) => !open && setShowPreview(false)}
      >
        <DialogContent
          overlayClassName="preview-overlay"
          className="preview-dialog flex h-[95vh] max-w-[1100px] flex-col gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="flex-shrink-0 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-4 pr-8">
              <DialogTitle className="font-brand text-sm tracking-wide">
                Preview — {PDF_TEMPLATE_META[selectedTemplate].name}
              </DialogTitle>
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setPreviewFit('width')}
                  className={`rounded px-2 py-0.5 transition-colors ${
                    previewFit === 'width' ? 'bg-muted text-foreground' : 'hover:text-foreground'
                  }`}
                >
                  Fit width
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={() => setPreviewFit('height')}
                  className={`rounded px-2 py-0.5 transition-colors ${
                    previewFit === 'height' ? 'bg-muted text-foreground' : 'hover:text-foreground'
                  }`}
                >
                  Fit height
                </button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-[#b0b0b0]">
            {previewHtml && <PreviewIframe html={previewHtml} fit={previewFit} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Save template dialog ────────────────────────────────────── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-brand tracking-wide">Save Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label
                className="mb-1.5 block text-muted-foreground"
                style={{ fontSize: scaled(11) }}
              >
                Template name
              </label>
              <input
                type="text"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g. Acme Corp — Monthly"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                style={{ fontSize: scaled(12) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTemplate();
                }}
                autoFocus
              />
            </div>
            <div className="rounded-lg bg-accent/30 p-3" style={{ fontSize: scaled(10) }}>
              <div className="mb-1 font-semibold text-muted-foreground">
                Configuration includes:
              </div>
              <div className="text-muted-foreground">
                Date range:{' '}
                {dateRangePreset !== 'custom'
                  ? `${PRESET_LABELS[dateRangePreset]} (resolves dynamically)`
                  : `${dateFrom} to ${dateTo}`}
                {projectIds.length > 0 && ` · ${projectIds.length} project(s)`}
                {clientIds.length > 0 && ` · ${clientIds.length} client(s)`}
                {userIds.length > 0 && ` · ${userIds.length} user(s)`}
                {' · '}Template: {PDF_TEMPLATE_META[selectedTemplate].name}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-accent"
                style={{ fontSize: scaled(12) }}
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg px-4 py-2 font-semibold transition-colors"
                style={{
                  backgroundColor: '#00D4AA',
                  color: '#0a0a0a',
                  fontSize: scaled(12),
                  opacity: !saveTemplateName.trim() || saveTemplateMutation.isPending ? 0.5 : 1,
                }}
                disabled={!saveTemplateName.trim() || saveTemplateMutation.isPending}
                onClick={handleSaveTemplate}
              >
                {saveTemplateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rename dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!renamingTemplateId}
        onOpenChange={(open) => !open && setRenamingTemplateId(null)}
      >
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-brand tracking-wide">Rename Favourite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label
                className="mb-1.5 block text-muted-foreground"
                style={{ fontSize: scaled(11) }}
              >
                Name
              </label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="e.g. Acme Corp — Monthly"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                style={{ fontSize: scaled(12) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-accent"
                style={{ fontSize: scaled(12) }}
                onClick={() => setRenamingTemplateId(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg px-4 py-2 font-semibold transition-colors"
                style={{
                  backgroundColor: '#00D4AA',
                  color: '#0a0a0a',
                  fontSize: scaled(12),
                  opacity: !renameValue.trim() || renameTemplateMutation.isPending ? 0.5 : 1,
                }}
                disabled={!renameValue.trim() || renameTemplateMutation.isPending}
                onClick={handleRename}
              >
                {renameTemplateMutation.isPending ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
