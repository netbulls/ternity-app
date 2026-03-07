import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Building2, Users, Eye, Save, Trash2, Star } from 'lucide-react';
import { scaled } from '@/lib/scaled';
import { apiFetch, apiFetchRaw } from '@/lib/api';
import { useProjects, useUsers } from '@/hooks/use-reference-data';
import { useAdminClients } from '@/hooks/use-admin-projects';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  PDF_TEMPLATES,
  PDF_TEMPLATE_META,
  type PdfTemplate,
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
  return (seconds / 3600).toFixed(1) + 'h';
}

function getMonthPreset(offset: number): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset; // 0-indexed
  const d = new Date(year, month, 1);
  const from = d.toISOString().slice(0, 10);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
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

export function ClientReportsPage() {
  const lastMonth = getMonthPreset(0);
  const [dateFrom, setDateFrom] = useState(lastMonth.from);
  const [dateTo, setDateTo] = useState(lastMonth.to);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate>('classic-corporate');

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
      setShowSaveDialog(false);
      setSaveTemplateName('');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch<void>(`/reports/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
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

  const handleSaveTemplate = useCallback(() => {
    if (!saveTemplateName.trim()) return;
    const config: ReportConfig = {
      dateFrom,
      dateTo,
      projectIds,
      userIds,
      clientIds,
      tagIds,
      groupBy: 'user',
      pdfTemplate: selectedTemplate,
    };
    saveTemplateMutation.mutate({ name: saveTemplateName.trim(), config });
  }, [
    saveTemplateName,
    dateFrom,
    dateTo,
    projectIds,
    userIds,
    clientIds,
    tagIds,
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
        projectIds,
        userIds,
        clientIds,
        tagIds,
        groupBy: 'user',
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
  }, [dateFrom, dateTo, projectIds, userIds, clientIds, tagIds, selectedTemplate]);

  // Auto-refresh preview when template changes (if preview is already open)
  const prevTemplateRef = useRef(selectedTemplate);
  useEffect(() => {
    if (prevTemplateRef.current !== selectedTemplate && showPreview && reportData) {
      prevTemplateRef.current = selectedTemplate;
      fetchPreview();
    }
  }, [selectedTemplate, showPreview, reportData, fetchPreview]);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const config: ReportConfig = {
        dateFrom,
        dateTo,
        projectIds,
        userIds,
        clientIds,
        tagIds,
        groupBy: 'user',
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
  }, [dateFrom, dateTo, projectIds, userIds, clientIds, tagIds, selectedTemplate]);

  const presets = useMemo(
    () => [
      { label: 'This Month', ...getMonthPreset(0) },
      { label: 'Last Month', ...getMonthPreset(-1) },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1
          className="font-brand font-semibold tracking-wide text-foreground"
          style={{ fontSize: scaled(18) }}
        >
          Client Reports
        </h1>
        <p className="mt-1 text-muted-foreground" style={{ fontSize: scaled(12) }}>
          Generate branded PDF time reports for your clients
        </p>
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
        style={{ fontSize: scaled(12) }}
      >
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-foreground"
            style={{ fontSize: scaled(12) }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-foreground"
            style={{ fontSize: scaled(12) }}
          />
        </div>
        <div className="flex gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setDateFrom(p.from);
                setDateTo(p.to);
              }}
              className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              style={{ fontSize: scaled(11) }}
            >
              {p.label}
            </button>
          ))}
        </div>

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
      </div>

      {/* Content area */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
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

                {/* Legend table */}
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
                      <div
                        key={u.userId}
                        className="flex items-center gap-3"
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
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User details (collapsed by default, first user expanded) */}
              {reportData.userDetails.map((user, idx) => (
                <details key={user.userId} open={idx === 0} className="min-w-0">
                  <summary
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent/50"
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
                  <div className="mt-2 min-w-0 space-y-1 overflow-hidden pl-11">
                    {user.dayGroups.map((dg) => (
                      <div key={dg.date}>
                        <div
                          className="flex items-center justify-between rounded bg-accent/30 px-2 py-1"
                          style={{ fontSize: scaled(11) }}
                        >
                          <span className="font-semibold text-foreground">
                            {new Date(dg.date + 'T12:00:00Z').toLocaleDateString('en-US', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="font-brand font-semibold" style={{ color: '#00D4AA' }}>
                            {formatDuration(dg.dayTotalSeconds)}
                          </span>
                        </div>
                        {dg.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-2 border-b border-border/50 px-2 py-1.5"
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
                                className="flex-shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-primary"
                                style={{ fontSize: scaled(9) }}
                              >
                                {entry.jiraIssueKey}
                              </span>
                            )}
                            <span
                              className="flex-shrink-0 font-brand font-semibold text-foreground"
                              style={{ width: 50, textAlign: 'right' }}
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

        {/* Template gallery + download */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3
              className="font-brand mb-3 font-semibold tracking-wide text-foreground"
              style={{ fontSize: scaled(13) }}
            >
              PDF Template
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {PDF_TEMPLATES.map((id) => {
                const meta = PDF_TEMPLATE_META[id];
                const isSelected = id === selectedTemplate;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedTemplate(id)}
                    className="group relative rounded-lg border-2 p-2 text-left transition-all"
                    style={{
                      borderColor: isSelected ? '#00D4AA' : 'hsl(var(--border))',
                      backgroundColor: isSelected ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                    }}
                  >
                    {/* Mini preview placeholder */}
                    <div
                      className="mb-2 flex h-20 items-center justify-center rounded"
                      style={{
                        backgroundColor:
                          id === 'dark-executive' || id === 'cover-chapters'
                            ? '#0a0a0a'
                            : '#f5f6f8',
                        border: '1px solid hsl(var(--border))',
                      }}
                    >
                      <svg
                        viewBox="0 0 100 120"
                        fill="none"
                        width="20"
                        height="24"
                        style={{ opacity: 0.3 }}
                      >
                        <path
                          d="M18 5 L82 5 L62 48 L82 95 L18 95 L38 48Z"
                          stroke="#00D4AA"
                          strokeWidth="5"
                          strokeLinejoin="round"
                          fill="none"
                        />
                        <circle cx="50" cy="32" r="6" fill="#00D4AA" />
                        <circle cx="49" cy="52" r="7.5" fill="#00D4AA" />
                      </svg>
                    </div>
                    <div
                      className="text-foreground"
                      style={{ fontSize: scaled(10), fontWeight: 600 }}
                    >
                      {meta.name}
                    </div>
                    <div
                      className="mt-0.5 inline-block rounded px-1 py-0.5"
                      style={{
                        fontSize: scaled(8),
                        backgroundColor:
                          meta.medium === 'print'
                            ? 'hsl(var(--primary) / 0.1)'
                            : 'hsl(var(--accent))',
                        color:
                          meta.medium === 'print'
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {meta.medium === 'print' ? 'Print' : 'Screen'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview + Download buttons */}
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-brand font-semibold tracking-wide transition-colors hover:bg-accent"
              style={{ fontSize: scaled(13) }}
              disabled={!reportData || isLoadingPreview}
              onClick={fetchPreview}
            >
              <Eye className="h-4 w-4" />
              {isLoadingPreview ? 'Loading...' : 'Preview'}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 font-brand font-semibold tracking-wide transition-colors"
              style={{
                backgroundColor: isDownloading ? 'hsl(var(--muted))' : '#00D4AA',
                color: isDownloading ? 'hsl(var(--muted-foreground))' : '#0a0a0a',
                fontSize: scaled(13),
              }}
              disabled={!reportData || isDownloading}
              onClick={handleDownload}
            >
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </button>
          </div>

          {/* Save template button */}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-brand font-semibold tracking-wide transition-colors hover:bg-accent"
            style={{ fontSize: scaled(12) }}
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="h-3.5 w-3.5" />
            Save Configuration
          </button>

          {downloadError && (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive"
              style={{ fontSize: scaled(11) }}
            >
              {downloadError}
            </div>
          )}

          {/* Saved templates */}
          {savedTemplates && savedTemplates.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3
                className="font-brand mb-2 font-semibold tracking-wide text-foreground"
                style={{ fontSize: scaled(12) }}
              >
                Saved Templates
              </h3>
              <div className="space-y-1">
                {savedTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1 rounded border border-border/50 px-2 py-1.5 hover:bg-accent/50 transition-colors"
                    style={{ fontSize: scaled(11) }}
                  >
                    <button
                      className="flex-shrink-0 transition-colors hover:text-yellow-400"
                      onClick={() =>
                        toggleFavoriteMutation.mutate({
                          id: t.id,
                          isFavorite: !t.isFavorite,
                        })
                      }
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
                    <button
                      className="flex-1 truncate text-left text-foreground"
                      onClick={() => {
                        setDateFrom(t.config.dateFrom);
                        setDateTo(t.config.dateTo);
                        setProjectIds(t.config.projectIds);
                        setUserIds(t.config.userIds);
                        setClientIds(t.config.clientIds);
                        setTagIds(t.config.tagIds);
                        setSelectedTemplate(t.config.pdfTemplate);
                      }}
                    >
                      {t.name}
                    </button>
                    <button
                      className="flex-shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => deleteTemplateMutation.mutate(t.id)}
                      title="Delete template"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                Date range: {dateFrom} to {dateTo}
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
    </div>
  );
}
