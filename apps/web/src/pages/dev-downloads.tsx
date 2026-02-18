import { useState, useEffect, type JSX } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/theme-provider';
import { ScaleProvider } from '@/providers/scale-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Monitor, Download, Cpu, ChevronRight, ShieldCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

// ============================================================
// Types & Mock Data
// ============================================================

type Platform = 'darwin' | 'windows' | 'linux';

interface Artifact {
  id: string;
  filename: string;
  version: string;
  platform: Platform;
  arch: string;
  size: number;
  checksum: string;
  uploadedAt: string;
  release: boolean;
  label: string;
  description: string;
}

interface Product {
  name: string;
  description: string;
  version: string;
  channel: 'stable' | 'beta';
  releaseDate: string;
  releaseNotes: string[];
  artifacts: Artifact[];
}

const MOCK_PRODUCT: Product = {
  name: 'Ternity Desktop Electron',
  description: 'Native time tracking with system tray, global shortcuts, and offline support',
  version: '1.0.0',
  channel: 'stable',
  releaseDate: '2026-02-17',
  releaseNotes: [
    'System tray with quick timer controls',
    'Global keyboard shortcuts (start/stop/switch project)',
    'Offline time tracking with automatic sync',
    'Native notifications for idle detection',
    'Auto-update support (checks on launch)',
  ],
  artifacts: [
    { id: 'a1', filename: 'Ternity-1.0.0-arm64.dmg', version: '1.0.0', platform: 'darwin', arch: 'arm64', size: 102760448, checksum: 'sha256:a3f2e8c91d4b7056f1e3d8a9c2b5f4e7d6a1c3b8e9f2d5a7c4b1e8f3d6a9c2b5', uploadedAt: '2026-02-17T10:00:00Z', release: true, label: 'macOS — Apple Silicon', description: 'M1, M2, M3, M4 · .dmg installer' },
    { id: 'a2', filename: 'Ternity-1.0.0-x64.dmg', version: '1.0.0', platform: 'darwin', arch: 'x64', size: 106954752, checksum: 'sha256:b7d1f4a82c5e9038e2d4c6a1f3b8e5d7c9a2f4b6e1d3c8a5f7b2e4d9c1a6f3b8', uploadedAt: '2026-02-17T10:00:00Z', release: true, label: 'macOS — Intel', description: 'x86_64 · .dmg installer' },
    { id: 'a3', filename: 'Ternity-1.0.0-x64.exe', version: '1.0.0', platform: 'windows', arch: 'x64', size: 93323264, checksum: 'sha256:c4e2d8f15b3a7069d3e5b7a2c9f1d4e6a8c3f5b7e2d4a9c1f6b3e8d5a7c2f4b1', uploadedAt: '2026-02-17T10:00:00Z', release: true, label: 'Windows — 64-bit (x64)', description: 'Most Windows PCs · .exe installer' },
    { id: 'a4', filename: 'Ternity-1.0.0-arm64.exe', version: '1.0.0', platform: 'windows', arch: 'arm64', size: 89128960, checksum: 'sha256:d5f3e9a26c4b8072e4f6c8a3d1b5e7f9a2c4d6b8e3f5a7c1d9b4e6f2a8c3d5b7', uploadedAt: '2026-02-17T10:00:00Z', release: true, label: 'Windows — ARM64', description: 'Surface Pro X, Snapdragon laptops · .exe installer' },
    { id: 'a5', filename: 'Ternity-1.0.0-x64.AppImage', version: '1.0.0', platform: 'linux', arch: 'x64', size: 98566144, checksum: 'sha256:e6a4f1b37d5c9083f5a7d9b4c2e1f3a6d8b5c7e2f4a1d6b9c3e8f5a2d7b4c1e6', uploadedAt: '2026-02-17T10:00:00Z', release: true, label: 'Linux — AppImage (x64)', description: 'Universal — runs on any distro' },
    { id: 'a6', filename: 'Ternity-1.0.0-x64.deb', version: '1.0.0', platform: 'linux', arch: 'x64', size: 95420416, checksum: 'sha256:f7b5a2c48e6d1094a6b8e1c5d3f2a4b7c9e6d8f1a3b5c7d2e4f9a1b6c3e8d5f7', uploadedAt: '2026-02-17T10:00:00Z', release: true, label: 'Linux — .deb (x64)', description: 'Ubuntu, Debian' },
  ],
};

// ============================================================
// OS Detection
// ============================================================

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

// Recommended arch per platform (default if we can't detect)
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

