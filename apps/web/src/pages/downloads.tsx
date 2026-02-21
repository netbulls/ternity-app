import { useState, useEffect, type JSX } from 'react';
import { Monitor, Download, Cpu, ChevronRight, ChevronDown, ShieldCheck, Info, Loader2, Tag, GitCommitHorizontal, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { useDownloads } from '@/hooks/use-downloads';
import type { DownloadArtifact, DownloadProduct, DownloadChannel } from '@ternity/shared';

// ============================================================
// OS Detection
// ============================================================

type Platform = 'darwin' | 'windows' | 'linux';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nav = navigator as any;

function detectOS(): Platform | 'unknown' {
  if (nav.userAgentData?.platform) {
    const p = (nav.userAgentData.platform as string).toLowerCase();
    if (p.includes('mac')) return 'darwin';
    if (p.includes('win')) return 'windows';
    if (p.includes('linux')) return 'linux';
  }

  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('mac')) return 'darwin';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux')) return 'linux';

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'darwin';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';

  return 'unknown';
}

async function detectArch(): Promise<string | null> {
  if (nav.userAgentData?.getHighEntropyValues) {
    try {
      const hints = await nav.userAgentData.getHighEntropyValues(['architecture']);
      return hints.architecture === 'arm' ? 'arm64' : 'x64';
    } catch {
      // Permission denied or not supported
    }
  }
  return null;
}

const OS_LABELS: Record<string, string> = {
  darwin: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  unknown: 'your system',
};

const PLATFORMS: { id: Platform; label: string; icon: JSX.Element }[] = [
  { id: 'darwin', label: 'macOS', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg> },
  { id: 'windows', label: 'Windows', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3 12V6.75l6-1.32v6.48L3 12zm6.13.01 7.87-.01V5.11l-7.87 1.7v5.2zM17 12.25V19l-7.87-1.08v-5.68L17 12.25zM9 18.75 3 17.5v-5.5l6 .08v6.67z" /></svg> },
  { id: 'linux', label: 'Linux', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.43.777.07 1.543-.242 2.135-.598.285-.18.543-.4.762-.598.203-.2.38-.373.497-.415.063-.023.197.14.33.14.265.004.524-.06.722-.204.396-.29.535-.868.357-1.523a1.99 1.99 0 0 0-.142-.385 7.87 7.87 0 0 0 .215-.567c.182-.56.264-1.164.089-1.794a3.87 3.87 0 0 0-.492-1.015c-.399-.573-.82-1.067-1.139-1.632-.317-.576-.506-1.2-.507-2.063 0-1.2.324-2.113.842-2.898.514-.785 1.2-1.444 1.786-2.164.586-.721 1.07-1.517 1.07-2.618v-.011c-.001-1.594-.46-2.71-1.192-3.506C18.603.97 17.534.46 16.43.16A9.689 9.689 0 0 0 12.504 0" /></svg> },
];

const DEFAULT_RECOMMENDED: Record<Platform, string> = {
  darwin: 'arm64',
  windows: 'x64',
  linux: 'x64',
};

function formatSize(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================================
// Components
// ============================================================

function DetectionBar({ os }: { os: Platform | 'unknown' }) {
  if (os === 'unknown') return null;
  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-md border px-4 py-2.5"
      style={{
        background: 'hsl(var(--primary) / 0.04)',
        borderColor: 'hsl(var(--primary) / 0.12)',
        fontSize: scaled(11),
      }}
    >
      <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="text-muted-foreground">
        Detected <strong className="font-medium text-foreground">{OS_LABELS[os]}</strong> — showing recommended downloads first.
      </span>
    </div>
  );
}

function ChannelBadge({
  channel,
  version,
  active,
  disabled,
  onClick,
}: {
  channel: 'release' | 'snapshot';
  version?: string;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const isRelease = channel === 'release';
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 font-semibold transition-all',
        disabled
          ? 'cursor-default border-border/50 bg-transparent text-muted-foreground/30'
          : active
            ? isRelease
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-500'
            : cn(
                'cursor-pointer border-border bg-transparent text-muted-foreground opacity-50 hover:opacity-80',
                isRelease ? 'hover:border-emerald-500/30' : 'hover:border-amber-500/30',
              ),
      )}
      style={{ fontSize: scaled(11) }}
    >
      {isRelease ? <Tag className="h-3 w-3" /> : <GitCommitHorizontal className="h-3 w-3" />}
      {isRelease ? 'Release' : 'Snapshot'}
      {version && (
        <span className={cn('font-brand font-normal', disabled ? '' : active ? 'opacity-60' : 'opacity-40')}>
          {version}
        </span>
      )}
    </button>
  );
}

