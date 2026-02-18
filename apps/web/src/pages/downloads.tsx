import { useState, useEffect, type JSX } from 'react';
import { Monitor, Download, Cpu, ChevronRight, ShieldCheck, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { useDownloads } from '@/hooks/use-downloads';
import type { DownloadArtifact } from '@ternity/shared';

// ============================================================
// OS Detection (uses experimental NavigatorUAData API)
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
}: {
  artifact: DownloadArtifact;
  recommended: boolean;
}) {
  return (
    <a
      href={artifact.downloadUrl}
      className="flex items-center gap-4 rounded-md border border-border p-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]"
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

function ChecksumTable({ artifacts }: { artifacts: DownloadArtifact[] }) {
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

// ============================================================
// Downloads Page
// ============================================================

export function DownloadsPage() {
  const [detectedOS, setDetectedOS] = useState<Platform | 'unknown'>('unknown');
  const [detectedArch, setDetectedArch] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<Platform>('darwin');

  const { data, isLoading, error } = useDownloads();

  // Run detection
  useEffect(() => {
    const os = detectOS();
    setDetectedOS(os);
    if (os !== 'unknown') setActivePlatform(os);
    detectArch().then((arch) => {
      if (arch) setDetectedArch(arch);
    });
  }, []);

  // Loading state
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

  // Error state
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

  // Empty state
  if (data.artifacts.length === 0) {
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

  const activeArtifacts = data.artifacts.filter((a) => a.platform === activePlatform);

  const recommendedArch =
    detectedOS === activePlatform
      ? detectedArch || DEFAULT_RECOMMENDED[activePlatform]
      : null;

  const sortedArtifacts = [...activeArtifacts].sort((a, b) => {
    if (recommendedArch) {
      if (a.arch === recommendedArch && b.arch !== recommendedArch) return -1;
      if (b.arch === recommendedArch && a.arch !== recommendedArch) return 1;
    }
    return 0;
  });

  return (
    <div className="p-6">
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
              Ternity Desktop (Electron)
            </div>
            <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
              Native time tracking with system tray, global shortcuts, and offline support
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                data.version.includes('-') ? 'bg-amber-500/12 text-amber-500' : 'bg-emerald-500/12 text-emerald-500',
              )}
              style={{ fontSize: scaled(11) }}
            >
              {data.version.includes('-') ? 'Pre-release' : 'Stable'}
            </span>
            <span className="rounded-md bg-muted/50 px-2.5 py-1 font-brand font-medium text-muted-foreground" style={{ fontSize: scaled(11) }}>
              v{data.version}
            </span>
          </div>
        </div>

        {/* Platform tabs */}
        <PlatformTabs active={activePlatform} detected={detectedOS} onChange={setActivePlatform} />

        {/* Download rows */}
        <div className="flex flex-col gap-2 p-6">
          {sortedArtifacts.length > 0 ? (
            sortedArtifacts.map((artifact) => (
              <DownloadRow
                key={artifact.id}
                artifact={artifact}
                recommended={recommendedArch === artifact.arch && detectedOS === activePlatform}
              />
            ))
          ) : (
            <div className="py-8 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
              No builds available for this platform yet.
            </div>
          )}
        </div>

        {/* Checksums */}
        <ChecksumTable artifacts={data.artifacts} />
      </div>

      {/* Release info */}
      <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Released {formatDate(data.releaseDate)}
      </div>
    </div>
  );
}
