import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/theme-provider';
import { ScaleProvider } from '@/providers/scale-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';

// ============================================================
// Mock Data — realistic changelog entries
// ============================================================

interface ReleaseNote {
  category: 'Added' | 'Changed' | 'Fixed' | 'Removed' | 'Security' | 'Deprecated';
  entries: string[];
}

interface MockVersion {
  version: string;
  date: string | null;
  releaseNotes: ReleaseNote[];
}

const MOCK_VERSIONS: MockVersion[] = [
  {
    version: 'v0.3.0-7-ga3f2c1e',
    date: null,
    releaseNotes: [
      { category: 'Added', entries: ['Expose createdAt field in Entry API response for stable client-side sorting'] },
      { category: 'Changed', entries: [
        'Redesign downloads page with framework tabs, platform tabs, and channel badges',
        'Wire CHANGELOG.md into downloads API to serve release notes per version',
      ]},
    ],
  },
  {
    version: 'v0.2.0',
    date: '2026-02-19',
    releaseNotes: [
      { category: 'Added', entries: [
        'Downloads page with signed download URLs, platform detection, and framework tabs',
        'Dashboard page with weekly/monthly charts and project breakdown',
        'Project management CRUD with client/project admin UI',
        'Entry audit trail with change history',
        'Inline entry editing with project selector animations',
        'Impersonation UI for admin users',
        'Manual time entry dialog',
        'Settings page with theme, scale, and default project preferences',
        'Incomplete entries filter with amber border animation',
        'Component catalog and design lab',
      ]},
      { category: 'Changed', entries: ['Redesign settings page with two-column layout'] },
      { category: 'Fixed', entries: [
        'Timer not stopping on sleep/wake cycle',
        'Stale play/stop button state when switching running entries',
        '415 Unsupported Media Type on bodyless PATCH/POST/PUT requests',
      ]},
    ],
  },
  {
    version: 'v0.1.0',
    date: '2026-02-10',
    releaseNotes: [
      { category: 'Added', entries: [
        'Start/stop timer with real-time tracking',
        'Project and label selectors',
        'Day-grouped entry list with duration totals',
        'User authentication via Logto SSO',
      ]},
    ],
  },
];

const PREFIXES: Record<string, { prefix: string; color: string }> = {
  Added:      { prefix: '+', color: 'hsl(142 71% 45%)' },
  Changed:    { prefix: '~', color: 'hsl(217 91% 60%)' },
  Fixed:      { prefix: '*', color: 'hsl(38 92% 50%)' },
  Removed:    { prefix: '-', color: 'hsl(0 84% 60%)' },
  Security:   { prefix: '!', color: 'hsl(280 70% 55%)' },
  Deprecated: { prefix: '?', color: 'hsl(30 60% 50%)' },
};

const LEGEND_ITEMS = [
  { prefix: '+', label: 'added', color: PREFIXES.Added!.color },
  { prefix: '~', label: 'changed', color: PREFIXES.Changed!.color },
  { prefix: '*', label: 'fixed', color: PREFIXES.Fixed!.color },
  { prefix: '-', label: 'removed', color: PREFIXES.Removed!.color },
  { prefix: '!', label: 'security', color: PREFIXES.Security!.color },
];

// Flatten a version's notes into a simple list of { prefix, text } items
function flattenNotes(notes: ReleaseNote[]): { prefix: string; color: string; text: string }[] {
  return notes.flatMap((section) =>
    section.entries.map((entry) => ({
      prefix: PREFIXES[section.category]?.prefix ?? '·',
      color: PREFIXES[section.category]?.color ?? 'hsl(var(--muted-foreground))',
      text: entry,
    })),
  );
}

// ============================================================
// Current Implementation (for comparison)
// ============================================================

const CATEGORY_COLORS: Record<string, string> = {
  Added: 'hsl(142 71% 45%)',
  Changed: 'hsl(217 91% 60%)',
  Fixed: 'hsl(38 92% 50%)',
  Removed: 'hsl(0 84% 60%)',
  Security: 'hsl(280 70% 55%)',
  Deprecated: 'hsl(30 60% 50%)',
};