const FRAMEWORK_ICONS: Record<string, JSX.Element> = {
  tauri: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M13.912 0a8.72 8.72 0 0 0-8.308 6.139c1.05-.515 2.18-.845 3.342-.976 2.415-3.363 7.4-3.412 9.88-.097 2.48 3.315 1.025 8.084-2.883 9.45a6.131 6.131 0 0 1-.3 2.762 8.72 8.72 0 0 0 3.01-1.225A8.72 8.72 0 0 0 13.913 0zm.082 6.451a2.284 2.284 0 1 0-.15 4.566 2.284 2.284 0 0 0 .15-4.566zm-5.629.27a8.72 8.72 0 0 0-3.031 1.235 8.72 8.72 0 1 0 13.06 9.913 10.173 10.174 0 0 1-3.343.965 6.125 6.125 0 1 1-7.028-9.343 6.114 6.115 0 0 1 .342-2.772zm1.713 6.27a2.284 2.284 0 0 0-2.284 2.283 2.284 2.284 0 0 0 2.284 2.284 2.284 2.284 0 0 0 2.284-2.284 2.284 2.284 0 0 0-2.284-2.284z" />
    </svg>
  ),
  flutter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M14.314 0L2.3 12 6 15.7 21.684.013h-7.357zm.014 11.072L7.857 17.53l6.47 6.47H21.7l-6.46-6.468 6.46-6.46h-7.37z" />
    </svg>
  ),
  electron: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12.011 0c-.85 0-1.539.689-1.539 1.539 0 .85.689 1.54 1.54 1.54.594 0 1.109-.339 1.365-.833 2.221 1.268 3.847 5.473 3.847 10.363 0 2.071-.289 4.056-.825 5.768a.322.322 0 0 0 .614.192c.556-1.776.854-3.825.854-5.96 0-5.193-1.772-9.686-4.32-11.003.001-.022.003-.044.003-.067C12.55.69 11.861 0 11.011 0zm0 .643a.896.896 0 1 1 0 1.792.896.896 0 0 1 0-1.792zm-5.486 4.305c-2.067.008-3.647.665-4.388 1.949-.738 1.277-.527 2.971.511 4.781a.322.322 0 0 0 .558-.32c-.935-1.632-1.117-3.093-.512-4.14.821-1.423 3.033-1.956 5.932-1.428a.322.322 0 0 0 .115-.633c-.784-.143-1.527-.212-2.216-.21zm11.052.018a.322.322 0 0 0-.008.643c1.834.024 3.156.596 3.75 1.626.82 1.419.18 3.595-1.718 5.837a.322.322 0 0 0 .49.416c2.054-2.426 2.771-4.866 1.785-6.574-.726-1.257-2.26-1.921-4.3-1.948zm-2.698.292a.323.323 0 0 0-.065.008c-1.857.397-3.833 1.175-5.731 2.271-4.57 2.638-7.593 6.495-7.36 9.372-.473.263-.793.766-.793 1.345 0 .85.69 1.54 1.54 1.54.85 0 1.539-.69 1.539-1.54s-.69-1.539-1.54-1.539c-.037 0-.075.003-.112.006-.1-2.56 2.743-6.141 7.048-8.627 1.841-1.063 3.755-1.816 5.544-2.2a.322.322 0 0 0-.07-.636zm-2.879 6.237a1.119 1.119 0 0 0-1.078 1.349c.13.601.723.983 1.324.853a1.1 1.1 0 0 0 .853-1.324 1.1 1.1 0 0 0-1.1-.878zM4.532 13.34a.321.321 0 0 0-.253.538c1.268 1.394 2.916 2.701 4.795 3.786 4.414 2.549 9.105 3.285 11.56 1.839a1.53 1.53 0 0 0 .897.29c.85 0 1.54-.69 1.54-1.54s-.69-1.539-1.54-1.539c-.85 0-1.539.69-1.539 1.54 0 .275.074.534.201.758-2.245 1.214-6.631.5-10.798-1.905-1.823-1.053-3.418-2.318-4.64-3.662a.321.321 0 0 0-.223-.105zm-2.063 4.017a.896.896 0 1 1 0 1.792.896.896 0 0 1 0-1.792zm19.062 0a.896.896 0 1 1 0 1.792.896.896 0 0 1 0-1.792zm-14.005 1.368a.322.322 0 0 0-.32.43C8.279 22.153 10.036 24 12.011 24c1.44 0 2.773-.982 3.813-2.711a.322.322 0 0 0-.552-.331c-.934 1.554-2.081 2.399-3.261 2.399-1.641 0-3.208-1.647-4.2-4.418a.322.322 0 0 0-.285-.213z" />
    </svg>
  ),
};