function PlatformTabs({
  active,
  detected,
  onChange,
}: {
  active: Platform;
  detected: Platform | 'unknown';
  onChange: (p: Platform) => void;
}) {
  return (
    <div className="flex gap-0 border-b border-border px-6">
      {PLATFORMS.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-4 py-3 font-brand tracking-wide transition-colors',
            active === p.id
              ? 'border-primary font-semibold text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
          style={{ fontSize: scaled(12), letterSpacing: '0.5px' }}
        >
          {p.icon}
          {p.label}
          {p.id === detected && (
            <span
              className="rounded bg-primary/15 px-1.5 py-px font-brand uppercase text-primary"
              style={{ fontSize: scaled(8), letterSpacing: '0.5px' }}
            >
              detected
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function DownloadRow({
  artifact,
  recommended,
  onDownload,
}: {
  artifact: Artifact;
  recommended: boolean;
  onDownload: (a: Artifact) => void;
}) {
  return (
    <div
      className="flex cursor-pointer items-center gap-4 rounded-md border border-border p-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]"
      onClick={() => onDownload(artifact)}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        <Cpu className="h-[18px] w-[18px] text-muted-foreground" />
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
      <button
        className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary/10 px-3.5 py-1.5 font-medium text-primary transition-colors hover:bg-primary/[0.18]"
        style={{ fontSize: scaled(12) }}
        onClick={(e) => {
          e.stopPropagation();
          onDownload(artifact);
        }}
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    </div>
  );
}

function ChecksumTable({ artifacts }: { artifacts: Artifact[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 border-t border-border/30 px-6 py-2 text-muted-foreground transition-colors hover:text-foreground"
        style={{ fontSize: scaled(11) }}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
        />
        <ShieldCheck className="h-3.5 w-3.5" />
        SHA-256 checksums
      </button>
      {open && (
        <div className="px-6 pb-4">
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

function ReleaseNotes({ product }: { product: Product }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between" style={{ marginBottom: scaled(10) }}>
        <span className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(12) }}>
          What's new in v{product.version}
        </span>
        <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
          {formatDate(product.releaseDate)}
        </span>
      </div>
      <ul className="list-disc pl-4">
        {product.releaseNotes.map((note, i) => (
          <li key={i} className="text-muted-foreground" style={{ fontSize: scaled(12), lineHeight: 1.6 }}>
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Downloads Page
// ============================================================

function DownloadsPrototype() {
  const [detectedOS, setDetectedOS] = useState<Platform | 'unknown'>('unknown');
  const [detectedArch, setDetectedArch] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<Platform>('darwin');
  const [simulatedOS, setSimulatedOS] = useState<string>('auto');

  const product = MOCK_PRODUCT;

  // Run detection
  useEffect(() => {
    const os = detectOS();
    setDetectedOS(os);
    if (os !== 'unknown') setActivePlatform(os);
    detectArch().then((arch) => {
      if (arch) setDetectedArch(arch);
    });
  }, []);

  function handleSimulate(os: string) {
    setSimulatedOS(os);
    if (os === 'auto') {
      const real = detectOS();
      setDetectedOS(real);
      if (real !== 'unknown') setActivePlatform(real);
    } else if (os === 'unknown') {
      setDetectedOS('unknown');
      setActivePlatform('darwin');
    } else {
      setDetectedOS(os as Platform);
      setActivePlatform(os as Platform);
    }
  }

  function handleDownload(artifact: Artifact) {
    toast(`Downloading ${artifact.filename}...`, {
      description: `${formatSize(artifact.size)} · v${artifact.version}`,
      icon: <Download className="h-4 w-4" />,
    });
  }

  const activeArtifacts = product.artifacts.filter((a) => a.platform === activePlatform);

  // Determine recommended arch for the detected platform
  const recommendedArch =
    detectedOS === activePlatform
      ? detectedArch || DEFAULT_RECOMMENDED[activePlatform]
      : null;

  // Sort: recommended first
  const sortedArtifacts = [...activeArtifacts].sort((a, b) => {
    if (recommendedArch) {
      if (a.arch === recommendedArch && b.arch !== recommendedArch) return -1;
      if (b.arch === recommendedArch && a.arch !== recommendedArch) return 1;
    }
    return 0;
  });

  const SIMULATE_OPTIONS = [
    { id: 'auto', label: 'Auto-detect' },
    { id: 'darwin', label: 'Simulate macOS' },
    { id: 'windows', label: 'Simulate Windows' },
    { id: 'linux', label: 'Simulate Linux' },
    { id: 'unknown', label: 'Simulate Unknown' },
  ];

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      <div className="mb-6">
        <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
          Downloads — Interactive Prototype
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Product Card + Tabs with OS auto-detection, architecture recommendations, and download simulation.
        </p>
      </div>

      {/* OS simulation controls */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          OS Simulation
        </span>
        <div className="flex gap-1">
          {SIMULATE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleSimulate(opt.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs transition-colors',
                simulatedOS === opt.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* App mockup with sidebar context */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid min-h-[680px]" style={{ gridTemplateColumns: '220px 1fr' }}>
          {/* Sidebar */}
          <div className="flex flex-col gap-0.5 border-r border-sidebar-border bg-sidebar px-3 py-5">
            <div className="mb-5 flex items-center gap-2 px-2.5">
              <svg viewBox="0 0 24 30" fill="none" className="h-[22px] w-[18px]">
                <path d="M12 2L2 8v14l10 6 10-6V8L12 2z" stroke="currentColor" strokeWidth="1.5" fill="hsl(var(--primary))" fillOpacity="0.15" />
                <path d="M12 2v26M2 8l10 6 10-6" stroke="hsl(var(--primary))" strokeWidth="1.5" />
              </svg>
              <span className="font-brand text-[15px] font-semibold uppercase tracking-[3px] text-sidebar-foreground">
                Ternity
              </span>
            </div>
            <div className="px-2.5 pb-1 pt-3 font-brand uppercase text-muted-foreground opacity-50" style={{ fontSize: scaled(9), letterSpacing: '2px' }}>Tracking</div>
            {['Timer & Entries', 'Dashboard', 'Reports', 'Calendar', 'Leave'].map((item) => (
              <div key={item} className="rounded-md px-2.5 py-2 text-muted-foreground" style={{ fontSize: scaled(13) }}>{item}</div>
            ))}
            <div className="px-2.5 pb-1 pt-3 font-brand uppercase text-muted-foreground opacity-50" style={{ fontSize: scaled(9), letterSpacing: '2px' }}>Admin</div>
            {['Users', 'Projects'].map((item) => (
              <div key={item} className="rounded-md px-2.5 py-2 text-muted-foreground" style={{ fontSize: scaled(13) }}>{item}</div>
            ))}
            <div className="flex-1" />
            <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-2.5 py-2 font-semibold text-sidebar-accent-foreground" style={{ fontSize: scaled(13) }}>
              <Download className="h-4 w-4" />
              Downloads
            </div>
            <div className="rounded-md px-2.5 py-2 text-muted-foreground" style={{ fontSize: scaled(13) }}>Settings</div>
            <div className="h-2" />
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2.5">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'hsl(var(--t-avatar-bg))', color: 'hsl(var(--t-avatar-text))' }}>JO</div>
              <div>
                <div className="text-[12px] font-medium text-sidebar-foreground">James Oakley</div>
                <div className="text-[10px] text-muted-foreground">Employee</div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="overflow-auto bg-background p-6">
            <div className="mb-6">
              <div className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18), letterSpacing: '1px' }}>Downloads</div>
              <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>Desktop apps and tools</div>
            </div>

            <DetectionBar os={detectedOS} />

            {/* Product card */}
            <div className="mb-6 overflow-hidden rounded-lg border border-border bg-card">
              {/* Header */}
              <div className="flex items-center gap-4 border-b border-border px-6 py-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-primary/10" style={{ borderColor: 'hsl(var(--primary) / 0.2)' }}>
                  <Monitor className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(16) }}>
                    {product.name}
                  </div>
                  <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
                    {product.description}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 font-medium',
                    product.channel === 'stable' ? 'bg-emerald-500/12 text-emerald-500' : 'bg-amber-500/12 text-amber-500',
                  )} style={{ fontSize: scaled(11) }}>
                    {product.channel === 'stable' ? 'Stable' : 'Beta'}
                  </span>
                  <span className="rounded-md bg-muted/50 px-2.5 py-1 font-brand font-medium text-muted-foreground" style={{ fontSize: scaled(11) }}>
                    v{product.version}
                  </span>
                </div>
              </div>

              {/* Platform tabs */}
              <PlatformTabs active={activePlatform} detected={detectedOS} onChange={setActivePlatform} />

              {/* Download rows */}
              <div className="flex flex-col gap-2 p-6">
                {sortedArtifacts.map((artifact) => (
                  <DownloadRow
                    key={artifact.id}
                    artifact={artifact}
                    recommended={recommendedArch === artifact.arch && detectedOS === activePlatform}
                    onDownload={handleDownload}
                  />
                ))}
              </div>

              {/* Checksums */}
              <ChecksumTable artifacts={product.artifacts} />
            </div>

            {/* Release notes */}
            <ReleaseNotes product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Page Shell
// ============================================================

const queryClient = new QueryClient();

export function DevDownloadsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ScaleProvider>
          <div className="min-h-screen bg-background text-foreground">
            <DevToolbar />
            <DownloadsPrototype />
            <Toaster />
          </div>
        </ScaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