function CurrentReleaseNotes({ version }: { version: MockVersion }) {
  const [open, setOpen] = useState(true);
  if (version.releaseNotes.length === 0) return null;

  const allEntries = version.releaseNotes.flatMap((s) => s.entries);
  const teaser = allEntries.slice(0, 3).join(', ');
  const totalCount = allEntries.length;

  const totalItems = version.releaseNotes.reduce((sum, s) => sum + 1 + s.entries.length, 0);
  const half = Math.ceil(totalItems / 2);
  const left: ReleaseNote[] = [];
  const right: ReleaseNote[] = [];
  let itemCount = 0;
  for (const s of version.releaseNotes) {
    if (itemCount < half) {
      left.push(s);
      itemCount += 1 + s.entries.length;
    } else {
      right.push(s);
    }
  }
  if (right.length === 0 && left.length > 1) right.push(left.pop()!);
  const leftEntryCount = left.reduce((sum, s) => sum + s.entries.length, 0);

  const renderColumn = (sections: ReleaseNote[], startNum: number) => {
    let num = startNum;
    return (
      <div>
        {sections.map((section, si) => (
          <div key={section.category}>
            <div className="inline-flex items-center gap-[5px]" style={{ marginBottom: 4, marginTop: si > 0 ? 8 : 0 }}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[section.category] ?? 'hsl(var(--muted-foreground))' }} />
              <span className="font-brand font-semibold uppercase" style={{ fontSize: scaled(9), letterSpacing: '0.5px', color: 'hsl(var(--foreground))', opacity: 0.5 }}>{section.category}</span>
            </div>
            {section.entries.map((entry) => {
              const n = num++;
              return (
                <div key={n} className="text-muted-foreground" style={{ fontSize: scaled(11), lineHeight: 1.7 }}>
                  <span className="font-brand text-muted-foreground/30" style={{ fontVariantNumeric: 'tabular-nums' }}>[{n}]</span>{' '}{entry}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <button
        className={cn(
          'flex w-full items-center gap-2 border-t px-5 py-2 transition-colors',
          open ? 'border-primary/[0.08] bg-primary/[0.04]' : 'border-primary/[0.08] bg-primary/[0.02] hover:bg-primary/[0.05]',
        )}
        onClick={() => setOpen(!open)}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary/50" />
        <span className="min-w-0 truncate" style={{ fontSize: scaled(11) }}>
          <strong className="font-medium text-primary">What's new in {version.version}</strong>
          <span className="text-foreground/70"> — {teaser}</span>
        </span>
        <span className="shrink-0 rounded font-brand font-semibold text-primary" style={{ fontSize: scaled(9), background: 'hsl(var(--primary) / 0.1)', padding: '1px 6px' }}>{totalCount}</span>
        <ChevronDown className={cn('ml-auto h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid border-t border-border/10 px-5 pb-4 pt-3" style={{ gridTemplateColumns: right.length > 0 ? '1fr 1fr' : '1fr', gap: '4px 32px' }}>
          {renderColumn(left, 1)}
          {right.length > 0 && renderColumn(right, leftEntryCount + 1)}
        </div>
      )}
    </>
  );
}

// ============================================================
// Variant A: Terminal Log
// Monospace, flat list, prefix symbols, no categories, larger text
// ============================================================

function VariantANotes({ version }: { version: MockVersion }) {
  const [open, setOpen] = useState(true);
  const items = flattenNotes(version.releaseNotes);
  if (items.length === 0) return null;

  return (
    <>
      <button
        className={cn(
          'flex w-full items-center gap-2 border-t px-5 py-2 transition-colors font-mono',
          open ? 'border-primary/[0.08] bg-primary/[0.04]' : 'border-primary/[0.08] bg-primary/[0.02] hover:bg-primary/[0.05]',
        )}
        onClick={() => setOpen(!open)}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary/50" />
        <span className="min-w-0 truncate" style={{ fontSize: scaled(12) }}>
          <strong className="font-medium text-primary">What's new in {version.version}</strong>
        </span>
        <span className="shrink-0 rounded font-mono font-semibold text-primary" style={{ fontSize: scaled(10), background: 'hsl(var(--primary) / 0.1)', padding: '1px 6px' }}>{items.length}</span>
        <ChevronDown className={cn('ml-auto h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className="border-t border-border/10 px-5 pb-4 pt-3 font-mono"
          style={{ fontSize: scaled(12.5), lineHeight: 1.8 }}
        >
          {items.map((item, i) => (
            <div key={i} className="text-muted-foreground">
              <span style={{ color: item.color, fontWeight: 600, width: '1.5em', display: 'inline-block' }}>{item.prefix}</span>
              {item.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================
// Variant B: CHANGELOG.md File
// Looks like reading the file in a terminal — version header,
// all entries as "- text", monospace, larger, no grouping
// ============================================================

function VariantBNotes({ version }: { version: MockVersion }) {
  const [open, setOpen] = useState(true);
  const items = flattenNotes(version.releaseNotes);
  if (items.length === 0) return null;

  const dateLabel = version.date ? ` — ${version.date}` : ' — unreleased';

  return (
    <>
      <button
        className={cn(
          'flex w-full items-center gap-2 border-t px-5 py-2 transition-colors font-mono',
          open ? 'border-primary/[0.08] bg-primary/[0.04]' : 'border-primary/[0.08] bg-primary/[0.02] hover:bg-primary/[0.05]',
        )}
        onClick={() => setOpen(!open)}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary/50" />
        <span className="min-w-0 truncate" style={{ fontSize: scaled(12) }}>
          <strong className="font-medium text-primary">What's new in {version.version}</strong>
        </span>
        <span className="shrink-0 rounded font-mono font-semibold text-primary" style={{ fontSize: scaled(10), background: 'hsl(var(--primary) / 0.1)', padding: '1px 6px' }}>{items.length}</span>
        <ChevronDown className={cn('ml-auto h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className="border-t border-border/10 px-5 pb-4 pt-3 font-mono"
          style={{ fontSize: scaled(12.5), lineHeight: 1.9 }}
        >
          <div className="mb-2 text-foreground/50" style={{ fontSize: scaled(11) }}>
            ## [{version.version}]{dateLabel}
          </div>
          {items.map((item, i) => (
            <div key={i} className="text-muted-foreground">
              <span className="text-muted-foreground/30">-</span>{' '}{item.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================
// Variant C: Prefix Symbols + Subtle Tint
// Monospace, single column, colored prefix chars,
// subtle background tint per line on hover
// ============================================================

function VariantCNotes({ version }: { version: MockVersion }) {
  const [open, setOpen] = useState(true);
  const items = flattenNotes(version.releaseNotes);
  if (items.length === 0) return null;

  return (
    <>
      <button
        className={cn(
          'flex w-full items-center gap-2 border-t px-5 py-2 transition-colors font-mono',
          open ? 'border-primary/[0.08] bg-primary/[0.04]' : 'border-primary/[0.08] bg-primary/[0.02] hover:bg-primary/[0.05]',
        )}
        onClick={() => setOpen(!open)}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary/50" />
        <span className="min-w-0 truncate" style={{ fontSize: scaled(12) }}>
          <strong className="font-medium text-primary">What's new in {version.version}</strong>
        </span>
        <span className="shrink-0 rounded font-mono font-semibold text-primary" style={{ fontSize: scaled(10), background: 'hsl(var(--primary) / 0.1)', padding: '1px 6px' }}>{items.length}</span>
        <ChevronDown className={cn('ml-auto h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className="border-t border-border/10 px-5 pb-3 pt-2 font-mono"
          style={{ fontSize: scaled(12.5) }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="-mx-2 flex items-baseline gap-2 rounded px-2 py-[3px] text-muted-foreground transition-colors hover:bg-muted/30"
            >
              <span
                className="shrink-0 text-center font-bold"
                style={{ color: item.color, width: '1em' }}
              >
                {item.prefix}
              </span>
              <span style={{ lineHeight: 1.6 }}>{item.text}</span>
            </div>
          ))}
          <div
            className="mt-2 flex items-center gap-3 border-t border-border/10 pt-2"
            style={{ fontSize: scaled(10) }}
          >
            {LEGEND_ITEMS.map((l) => (
              <span key={l.prefix} className="flex items-center gap-1 text-muted-foreground/40">
                <span className="font-bold" style={{ color: l.color }}>{l.prefix}</span>
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Page Shell
// ============================================================

function VariantCard({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-16">
      <div className="mb-3">
        <h2 className="font-brand text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {children}
      </div>
    </div>
  );
}

function LegendBar() {
  const items = [
    { prefix: '+', label: 'Added', color: 'hsl(142 71% 45%)' },
    { prefix: '~', label: 'Changed', color: 'hsl(217 91% 60%)' },
    { prefix: '*', label: 'Fixed', color: 'hsl(38 92% 50%)' },
    { prefix: '-', label: 'Removed', color: 'hsl(0 84% 60%)' },
    { prefix: '!', label: 'Security', color: 'hsl(280 70% 55%)' },
  ];
  return (
    <div className="flex items-center gap-4 rounded-md border border-border/50 bg-muted/20 px-4 py-2 font-mono" style={{ fontSize: scaled(11) }}>
      <span className="text-muted-foreground/50">Prefix legend:</span>
      {items.map((item) => (
        <span key={item.prefix} className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: item.color }}>{item.prefix}</span>
          <span className="text-muted-foreground/60">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function ReleaseNotesPrototype() {
  // Use v0.2.0 for the main comparison (most entries)
  const mainVersion = MOCK_VERSIONS[1]!;
  const snapshotVersion = MOCK_VERSIONS[0]!;

  return (
    <div className="mx-auto max-w-[900px] p-6">
      <div className="mb-6">
        <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">Release Notes — Readability Iteration</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Goal: monospace terminal feel, bigger text, single column, no category grouping. Comparing against current implementation.
        </p>
      </div>

      <div className="mb-8">
        <LegendBar />
      </div>

      <div className="flex flex-col gap-10">
        {/* Current for reference */}
        <VariantCard
          id="current"
          title="Current — Two-column, categorized, numbered"
          description="The existing implementation. Two balanced columns, category headers with colored dots, [n] numbering across columns."
        >
          <div className="px-5 py-3">
            <div className="font-brand text-sm font-semibold text-foreground">{mainVersion.version}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{mainVersion.date}</div>
          </div>
          <CurrentReleaseNotes version={mainVersion} />
        </VariantCard>

        {/* Variant A */}
        <VariantCard
          id="variant-a"
          title="A — Terminal Log"
          description="Monospace, flat list with colored prefix symbols (+ ~ * - !), no category headers, single column, larger text."
        >
          <div className="px-5 py-3">
            <div className="font-brand text-sm font-semibold text-foreground">{mainVersion.version}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{mainVersion.date}</div>
          </div>
          <VariantANotes version={mainVersion} />
        </VariantCard>

        {/* Variant B */}
        <VariantCard
          id="variant-b"
          title="B — CHANGELOG.md"
          description="Looks like reading CHANGELOG.md in a terminal. Version header as markdown heading, plain dashes, no color-coding."
        >
          <div className="px-5 py-3">
            <div className="font-brand text-sm font-semibold text-foreground">{mainVersion.version}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{mainVersion.date}</div>
          </div>
          <VariantBNotes version={mainVersion} />
        </VariantCard>

        {/* Variant C */}
        <VariantCard
          id="variant-c"
          title="C — Prefix Symbols + Hover Tint"
          description="Monospace, colored prefix chars, subtle row highlight on hover. Interactive feel while staying terminal-like."
        >
          <div className="px-5 py-3">
            <div className="font-brand text-sm font-semibold text-foreground">{mainVersion.version}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{mainVersion.date}</div>
          </div>
          <VariantCNotes version={mainVersion} />
        </VariantCard>

        {/* Show snapshot version with variant C for smaller list comparison */}
        <VariantCard
          id="variant-c-small"
          title="C (small list) — Snapshot with fewer entries"
          description="Same prefix+hover variant but with a snapshot version (3 entries) to verify it works for small changelogs too."
        >
          <div className="px-5 py-3">
            <div className="font-brand text-sm font-semibold text-foreground">{snapshotVersion.version}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">unreleased</div>
          </div>
          <VariantCNotes version={snapshotVersion} />
        </VariantCard>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

export function DevReleaseNotesPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ScaleProvider>
          <div className="min-h-screen bg-background text-foreground">
            <DevToolbar />
            <ReleaseNotesPrototype />
          </div>
        </ScaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