function FrameworkTabs({
  products,
  activeFramework,
  onChange,
}: {
  products: DownloadProduct[];
  activeFramework: string;
  onChange: (fw: string) => void;
}) {
  return (
    <div className="ml-auto flex gap-1">
      {products.map((p) => (
        <button
          key={p.framework}
          onClick={() => onChange(p.framework)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-4 py-1.5 font-brand font-semibold tracking-wide transition-colors',
            p.framework === activeFramework
              ? 'bg-primary/[0.12] text-primary'
              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
          )}
          style={{ fontSize: scaled(13), letterSpacing: '0.5px' }}
        >
          {FRAMEWORK_ICONS[p.framework]}
          {p.framework.charAt(0).toUpperCase() + p.framework.slice(1)}
        </button>
      ))}
    </div>
  );
}

function PlatformTabs({
  active,
  detected,
  availablePlatforms,
  onChange,
}: {
  active: Platform;
  detected: Platform | 'unknown';
  availablePlatforms: Set<Platform>;
  onChange: (p: Platform) => void;
}) {
  return (
    <div className="flex gap-0 border-y border-border px-5">
      {PLATFORMS.map((p) => {
        const available = availablePlatforms.has(p.id);
        return (
          <button
            key={p.id}
            onClick={available ? () => onChange(p.id) : undefined}
            disabled={!available}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-brand tracking-wide transition-colors',
              !available
                ? 'cursor-default border-transparent text-muted-foreground/30'
                : active === p.id
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            style={{ fontSize: scaled(12), letterSpacing: '0.5px' }}
          >
            {p.icon}
            {p.label}
            {available && p.id === detected && (
              <span
                className="rounded bg-primary/15 px-1.5 py-px font-brand uppercase text-primary"
                style={{ fontSize: scaled(8), letterSpacing: '0.5px' }}
              >
                detected
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DownloadRow({
  artifact,
  recommended,
}: {
  artifact: DownloadArtifact;
  recommended: boolean;
}) {
  return (
    <a
      href={artifact.downloadUrl}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:border-primary/30"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        <Cpu className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
            {artifact.label}
          </span>
          {recommended && (
            <span
              className="rounded bg-primary/10 px-1.5 py-px font-brand uppercase text-primary"
              style={{ fontSize: scaled(9), letterSpacing: '0.5px' }}
            >
              recommended
            </span>
          )}
        </div>
        <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
          {artifact.description} · {artifact.filename}
        </div>
      </div>
      <div className="shrink-0 font-brand text-muted-foreground" style={{ fontSize: scaled(12) }}>
        {formatSize(artifact.size)}
      </div>
      <div
        className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary/10 px-3.5 py-1.5 font-medium text-primary transition-colors hover:bg-primary/[0.18]"
        style={{ fontSize: scaled(12) }}
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </div>
    </a>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  Added: 'hsl(142 71% 45%)',
  Changed: 'hsl(217 91% 60%)',
  Fixed: 'hsl(38 92% 50%)',
  Removed: 'hsl(0 84% 60%)',
  Security: 'hsl(280 70% 55%)',
  Deprecated: 'hsl(30 60% 50%)',
};

function ReleaseNotes({ channel }: { channel: DownloadChannel }) {
  const [open, setOpen] = useState(false);

  if (channel.releaseNotes.length === 0) return null;

  const allEntries = channel.releaseNotes.flatMap((s) => s.entries);
  const teaser = allEntries.slice(0, 3).join(', ');
  const totalCount = allEntries.length;

  // Split categories into two balanced columns
  const totalItems = channel.releaseNotes.reduce((sum, s) => sum + 1 + s.entries.length, 0);
  const half = Math.ceil(totalItems / 2);
  const left: typeof channel.releaseNotes = [];
  const right: typeof channel.releaseNotes = [];
  let itemCount = 0;
  for (const s of channel.releaseNotes) {
    if (itemCount < half) {
      left.push(s);
      itemCount += 1 + s.entries.length;
    } else {
      right.push(s);
    }
  }
  if (right.length === 0 && left.length > 1) right.push(left.pop()!);

  const leftEntryCount = left.reduce((sum, s) => sum + s.entries.length, 0);

  const renderColumn = (sections: typeof channel.releaseNotes, startNum: number) => {
    let num = startNum;
    return (
      <div>
        {sections.map((section, si) => (
          <div key={section.category}>
            <div
              className="inline-flex items-center gap-[5px]"
              style={{ marginBottom: 4, marginTop: si > 0 ? 8 : 0 }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: CATEGORY_COLORS[section.category] ?? 'hsl(var(--muted-foreground))' }}
              />
              <span
                className="font-brand font-semibold uppercase"
                style={{
                  fontSize: scaled(9),
                  letterSpacing: '0.5px',
                  color: 'hsl(var(--foreground))',
                  opacity: 0.5,
                }}
              >
                {section.category}
              </span>
            </div>
            {section.entries.map((entry) => {
              const n = num++;
              return (
                <div
                  key={n}
                  className="text-muted-foreground"
                  style={{ fontSize: scaled(11), lineHeight: 1.7 }}
                >
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
          open
            ? 'border-primary/[0.08] bg-primary/[0.04]'
            : 'border-primary/[0.08] bg-primary/[0.02] hover:bg-primary/[0.05]',
        )}
        onClick={() => setOpen(!open)}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary/50" />
        <span className="min-w-0 truncate" style={{ fontSize: scaled(11) }}>
          <strong className="font-medium text-primary">What's new in {channel.version}</strong>
          <span className="text-foreground/70"> — {teaser}</span>
        </span>
        <span
          className="shrink-0 rounded font-brand font-semibold text-primary"
          style={{
            fontSize: scaled(9),
            background: 'hsl(var(--primary) / 0.1)',
            padding: '1px 6px',
          }}
        >
          {totalCount}
        </span>
        <ChevronDown
          className={cn('ml-auto h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          className="grid border-t border-border/10 px-5 pb-4 pt-3"
          style={{
            gridTemplateColumns: right.length > 0 ? '1fr 1fr' : '1fr',
            gap: '4px 32px',
          }}
        >
          {renderColumn(left, 1)}
          {right.length > 0 && renderColumn(right, leftEntryCount + 1)}
        </div>
      )}
    </>
  );
}

function ChecksumTable({ artifacts }: { artifacts: DownloadArtifact[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 border-t border-border/30 px-5 py-2 text-muted-foreground/50 transition-colors hover:text-muted-foreground/80"
        style={{ fontSize: scaled(11) }}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        <ShieldCheck className="h-3.5 w-3.5" />
        SHA-256 checksums
      </button>
      {open && (
        <div className="px-5 pb-4">
          <table className="w-full" style={{ fontSize: scaled(11) }}>
            <thead>
              <tr className="border-b border-border">
                <th className="py-1.5 pr-4 text-left font-brand font-semibold tracking-wide text-muted-foreground" style={{ letterSpacing: '0.5px' }}>File</th>
                <th className="py-1.5 text-left font-brand font-semibold tracking-wide text-muted-foreground" style={{ letterSpacing: '0.5px' }}>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((a) => (
                <tr key={a.id} className="border-b border-border/30">
                  <td className="py-1.5 pr-4 text-foreground">{a.filename}</td>
                  <td className="py-1.5 font-mono text-muted-foreground" style={{ fontSize: scaled(10), wordBreak: 'break-all' }}>
                    {a.checksum.replace('sha256:', '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DownloadsCard({
  products,
  detectedOS,
  detectedArch,
}: {
  products: DownloadProduct[];
  detectedOS: Platform | 'unknown';
  detectedArch: string | null;
}) {
  const [activeFramework, setActiveFramework] = useState(products[0]?.framework ?? '');
  const [activeChannelId, setActiveChannelId] = useState<'release' | 'snapshot'>('release');
  const [activePlatform, setActivePlatform] = useState<Platform>(() => {
    if (detectedOS !== 'unknown') return detectedOS;
    return 'darwin';
  });

  const product = products.find((p) => p.framework === activeFramework) ?? products[0]!;
  const channels = product.channels;

  // Compute which platforms have ANY artifacts across all channels for this framework
  const availablePlatforms = new Set<Platform>();
  for (const ch of channels) {
    for (const a of ch.artifacts) {
      availablePlatforms.add(a.platform as Platform);
    }
  }

  // Auto-correct platform if the current selection has no artifacts
  const effectivePlatform: Platform = availablePlatforms.has(activePlatform)
    ? activePlatform
    : (detectedOS !== 'unknown' && availablePlatforms.has(detectedOS)
        ? detectedOS
        : availablePlatforms.values().next().value ?? 'darwin');

  // Compute which channels have artifacts for the effective platform
  const availableChannels = new Set<'release' | 'snapshot'>();
  for (const ch of channels) {
    if (ch.artifacts.some((a) => a.platform === effectivePlatform)) {
      availableChannels.add(ch.channel);
    }
  }

  // Derive active channel — must have artifacts for the current platform
  const effectiveChannelId: 'release' | 'snapshot' = availableChannels.has(activeChannelId)
    ? activeChannelId
    : (availableChannels.has('release') ? 'release' : availableChannels.values().next().value ?? 'release');

  const activeChannel = channels.find((c) => c.channel === effectiveChannelId) ?? channels[0]!;

  // When switching frameworks, reset to the best available channel for that framework
  function handleFrameworkChange(fw: string) {
    setActiveFramework(fw);
    const p = products.find((pr) => pr.framework === fw);
    if (p) {
      const defaultChannel = p.channels.find((c) => c.channel === 'release') ?? p.channels[0];
      if (defaultChannel) setActiveChannelId(defaultChannel.channel);
    }
  }

  // Filter and sort artifacts for the active platform
  const platformArtifacts = activeChannel.artifacts.filter((a) => a.platform === effectivePlatform);
  const recommendedArch =
    detectedOS === effectivePlatform
      ? detectedArch || DEFAULT_RECOMMENDED[effectivePlatform]
      : null;
  const sortedArtifacts = [...platformArtifacts].sort((a, b) => {
    if (recommendedArch) {
      if (a.arch === recommendedArch && b.arch !== recommendedArch) return -1;
      if (b.arch === recommendedArch && a.arch !== recommendedArch) return 1;
    }
    return 0;
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Row 1: Name + description | Framework tabs */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border bg-primary/[0.08]"
          style={{ borderColor: 'hsl(var(--primary) / 0.15)' }}
        >
          <Monitor className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(15) }}>
            Ternity Desktop
          </div>
          <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
            {product.description}
          </div>
        </div>
        {products.length > 1 && (
          <FrameworkTabs
            products={products}
            activeFramework={activeFramework}
            onChange={handleFrameworkChange}
          />
        )}
      </div>

      {/* Row 2: Platform tabs */}
      <PlatformTabs active={effectivePlatform} detected={detectedOS} availablePlatforms={availablePlatforms} onChange={setActivePlatform} />

      {/* Row 3: Channel badges with inline versions */}
      <div className="flex items-center gap-2 px-5 py-3">
        {(['release', 'snapshot'] as const).map((ch) => {
          const available = availableChannels.has(ch);
          const channelData = channels.find((c) => c.channel === ch);
          return (
            <ChannelBadge
              key={ch}
              channel={ch}
              version={channelData?.version}
              active={effectiveChannelId === ch}
              disabled={!available}
              onClick={available && availableChannels.size > 1 ? () => setActiveChannelId(ch) : undefined}
            />
          );
        })}
      </div>

      {/* Download rows */}
      <div className="flex flex-col gap-2 p-5">
        {sortedArtifacts.length > 0 ? (
          sortedArtifacts.map((artifact) => (
            <DownloadRow
              key={artifact.id}
              artifact={artifact}
              recommended={recommendedArch === artifact.arch && detectedOS === effectivePlatform}
            />
          ))
        ) : (
          <div className="py-8 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
            No builds available for this platform yet.
          </div>
        )}
      </div>

      {/* Release notes */}
      <ReleaseNotes channel={activeChannel} />

      {/* Checksums */}
      <ChecksumTable artifacts={platformArtifacts} />

      {/* Release date */}
      {activeChannel.releaseDate && (
        <div
          className="border-t border-border/30 px-5 py-2 text-muted-foreground/40"
          style={{ fontSize: scaled(11) }}
        >
          Released {formatDate(activeChannel.releaseDate)}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Downloads Page
// ============================================================

export function DownloadsPage() {
  const [detectedOS, setDetectedOS] = useState<Platform | 'unknown'>('unknown');
  const [detectedArch, setDetectedArch] = useState<string | null>(null);

  const { data, isLoading, error } = useDownloads();

  useEffect(() => {
    const os = detectOS();
    setDetectedOS(os);
    detectArch().then((arch) => {
      if (arch) setDetectedArch(arch);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18), letterSpacing: '1px' }}>Downloads</div>
          <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>Desktop apps and tools</div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18), letterSpacing: '1px' }}>Downloads</div>
          <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>Desktop apps and tools</div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Monitor className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <div className="font-medium text-foreground" style={{ fontSize: scaled(14) }}>Downloads unavailable</div>
          <div className="mt-1 text-muted-foreground" style={{ fontSize: scaled(12) }}>
            Desktop builds are not available right now. Please try again later.
          </div>
        </div>
      </div>
    );
  }

  if (data.products.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18), letterSpacing: '1px' }}>Downloads</div>
          <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>Desktop apps and tools</div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Monitor className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <div className="font-medium text-foreground" style={{ fontSize: scaled(14) }}>No builds available yet</div>
          <div className="mt-1 text-muted-foreground" style={{ fontSize: scaled(12) }}>
            Desktop builds will appear here once they are published.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18), letterSpacing: '1px' }}>Downloads</div>
        <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>Desktop apps and tools</div>
      </div>

      <DetectionBar os={detectedOS} />

      <DownloadsCard
        products={data.products}
        detectedOS={detectedOS}
        detectedArch={detectedArch}
      />
    </div>
  );
}
