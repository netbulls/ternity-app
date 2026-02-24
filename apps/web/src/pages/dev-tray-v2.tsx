import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider, usePreferences, SCALES } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { THEMES, type ThemeId } from '@ternity/shared';
import {
  Play,
  Square,
  Settings,
  ExternalLink,
  FolderKanban,
  ChevronDown,
  Keyboard,
  X,
  PanelRight,
  PanelBottom,
  Maximize2,
  LogIn,
  LogOut,
  Check,
  WifiOff,
  AlertTriangle,
  Clock,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { scaled } from '@/lib/scaled';

// ============================================================
// Mock data
// ============================================================

interface MockEntry {
  id: string;
  description: string;
  project: string;
  client: string;
  color: string;
  duration: string;
  durationSec: number;
  day?: 'today' | 'yesterday';
}

const MOCK_ENTRIES: MockEntry[] = [
  { id: 'e1', description: 'TERN-42 Timer component', project: 'Ternity App', client: 'Acme Corp', color: 'hsl(var(--t-project-1))', duration: '1h 45m', durationSec: 6300, day: 'today' },
  { id: 'e2', description: 'Sprint planning', project: 'Legal500', client: 'Legal500', color: 'hsl(var(--t-project-2))', duration: '1h 15m', durationSec: 4500, day: 'today' },
  { id: 'e3', description: 'Client feedback review', project: 'Exegy', client: 'Exegy', color: 'hsl(var(--t-project-3))', duration: '45m', durationSec: 2700, day: 'today' },
  { id: 'e4', description: 'API integration docs', project: 'Ternity App', client: 'Acme Corp', color: 'hsl(var(--t-project-1))', duration: '30m', durationSec: 1800, day: 'yesterday' },
  { id: 'e5', description: 'Design review meeting', project: 'Exegy Dashboard', client: 'Exegy', color: 'hsl(var(--t-project-3))', duration: '1h 00m', durationSec: 3600, day: 'yesterday' },
];

interface MockDayGroup {
  label: string;
  totalDuration: string;
  entries: MockEntry[];
}

function groupEntriesByDay(entries: MockEntry[]): MockDayGroup[] {
  const today: MockEntry[] = [];
  const yesterday: MockEntry[] = [];
  for (const e of entries) {
    if (e.day === 'yesterday') yesterday.push(e);
    else today.push(e);
  }
  const groups: MockDayGroup[] = [];
  if (today.length > 0) {
    const totalSec = today.reduce((s, e) => s + e.durationSec, 0);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    groups.push({ label: 'Today', totalDuration: h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`, entries: today });
  }
  if (yesterday.length > 0) {
    const totalSec = yesterday.reduce((s, e) => s + e.durationSec, 0);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    groups.push({ label: 'Yesterday', totalDuration: h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`, entries: yesterday });
  }
  return groups;
}

interface MockProject {
  id: string;
  name: string;
  client: string;
  color: string;
}

const MOCK_PROJECTS: MockProject[] = [
  { id: 'p1', name: 'Ternity App', client: 'Acme Corp', color: 'hsl(var(--t-project-1))' },
  { id: 'p2', name: 'Legal500', client: 'Legal500', color: 'hsl(var(--t-project-2))' },
  { id: 'p3', name: 'Exegy Dashboard', client: 'Exegy', color: 'hsl(var(--t-project-3))' },
  { id: 'p4', name: 'Internal', client: '', color: 'hsl(var(--primary))' },
];

const MOCK_STATS = { today: '3h 45m', week: '28h 30m' };
const MOCK_STATS_TRACKING = { today: '5h 08m', week: '29h 53m' };

// Current tracking entry data
const TRACKING_ENTRY = {
  description: 'TERN-42 Implement timer component',
  project: 'Ternity App',
  client: 'Acme Corp',
  color: 'hsl(var(--t-project-1))',
};

// ============================================================
// Fake timer hook
// ============================================================

function useFakeTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setRunning(true);
    setElapsed(5027); // ~1:23:47
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  return { running, elapsed, start, stop };
}

// ============================================================
// Helpers
// ============================================================

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// Animated digit
// ============================================================

function AnimatedDigit({ char }: { char: string }) {
  return (
    <span
      className="inline-block overflow-hidden"
      style={{ width: char === ':' ? '0.35em' : '0.6em', textAlign: 'center' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={char}
          initial={{ y: '100%', opacity: 0, filter: 'blur(2px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-100%', opacity: 0, filter: 'blur(2px)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300, mass: 0.5 }}
          className="inline-block"
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ============================================================
// Hourglass SVG logo
// ============================================================

function HourglassLogo({ size = 14 }: { size?: number }) {
  const h = size * (120 / 100);
  return (
    <svg width={size} height={h} viewBox="0 0 100 120" fill="none">
      <path
        d="M18 5 L82 5 L62 48 L82 95 L18 95 L38 48Z"
        stroke="currentColor"
        strokeWidth="5"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="32" r="6" fill="currentColor" />
      <circle cx="49" cy="52" r="7.5" fill="currentColor" />
      <circle cx="54" cy="67" r="5.5" fill="currentColor" />
      <circle cx="44" cy="77" r="7" fill="currentColor" />
      <circle cx="56" cy="83" r="6" fill="currentColor" />
    </svg>
  );
}

// ============================================================
// Shared: PopupHeader
// ============================================================

function PopupHeader({ onSettingsClick }: { onSettingsClick: () => void }) {
  return (
    <div
      className="flex items-center justify-between border-b border-border"
      style={{ padding: `${scaled(12)} ${scaled(16)}` }}
    >
      <div
        className="flex items-center font-brand font-semibold uppercase tracking-widest text-primary"
        style={{ fontSize: scaled(11), letterSpacing: '3px', gap: scaled(6) }}
      >
        <HourglassLogo size={14} />
        TERNITY
      </div>
      <button
        className="flex items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        style={{ width: scaled(24), height: scaled(24) }}
        onClick={onSettingsClick}
      >
        <Settings style={{ width: scaled(14), height: scaled(14) }} />
      </button>
    </div>
  );
}

// ============================================================
// Shared: StatsStrip
// ============================================================

function StatsStrip({ tracking }: { tracking: boolean }) {
  const stats = tracking ? MOCK_STATS_TRACKING : MOCK_STATS;
  return (
    <div className="flex border-b border-border">
      <div className="flex-1 py-2.5 text-center" style={{ padding: `${scaled(10)} ${scaled(16)}` }}>
        <div
          className="font-brand font-bold tabular-nums text-primary"
          style={{ fontSize: scaled(16) }}
        >
          {stats.today}
        </div>
        <div
          className="mt-0.5 font-brand uppercase tracking-widest text-muted-foreground"
          style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}
        >
          Today
        </div>
      </div>
      <div className="w-px bg-border" />
      <div className="flex-1 py-2.5 text-center" style={{ padding: `${scaled(10)} ${scaled(16)}` }}>
        <div
          className="font-brand font-bold tabular-nums text-foreground"
          style={{ fontSize: scaled(16) }}
        >
          {stats.week}
        </div>
        <div
          className="mt-0.5 font-brand uppercase tracking-widest text-muted-foreground"
          style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}
        >
          This Week
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Shared: MiniCards (for Hero layout)
// ============================================================

function MiniCards({ tracking }: { tracking: boolean }) {
  const stats = tracking ? MOCK_STATS_TRACKING : MOCK_STATS;
  return (
    <div
      className="grid grid-cols-2 border-b border-border"
      style={{ gap: scaled(6), padding: `${scaled(8)} ${scaled(16)}` }}
    >
      <div
        className="rounded-md border bg-card"
        style={{ padding: `${scaled(8)} ${scaled(10)}`, borderColor: 'hsl(var(--border) / 0.5)' }}
      >
        <div className="font-brand font-bold tabular-nums text-primary" style={{ fontSize: scaled(15) }}>
          {stats.today}
        </div>
        <div
          className="font-brand uppercase tracking-wider text-muted-foreground"
          style={{ fontSize: scaled(9), letterSpacing: '1px', marginTop: '1px' }}
        >
          Today
        </div>
      </div>
      <div
        className="rounded-md border bg-card"
        style={{ padding: `${scaled(8)} ${scaled(10)}`, borderColor: 'hsl(var(--border) / 0.5)' }}
      >
        <div className="font-brand font-bold tabular-nums text-foreground" style={{ fontSize: scaled(15) }}>
          {stats.week}
        </div>
        <div
          className="font-brand uppercase tracking-wider text-muted-foreground"
          style={{ fontSize: scaled(9), letterSpacing: '1px', marginTop: '1px' }}
        >
          This Week
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Shared: EntriesList (with in-progress indicator)
// ============================================================

function EntriesList({ tracking, onPlay }: { tracking: boolean; onPlay: (entry: MockEntry) => void }) {
  return (
    <div>
      <div
        className="flex items-center justify-between"
        style={{ padding: `${scaled(8)} ${scaled(16)} ${scaled(6)}` }}
      >
        <span
          className="font-brand uppercase tracking-widest text-muted-foreground"
          style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}
        >
          {tracking ? 'Earlier Today' : 'Recent'}
        </span>
      </div>

      {/* In-progress entry — shown when tracking */}
      {tracking && (
        <div
          className="flex items-center"
          style={{
            gap: scaled(10),
            padding: `${scaled(7)} ${scaled(16)}`,
            background: 'hsl(var(--primary) / 0.04)',
          }}
        >
          {/* Pulsing dot */}
          <div className="relative shrink-0" style={{ width: scaled(5), height: scaled(5) }}>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: TRACKING_ENTRY.color }}
              animate={{ scale: [1, 1.8, 1], opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: TRACKING_ENTRY.color }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground" style={{ fontSize: scaled(12) }}>
              {TRACKING_ENTRY.description}
            </div>
            <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
              {TRACKING_ENTRY.client} &middot; {TRACKING_ENTRY.project}
            </div>
          </div>
          <span
            className="shrink-0 font-brand text-primary/70"
            style={{ fontSize: scaled(9), letterSpacing: '0.5px' }}
          >
            IN PROGRESS
          </span>
        </div>
      )}

      {/* When tracking: show 2 entries (in-progress + 2 = 3 rows total)
           When idle: show all 3 entries (3 rows total) — same height */}
      {(tracking ? MOCK_ENTRIES.slice(0, 2) : MOCK_ENTRIES).map((entry) => (
        <div
          key={entry.id}
          className="group flex items-center transition-colors hover:bg-muted/50"
          style={{ gap: scaled(10), padding: `${scaled(7)} ${scaled(16)}` }}
        >
          <div
            className="shrink-0 rounded-full"
            style={{ width: scaled(5), height: scaled(5), background: entry.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-foreground" style={{ fontSize: scaled(12) }}>
              {entry.description}
            </div>
            <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
              {entry.project}
            </div>
          </div>
          <div
            className="shrink-0 font-brand font-semibold tabular-nums text-muted-foreground"
            style={{ fontSize: scaled(12) }}
          >
            {entry.duration}
          </div>
          <button
            className="flex shrink-0 items-center justify-center rounded-full text-muted-foreground/30 opacity-0 transition-all hover:bg-primary/15 hover:text-primary group-hover:opacity-100"
            style={{ width: scaled(22), height: scaled(22) }}
            onClick={() => onPlay(entry)}
          >
            <Play style={{ width: scaled(10), height: scaled(10) }} fill="currentColor" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Shared: PopupFooter
// ============================================================

function PopupFooter() {
  return (
    <div
      className="flex items-center justify-center border-t border-border"
      style={{ padding: `${scaled(8)} ${scaled(16)}` }}
    >
      <span
        className="flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-primary"
        style={{ fontSize: scaled(11), gap: scaled(4) }}
      >
        Open Ternity
        <ExternalLink style={{ width: scaled(10), height: scaled(10) }} />
      </span>
    </div>
  );
}

// ============================================================
// ProjectPicker — dropdown for selecting a project
// ============================================================

function ProjectPicker({
  selected,
  onSelect,
  onClose,
  triggerRef,
  align = 'left',
}: {
  selected: MockProject | null;
  onSelect: (project: MockProject | null) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  align?: 'left' | 'center';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [recentIds] = useState<string[]>(() => {
    // Simulate recents — first two projects as "recently used"
    return ['p1', 'p2'];
  });

  // Position relative to trigger
  useEffect(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Read the CSS custom property for scale to compute dropdown width
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-scale') || '1.1');
    const dropdownWidth = 260 * scale;
    const gap = 4 * scale;
    setPos({
      top: rect.bottom + gap,
      left: align === 'center'
        ? rect.left + rect.width / 2 - dropdownWidth / 2
        : rect.left,
    });
  }, [triggerRef, align]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, triggerRef]);

  // Focus search on open
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Group projects by client
  const grouped = (() => {
    const map = new Map<string, MockProject[]>();
    for (const p of MOCK_PROJECTS) {
      const client = p.client || 'No Client';
      if (!map.has(client)) map.set(client, []);
      map.get(client)!.push(p);
    }
    return Array.from(map.entries()).map(([client, projects]) => ({ client, projects }));
  })();

  const recentProjects = recentIds
    .map((id) => MOCK_PROJECTS.find((p) => p.id === id))
    .filter((p): p is MockProject => p != null);

  // Filter by search or show recents + all
  const filtered = search
    ? grouped
        .map((g) => ({
          ...g,
          projects: g.projects.filter(
            (p) =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              g.client.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((g) => g.projects.length > 0)
    : [
        ...(recentProjects.length > 0
          ? [{ client: 'Recent', projects: recentProjects }]
          : []),
        ...grouped,
      ];

  return createPortal(
    <motion.div
      ref={ref}
      className="fixed z-50 overflow-hidden rounded-lg border border-border bg-background"
      style={{
        width: scaled(260),
        top: pos.top,
        left: pos.left,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.15 }}
    >
      {/* Search */}
      <div className="border-b border-border" style={{ padding: scaled(8) }}>
        <div className="relative">
          <Search
            className="absolute text-muted-foreground"
            style={{
              width: scaled(12),
              height: scaled(12),
              left: scaled(8),
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
          <motion.input
            ref={searchRef}
            className="w-full rounded-md border border-border bg-muted/40 text-foreground outline-none placeholder:text-muted-foreground"
            style={{
              height: scaled(28),
              paddingLeft: scaled(26),
              paddingRight: scaled(8),
              fontSize: scaled(11),
            }}
            whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
            transition={{ duration: 0.2 }}
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Project list */}
      <div style={{ maxHeight: scaled(220), overflowY: 'auto', padding: `${scaled(4)} 0` }}>
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground" style={{ padding: `${scaled(12)} ${scaled(8)}`, fontSize: scaled(11) }}>
            No projects match &ldquo;{search}&rdquo;
          </div>
        ) : (
          filtered.map((group, gi) => (
            <div key={group.client}>
              <div
                className="flex items-center font-brand uppercase tracking-widest text-muted-foreground"
                style={{
                  fontSize: scaled(8),
                  letterSpacing: '1.5px',
                  padding: `${scaled(8)} ${scaled(12)} ${scaled(3)}`,
                  gap: scaled(4),
                  opacity: 0.6,
                }}
              >
                {group.client === 'Recent' && (
                  <Clock style={{ width: scaled(9), height: scaled(9) }} />
                )}
                {group.client}
              </div>
              {group.projects.map((project, pi) => {
                const isSelected = selected?.id === project.id;
                return (
                  <motion.button
                    key={`${group.client}-${project.id}`}
                    className={`flex w-full items-center text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/8 text-foreground'
                        : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                    }`}
                    style={{ gap: scaled(8), padding: `${scaled(6)} ${scaled(12)}` }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: gi * 0.05 + pi * 0.03, duration: 0.15 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onSelect(project);
                      onClose();
                    }}
                  >
                    <motion.div
                      className="shrink-0 rounded-full"
                      style={{ width: scaled(8), height: scaled(8), background: project.color }}
                      animate={isSelected ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate" style={{ fontSize: scaled(12) }}>
                        {project.name}
                      </div>
                      {project.client && (
                        <div className="truncate text-muted-foreground" style={{ fontSize: scaled(10) }}>
                          {project.client}
                        </div>
                      )}
                    </div>
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                        >
                          <Check
                            className="shrink-0 text-primary"
                            style={{ width: scaled(14), height: scaled(14) }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* No project option */}
      <div className="border-t border-border" style={{ padding: scaled(4) }}>
        <motion.button
          className="flex w-full items-center text-left text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          style={{ gap: scaled(8), padding: `${scaled(6)} ${scaled(12)}`, fontSize: scaled(11) }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onSelect(null);
            onClose();
          }}
        >
          <X style={{ width: scaled(10), height: scaled(10) }} />
          No project
        </motion.button>
      </div>
    </motion.div>,
    document.body,
  );
}

// ============================================================
// StatusBanner — notification bar below header
// ============================================================

function StatusBanner({
  status,
  onDismiss,
  onStopTimer,
}: {
  status: StatusState;
  onDismiss: () => void;
  onStopTimer: () => void;
}) {
  if (status === 'none') return null;

  const config = {
    offline: {
      icon: WifiOff,
      message: "You're offline — entries will sync when reconnected",
      color: 'hsl(45 93% 47%)',
      gradient: 'linear-gradient(90deg, hsl(45 93% 47% / 0.12), hsl(40 90% 45% / 0.06))',
      shimmerColor: 'hsl(45 93% 47% / 0.06)',
      action: null as null | { label: string; onClick: () => void },
    },
    'sync-failed': {
      icon: AlertTriangle,
      message: 'Sync failed — retrying...',
      color: 'hsl(var(--destructive))',
      gradient: 'linear-gradient(90deg, hsl(var(--destructive) / 0.12), hsl(var(--destructive) / 0.05))',
      shimmerColor: 'hsl(var(--destructive) / 0.06)',
      action: null as null | { label: string; onClick: () => void },
    },
    'long-timer': {
      icon: Clock,
      message: 'Timer running for 8+ hours — did you forget to stop?',
      color: 'hsl(45 93% 47%)',
      gradient: 'linear-gradient(90deg, hsl(45 93% 47% / 0.12), hsl(40 90% 45% / 0.06))',
      shimmerColor: 'hsl(45 93% 47% / 0.06)',
      action: { label: 'Stop', onClick: onStopTimer },
    },
  }[status];

  const Icon = config.icon;

  return (
    <motion.div
      className="absolute inset-0 z-20 overflow-hidden"
      initial={{ y: '-100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '-100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div
        className="relative flex h-full items-center"
        style={{
          padding: `0 ${scaled(12)}`,
          background: `hsl(var(--background))`,
          gap: scaled(8),
          borderBottom: `1px solid ${config.color}20`,
        }}
      >
        {/* Tinted background layer */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: config.gradient }}
        />
        {/* Shimmer overlay — impersonation style */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            background: `linear-gradient(90deg, transparent, ${config.shimmerColor}, transparent)`,
            width: '50%',
          }}
          animate={{ left: ['-50%', '150%'] }}
          transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
        />

        {/* Icon with pulse glow */}
        <motion.div
          className="relative z-10 flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: scaled(22),
            height: scaled(22),
            background: `${config.color}18`,
          }}
          animate={{
            boxShadow: [
              `0 0 0 0 ${config.color}30`,
              `0 0 0 ${scaled(6)}px ${config.color}00`,
              `0 0 0 0 ${config.color}30`,
            ],
          }}
          transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
        >
          <Icon
            className="shrink-0"
            style={{ width: scaled(11), height: scaled(11), color: config.color }}
          />
        </motion.div>

        <span className="relative z-10 min-w-0 flex-1 text-foreground" style={{ fontSize: scaled(11), lineHeight: 1.3 }}>
          {config.message}
        </span>

        {config.action && (
          <button
            className="relative z-10 shrink-0 rounded-md font-medium transition-colors hover:bg-background/30"
            style={{
              fontSize: scaled(10),
              padding: `${scaled(2)} ${scaled(8)}`,
              color: config.color,
              border: `1px solid ${config.color}30`,
            }}
            onClick={config.action.onClick}
          >
            {config.action.label}
          </button>
        )}

        <button
          className="relative z-10 flex shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          style={{ width: scaled(18), height: scaled(18) }}
          onClick={onDismiss}
        >
          <X style={{ width: scaled(10), height: scaled(10) }} />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// Layered Layout — stable height
// Both states use the same 2-row structure:
//   Row 1: description/input (same height)
//   Row 2: project + timer + action button (same height)
// ============================================================

function LayeredLayout({ timer, onStart, onStop, onPlay, selectedProject, onProjectSelect }: LayoutProps) {
  const digits = formatTimer(timer.elapsed).split('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <motion.div
        animate={{
          backgroundColor: timer.running ? 'hsl(var(--primary) / 0.04)' : 'transparent',
          borderColor: timer.running ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--border))',
        }}
        transition={{ duration: 0.3 }}
        style={{
          padding: scaled(16),
          borderBottom: '1px solid',
        }}
      >
        {/* Row 1: description / input — same height */}
        <div style={{ marginBottom: scaled(8) }}>
          <AnimatePresence mode="wait" initial={false}>
            {timer.running ? (
              <motion.div
                key="desc"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className="truncate font-medium text-foreground"
                  style={{ fontSize: scaled(13), lineHeight: `${scaled(32)}` }}
                >
                  {TRACKING_ENTRY.description}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <input
                  className="w-full rounded-md border border-border bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  style={{ padding: `${scaled(6)} ${scaled(12)}`, fontSize: scaled(12), height: scaled(32) }}
                  placeholder="What are you working on?"
                  readOnly
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Row 2: project + timer + button — same height */}
        <div className="flex items-center" style={{ gap: scaled(8), height: scaled(32) }}>
          <AnimatePresence mode="wait" initial={false}>
            {timer.running ? (
              <motion.div
                key="tracking-project"
                className="flex items-center text-muted-foreground"
                style={{ fontSize: scaled(11), gap: scaled(5) }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className="rounded-full"
                  style={{ width: scaled(6), height: scaled(6), background: selectedProject?.color ?? TRACKING_ENTRY.color }}
                />
                {selectedProject
                  ? <>{selectedProject.client && <>{selectedProject.client} &middot; </>}{selectedProject.name}</>
                  : <>{TRACKING_ENTRY.client} &middot; {TRACKING_ENTRY.project}</>
                }
              </motion.div>
            ) : (
              <motion.div
                key="idle-project"
                className="relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  ref={pillRef}
                  className="flex cursor-pointer items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40"
                  style={{ gap: scaled(5), padding: `${scaled(5)} ${scaled(10)}`, fontSize: scaled(11) }}
                  onClick={() => setPickerOpen((o) => !o)}
                >
                  {selectedProject ? (
                    <>
                      <div
                        className="rounded-full"
                        style={{ width: scaled(6), height: scaled(6), background: selectedProject.color }}
                      />
                      <span className="text-foreground">{selectedProject.name}</span>
                    </>
                  ) : (
                    <>
                      <FolderKanban style={{ width: scaled(12), height: scaled(12) }} />
                      Project
                    </>
                  )}
                  <ChevronDown style={{ width: scaled(10), height: scaled(10) }} />
                </div>
                <AnimatePresence>
                  {pickerOpen && (
                    <ProjectPicker
                      selected={selectedProject}
                      onSelect={onProjectSelect}
                      onClose={() => setPickerOpen(false)}
                      triggerRef={pillRef}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timer display — always present, always uses AnimatedDigit for consistent height */}
          <motion.div
            className="ml-auto font-brand font-bold tabular-nums tracking-wider"
            style={{ fontSize: scaled(20), letterSpacing: '1px' }}
            animate={{
              color: timer.running ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
            }}
            transition={{ duration: 0.3 }}
          >
            {digits.map((d, i) => <AnimatedDigit key={i} char={d} />)}
          </motion.div>

          {/* Play / Stop button — transitions in place */}
          <AnimatePresence mode="wait" initial={false}>
            {timer.running ? (
              <motion.button
                key="stop"
                className="flex shrink-0 items-center justify-center rounded-full bg-destructive text-white"
                style={{ width: scaled(32), height: scaled(32) }}
                initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                whileTap={{ scale: 0.85 }}
                onClick={onStop}
              >
                <Square style={{ width: scaled(14), height: scaled(14) }} fill="currentColor" />
              </motion.button>
            ) : (
              <motion.button
                key="start"
                className="flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                style={{ width: scaled(32), height: scaled(32) }}
                initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                whileTap={{ scale: 0.85 }}
                onClick={onStart}
              >
                <Play style={{ width: scaled(14), height: scaled(14) }} fill="currentColor" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <StatsStrip tracking={timer.running} />
      <EntriesList tracking={timer.running} onPlay={onPlay} />
      <PopupFooter />
    </>
  );
}

// ============================================================
// Hero Layout — stable height
// Both states use the same structure:
//   Big timer (same size, color changes)
//   Input/description row + button (same height)
//   Project pill/label (same height)
// ============================================================

function HeroLayout({ timer, onStart, onStop, onPlay, selectedProject, onProjectSelect }: LayoutProps) {
  const digits = formatTimer(timer.elapsed).split('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <motion.div
        className="relative text-center"
        animate={{
          backgroundColor: timer.running ? 'hsl(var(--primary) / 0.03)' : 'transparent',
        }}
        transition={{ duration: 0.3 }}
        style={{ padding: `${scaled(20)} ${scaled(16)}` }}
      >
        {/* Radial glow — fades in when tracking */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: timer.running ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.04) 0%, transparent 70%)' }}
        />

        {/* Big timer — always present, always uses AnimatedDigit for stable height */}
        <motion.div
          className="relative font-brand font-bold tabular-nums tracking-wider"
          style={{ fontSize: scaled(36), letterSpacing: '2px', lineHeight: 1 }}
          animate={{
            color: timer.running ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.2)',
          }}
          transition={{ duration: 0.3 }}
        >
          {digits.map((d, i) => <AnimatedDigit key={i} char={d} />)}
        </motion.div>

        {/* Input / description row + button — same height */}
        <div
          className="relative flex items-center justify-center"
          style={{ gap: scaled(12), marginTop: scaled(14), height: scaled(32) }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {timer.running ? (
              <motion.div
                key="desc"
                className="truncate text-muted-foreground"
                style={{ fontSize: scaled(12) }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {TRACKING_ENTRY.description}
              </motion.div>
            ) : (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <input
                  className="rounded-md border border-border bg-card text-center text-foreground outline-none placeholder:text-muted-foreground"
                  style={{ width: scaled(200), padding: `${scaled(6)} ${scaled(12)}`, fontSize: scaled(11), height: scaled(32) }}
                  placeholder="What are you working on?"
                  readOnly
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            {timer.running ? (
              <motion.button
                key="stop"
                className="flex shrink-0 items-center justify-center rounded-full bg-destructive text-white"
                style={{ width: scaled(32), height: scaled(32) }}
                initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                whileTap={{ scale: 0.85 }}
                onClick={onStop}
              >
                <Square style={{ width: scaled(14), height: scaled(14) }} fill="currentColor" />
              </motion.button>
            ) : (
              <motion.button
                key="start"
                className="flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                style={{ width: scaled(32), height: scaled(32) }}
                initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                whileTap={{ scale: 0.85 }}
                onClick={onStart}
              >
                <Play style={{ width: scaled(14), height: scaled(14) }} fill="currentColor" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Project pill / label — same height */}
        <div className="relative" style={{ marginTop: scaled(8), height: scaled(28) }}>
          <AnimatePresence mode="wait" initial={false}>
            {timer.running ? (
              <motion.div
                key="project-label"
                className="flex items-center justify-center text-muted-foreground"
                style={{ fontSize: scaled(11), gap: scaled(5), height: scaled(28), lineHeight: `${scaled(28)}` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className="rounded-full"
                  style={{ width: scaled(6), height: scaled(6), background: selectedProject?.color ?? TRACKING_ENTRY.color }}
                />
                <span className="font-medium text-primary">
                  {selectedProject?.name ?? TRACKING_ENTRY.project}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="project-pill"
                className="relative flex items-center justify-center"
                style={{ height: scaled(28) }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  ref={pillRef}
                  className="flex cursor-pointer items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40"
                  style={{ gap: scaled(5), padding: `${scaled(5)} ${scaled(10)}`, fontSize: scaled(11) }}
                  onClick={() => setPickerOpen((o) => !o)}
                >
                  {selectedProject ? (
                    <>
                      <div
                        className="rounded-full"
                        style={{ width: scaled(6), height: scaled(6), background: selectedProject.color }}
                      />
                      <span className="text-foreground">{selectedProject.name}</span>
                    </>
                  ) : (
                    <>
                      <FolderKanban style={{ width: scaled(12), height: scaled(12) }} />
                      Project
                    </>
                  )}
                  <ChevronDown style={{ width: scaled(10), height: scaled(10) }} />
                </div>
                <AnimatePresence>
                  {pickerOpen && (
                    <ProjectPicker
                      selected={selectedProject}
                      onSelect={onProjectSelect}
                      onClose={() => setPickerOpen(false)}
                      triggerRef={pillRef}
                      align="center"
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <MiniCards tracking={timer.running} />
      <EntriesList tracking={timer.running} onPlay={onPlay} />
      <PopupFooter />
    </>
  );
}

// ============================================================
// GlassBottom — stats + entries + footer in a second glass card
// ============================================================

function GlassBottom({ tracking, runningEntryId, extraEntries, onPlay }: { tracking: boolean; runningEntryId: string | null; extraEntries: MockEntry[]; onPlay: (entry: MockEntry) => void }) {
  const stats = tracking ? MOCK_STATS_TRACKING : MOCK_STATS;
  const allEntries = [...extraEntries, ...MOCK_ENTRIES].slice(0, 5);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: scaled(14),
        background: 'hsl(var(--card) / 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid hsl(var(--border) / 0.3)',
      }}
    >
      {/* Top highlight (glass refraction) */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0"
        style={{
          height: '50%',
          background:
            'linear-gradient(180deg, hsl(var(--foreground) / 0.02) 0%, transparent 100%)',
        }}
      />

      {/* Stats mini-cards */}
      <div
        className="relative grid grid-cols-2"
        style={{ gap: scaled(6), padding: `${scaled(12)} ${scaled(12)} ${scaled(6)}` }}
      >
        <div
          style={{
            padding: `${scaled(8)} ${scaled(10)}`,
            background: 'hsl(var(--muted) / 0.2)',
            border: '1px solid hsl(var(--border) / 0.15)',
            borderRadius: scaled(8),
          }}
        >
          <div
            className="font-brand font-bold tabular-nums text-primary"
            style={{ fontSize: scaled(15) }}
          >
            {stats.today}
          </div>
          <div
            className="font-brand uppercase tracking-wider text-muted-foreground"
            style={{ fontSize: scaled(9), letterSpacing: '1px', marginTop: '1px' }}
          >
            Today
          </div>
        </div>
        <div
          style={{
            padding: `${scaled(8)} ${scaled(10)}`,
            background: 'hsl(var(--muted) / 0.2)',
            border: '1px solid hsl(var(--border) / 0.15)',
            borderRadius: scaled(8),
          }}
        >
          <div
            className="font-brand font-bold tabular-nums text-foreground"
            style={{ fontSize: scaled(15) }}
          >
            {stats.week}
          </div>
          <div
            className="font-brand uppercase tracking-wider text-muted-foreground"
            style={{ fontSize: scaled(9), letterSpacing: '1px', marginTop: '1px' }}
          >
            This Week
          </div>
        </div>
      </div>

      {/* Separator */}
      <div style={{ margin: `0 ${scaled(12)}`, borderTop: '1px solid hsl(var(--border) / 0.06)' }} />

      {/* Entries section — grouped by day */}
      <div style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        {groupEntriesByDay(allEntries).map((group, groupIdx) => (
          <div key={group.label}>
            {/* Day separator — thin line between groups */}
            {groupIdx > 0 && (
              <div style={{ margin: `${scaled(1)} ${scaled(14)}`, borderTop: '1px solid hsl(var(--border) / 0.08)' }} />
            )}

            {/* Day header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between backdrop-blur-sm"
              style={{ padding: `${scaled(6)} ${scaled(14)} ${scaled(3)}`, background: 'hsl(var(--card) / 0.85)' }}
            >
              <span
                className="font-brand uppercase tracking-widest text-muted-foreground/60"
                style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}
              >
                {group.label}
              </span>
              <span
                className="font-brand tabular-nums text-muted-foreground/40"
                style={{ fontSize: scaled(9) }}
              >
                {group.totalDuration}
              </span>
            </div>

            {/* Entries in this group */}
            {group.entries.map((entry) => {
              const isRunning = tracking && runningEntryId === entry.id;
              return (
                <motion.div
                  key={entry.id}
                  layout
                  className={`group flex items-center ${isRunning ? '' : 'cursor-pointer hover:bg-muted/50'}`}
                  style={{
                    gap: scaled(10),
                    padding: `${scaled(7)} ${scaled(14)}`,
                    background: isRunning ? 'hsl(var(--primary) / 0.06)' : 'transparent',
                    transition: 'background 0.4s ease',
                  }}
                  onClick={isRunning ? undefined : () => onPlay(entry)}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, layout: { duration: 0.25 } }}
                >
                  {/* Dot — pulsing when running */}
                  {isRunning ? (
                    <div className="relative shrink-0" style={{ width: scaled(5), height: scaled(5) }}>
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ background: entry.color }}
                        animate={{ scale: [1, 1.8, 1], opacity: [1, 0.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{ background: entry.color }}
                      />
                    </div>
                  ) : (
                    <div
                      className="shrink-0 rounded-full"
                      style={{ width: scaled(5), height: scaled(5), background: entry.color }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate ${isRunning ? 'font-medium' : ''} ${entry.description ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}
                      style={{ fontSize: scaled(12) }}
                    >
                      {entry.description || 'No description'}
                    </div>
                    <div
                      className="flex items-center truncate text-muted-foreground"
                      style={{ fontSize: scaled(10), gap: scaled(4) }}
                    >
                      {entry.client ? (
                        <>
                          <span className="truncate">{entry.client}</span>
                          {entry.project && (
                            <>
                              <span className="shrink-0 text-muted-foreground/30">›</span>
                              <span className="truncate">{entry.project}</span>
                            </>
                          )}
                        </>
                      ) : entry.project ? (
                        <span className="truncate">{entry.project}</span>
                      ) : (
                        <span className="italic opacity-50">No project</span>
                      )}
                    </div>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    {isRunning ? (
                      <motion.span
                        key="running"
                        className="shrink-0 font-brand text-primary/70"
                        style={{ fontSize: scaled(9), letterSpacing: '0.5px' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        IN PROGRESS
                      </motion.span>
                    ) : (
                      <motion.div
                        key="idle"
                        className="flex items-center"
                        style={{ gap: scaled(6) }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div
                          className="shrink-0 font-brand font-semibold tabular-nums text-muted-foreground"
                          style={{ fontSize: scaled(12) }}
                        >
                          {entry.duration}
                        </div>
                        <button
                          className="flex shrink-0 items-center justify-center rounded-full text-muted-foreground/30 opacity-0 transition-all hover:bg-primary/15 hover:text-primary group-hover:opacity-100"
                          style={{ width: scaled(22), height: scaled(22) }}
                          onClick={(e) => { e.stopPropagation(); onPlay(entry); }}
                        >
                          <Play style={{ width: scaled(10), height: scaled(10) }} fill="currentColor" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer separator + link */}
      <div style={{ margin: `0 ${scaled(12)}`, borderTop: '1px solid hsl(var(--border) / 0.1)' }} />
      <div
        className="flex items-center justify-center"
        style={{ padding: `${scaled(8)} ${scaled(14)}` }}
      >
        <span
          className="flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-primary"
          style={{ fontSize: scaled(11), gap: scaled(4) }}
        >
          Open Ternity
          <ExternalLink style={{ width: scaled(10), height: scaled(10) }} />
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Liquid Glass Layout — frosted glass card with status orb
// ============================================================

function LiquidGlassLayout({ timer, onStart, onStop, onPlay, selectedProject, onProjectSelect }: LayoutProps) {
  const digits = formatTimer(timer.elapsed).split('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [description, setDescription] = useState('');
  const [runningEntryId, setRunningEntryId] = useState<string | null>(null);
  const [extraEntries, setExtraEntries] = useState<MockEntry[]>([]);
  const pillRef = useRef<HTMLSpanElement>(null);
  const isIncomplete = timer.running && !description;

  // Clear running state when timer stops
  useEffect(() => {
    if (!timer.running) {
      setRunningEntryId(null);
      setExtraEntries([]);
    }
  }, [timer.running]);

  // Start from the timer card — create a new entry in the list
  const handleStart = () => {
    const newId = `new-${Date.now()}`;
    const project = selectedProject?.name ?? '';
    const client = selectedProject?.client ?? '';
    const color = selectedProject?.color ?? 'hsl(var(--primary))';
    const newEntry: MockEntry = {
      id: newId,
      description: description || '',
      project,
      client,
      color,
      duration: '0m',
      durationSec: 0,
    };
    setExtraEntries([newEntry]);
    setRunningEntryId(newId);
    onStart();
  };

  const handleEntryPlay = (entry: MockEntry) => {
    setDescription(entry.description);
    setRunningEntryId(entry.id);
    setExtraEntries([]);
    const matchedProject = MOCK_PROJECTS.find((p) => p.name === entry.project) ?? null;
    onProjectSelect(matchedProject);
    onPlay(entry);
  };

  return (
    <div className="flex flex-col" style={{ padding: scaled(8), gap: scaled(8) }}>
      {/* Timer Glass Card — z-10 so project picker renders above the stats card below */}
      <motion.div
        className="relative z-10"
        style={{
          borderRadius: scaled(14),
          padding: scaled(14),
          background: 'hsl(var(--card) / 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid',
        }}
        animate={{
          borderColor: timer.running
            ? 'hsl(var(--primary) / 0.2)'
            : 'hsl(var(--border) / 0.3)',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Top highlight (glass refraction) */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-0"
          style={{
            height: '50%',
            background:
              'linear-gradient(180deg, hsl(var(--foreground) / 0.02) 0%, transparent 100%)',
          }}
        />

        {/* Header: Orb + Timer + Button */}
        <div
          className="relative flex items-center"
          style={{ gap: scaled(10), marginBottom: scaled(6) }}
        >
          {/* Status Orb */}
          <motion.div
            className="shrink-0 rounded-full"
            style={{ width: scaled(10), height: scaled(10) }}
            animate={{
              background: isIncomplete
                ? 'hsl(38 92% 50%)'
                : timer.running
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--muted-foreground) / 0.2)',
              boxShadow: isIncomplete
                ? '0 0 8px hsl(38 92% 50% / 0.5)'
                : timer.running
                  ? '0 0 8px hsl(var(--primary) / 0.5), 0 0 20px hsl(var(--primary) / 0.2)'
                  : '0 0 0px transparent',
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Timer Display */}
          <motion.div
            className="font-brand font-bold tabular-nums tracking-wider"
            style={{ fontSize: scaled(28), letterSpacing: '2px', lineHeight: 1, marginTop: scaled(2) }}
            animate={{
              color: timer.running
                ? 'hsl(var(--primary))'
                : 'hsl(var(--muted-foreground) / 0.15)',
            }}
            transition={{ duration: 0.3 }}
          >
            {digits.map((d, i) => (
              <AnimatedDigit key={i} char={d} />
            ))}
          </motion.div>

          {/* Play / Stop Button — single button that transforms between states */}
          <div className="ml-auto">
            <motion.button
              className="flex items-center justify-center font-brand font-semibold uppercase"
              style={{
                height: scaled(30),
                width: scaled(72),
                borderRadius: scaled(10),
                gap: scaled(6),
                fontSize: scaled(10),
                letterSpacing: '0.5px',
              }}
              animate={{
                background: timer.running
                  ? 'hsl(var(--destructive))'
                  : 'hsl(var(--primary))',
                color: timer.running
                  ? 'hsl(var(--destructive-foreground))'
                  : 'hsl(var(--primary-foreground))',
              }}
              transition={{ duration: 0.3 }}
              whileTap={{ scale: 0.95 }}
              onClick={timer.running ? onStop : handleStart}
            >
              <AnimatePresence mode="wait" initial={false}>
                {timer.running ? (
                  <motion.span
                    key="stop"
                    className="flex items-center"
                    style={{ gap: scaled(6) }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Square style={{ width: scaled(11), height: scaled(11) }} fill="currentColor" />
                    Stop
                  </motion.span>
                ) : (
                  <motion.span
                    key="start"
                    className="flex items-center"
                    style={{ gap: scaled(6) }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Play style={{ width: scaled(11), height: scaled(11) }} fill="currentColor" />
                    Start
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Description input — always editable */}
        <div>
          <input
            className="w-full text-foreground outline-none placeholder:italic placeholder:text-muted-foreground/40"
            style={{
              padding: `${scaled(8)} ${scaled(10)}`,
              fontSize: scaled(13),
              fontWeight: 500,
              background: 'transparent',
              border: `1px solid ${inputFocused ? 'hsl(var(--border) / 0.6)' : 'transparent'}`,
              borderRadius: scaled(8),
              fontFamily: "'Inter', sans-serif",
              transition: 'border-color 0.2s ease',
            }}
            placeholder={timer.running ? 'Add description...' : 'What are you working on?'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
        </div>

        {/* Project — inline text link, opens picker on click */}
        <div
          className="relative flex items-center"
          style={{
            marginTop: scaled(4),
            minWidth: 0,
          }}
        >
          <span
            ref={pillRef}
            className="flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground"
            style={{
              gap: scaled(5),
              fontSize: scaled(11),
            }}
            onClick={() => setPickerOpen((o) => !o)}
          >
            {selectedProject ? (
              <>
                <div
                  className="shrink-0 rounded-full"
                  style={{
                    width: scaled(6),
                    height: scaled(6),
                    background: selectedProject.color,
                  }}
                />
                {selectedProject.client && (
                  <>
                    <span>{selectedProject.client}</span>
                    <span className="text-muted-foreground/30">›</span>
                  </>
                )}
                <span>{selectedProject.name}</span>
              </>
            ) : (
              <>
                <FolderKanban style={{ width: scaled(12), height: scaled(12) }} />
                <span>No project</span>
              </>
            )}
            <ChevronDown
              style={{
                width: scaled(10),
                height: scaled(10),
                opacity: 0.5,
                transition: 'transform 0.15s',
                transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0)',
              }}
            />
          </span>
          <AnimatePresence>
            {pickerOpen && (
              <ProjectPicker
                selected={selectedProject}
                onSelect={onProjectSelect}
                onClose={() => setPickerOpen(false)}
                triggerRef={pillRef}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Incomplete progress line */}
        <AnimatePresence>
          {isIncomplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 overflow-hidden"
              style={{
                height: 2,
                background: 'hsl(var(--border) / 0.1)',
                borderRadius: `0 0 ${scaled(14)}px ${scaled(14)}px`,
              }}
            >
              <motion.div
                className="absolute h-full"
                style={{
                  width: '30%',
                  background: 'hsl(38 92% 50% / 0.7)',
                }}
                animate={{ left: ['-30%', '100%'] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stats + Entries Glass Card */}
      <GlassBottom tracking={timer.running} runningEntryId={runningEntryId} extraEntries={extraEntries} onPlay={handleEntryPlay} />
    </div>
  );
}

// ============================================================
// Settings Panel (inner content — shared by all 3 styles)
// ============================================================

type LayoutType = 'layered' | 'hero' | 'liquid-glass';

function SettingsContent({
  layout,
  onLayoutChange,
  onClose,
}: {
  layout: LayoutType;
  onLayoutChange: (l: LayoutType) => void;
  onClose: () => void;
}) {
  const { theme, setTheme, scale, setScale } = usePreferences();

  return (
    <div style={{ padding: scaled(16) }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-brand font-semibold uppercase tracking-widest text-foreground" style={{ fontSize: scaled(10), letterSpacing: '2px' }}>
          Settings
        </span>
        <button
          className="flex items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          style={{ width: scaled(24), height: scaled(24) }}
          onClick={onClose}
        >
          <X style={{ width: scaled(14), height: scaled(14) }} />
        </button>
      </div>

      {/* Appearance — compact rows */}
      <div
        className="mb-3 rounded-md border border-border bg-card"
        style={{ fontSize: scaled(10) }}
      >
        {/* Layout */}
        <div
          className="flex items-center justify-between border-b border-border/50"
          style={{ padding: `${scaled(7)} ${scaled(10)}` }}
        >
          <span className="text-muted-foreground">Layout</span>
          <select
            className="cursor-pointer rounded-md border-none bg-transparent text-right text-foreground outline-none"
            style={{ fontSize: scaled(10), padding: `${scaled(2)} 0` }}
            value={layout}
            onChange={(e) => onLayoutChange(e.target.value as LayoutType)}
          >
            {([['layered', 'Layered'], ['hero', 'Hero'], ['liquid-glass', 'Glass']] as const).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div
          className="flex items-center justify-between border-b border-border/50"
          style={{ padding: `${scaled(7)} ${scaled(10)}` }}
        >
          <span className="text-muted-foreground">Theme</span>
          <select
            className="cursor-pointer rounded-md border-none bg-transparent text-right text-foreground outline-none"
            style={{ fontSize: scaled(10), padding: `${scaled(2)} 0` }}
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scale */}
        <div
          className="flex items-center justify-between"
          style={{ padding: `${scaled(7)} ${scaled(10)}` }}
        >
          <span className="text-muted-foreground">Scale</span>
          <select
            className="cursor-pointer rounded-md border-none bg-transparent text-right text-foreground outline-none"
            style={{ fontSize: scaled(10), padding: `${scaled(2)} 0` }}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          >
            {SCALES.map((s) => (
              <option key={s.label} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Shortcuts */}
      <div>
        <span
          className="mb-2 flex items-center font-brand uppercase tracking-wider text-muted-foreground"
          style={{ fontSize: scaled(8), letterSpacing: '1.5px', gap: scaled(4) }}
        >
          <Keyboard style={{ width: scaled(10), height: scaled(10) }} />
          Shortcuts
        </span>
        <div
          className="rounded-md border border-border bg-card"
          style={{ padding: `${scaled(8)} ${scaled(10)}` }}
        >
          {[
            ['Start / Stop', '⌘ + Shift + T'],
            ['Open Popup', '⌘ + Shift + P'],
            ['Open Web App', '⌘ + Shift + W'],
          ].map(([action, key]) => (
            <div
              key={action}
              className="flex items-center justify-between text-muted-foreground"
              style={{ fontSize: scaled(10), padding: `${scaled(3)} 0` }}
            >
              <span>{action}</span>
              <kbd
                className="rounded border border-border bg-muted/50 font-mono"
                style={{ padding: `${scaled(1)} ${scaled(6)}`, fontSize: scaled(9) }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      {/* User + Sign out (mock) */}
      <div
        className="mt-4 flex items-center border-t border-border"
        style={{ paddingTop: scaled(10), gap: scaled(8) }}
      >
        <div
          className="min-w-0 flex-1 truncate text-muted-foreground"
          style={{ fontSize: scaled(9) }}
        >
          john.doe@company.com
        </div>
        <button
          className="flex shrink-0 items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/8 hover:text-red-400"
          style={{ gap: scaled(4), padding: `${scaled(5)} ${scaled(8)}`, fontSize: scaled(10) }}
          onClick={() => {}}
        >
          <LogOut style={{ width: scaled(12), height: scaled(12) }} />
          Sign out
        </button>
      </div>
    </div>
  );
}

type SettingsPanelStyle = 'expand' | 'drawer' | 'overlay';

// ============================================================
// Settings: Drawer (slides up from bottom)
// ============================================================

function SettingsDrawer({
  open,
  layout,
  onLayoutChange,
  onClose,
}: {
  open: boolean;
  layout: LayoutType;
  onLayoutChange: (l: LayoutType) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overflow-hidden border-t border-border bg-background"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <SettingsContent layout={layout} onLayoutChange={onLayoutChange} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Settings: Overlay (slides in from right with backdrop)
// ============================================================

function SettingsOverlay({
  open,
  layout,
  onLayoutChange,
  onClose,
}: {
  open: boolean;
  layout: LayoutType;
  onLayoutChange: (l: LayoutType) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="absolute inset-0 z-10 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute right-0 top-0 bottom-0 z-20 overflow-y-auto border-l border-border bg-background"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ width: '75%' }}
          >
            <SettingsContent layout={layout} onLayoutChange={onLayoutChange} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Login View
// ============================================================

function LoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: `${scaled(40)} ${scaled(24)}` }}>
      <div className="mb-4 text-primary" style={{ opacity: 0.5 }}>
        <HourglassLogo size={40} />
      </div>
      <div
        className="mb-1 font-brand font-semibold uppercase tracking-widest text-foreground"
        style={{ fontSize: scaled(14), letterSpacing: '4px' }}
      >
        TERNITY
      </div>
      <div className="mb-6 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Time tracking for your team
      </div>
      <motion.button
        className="flex items-center rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-colors"
        style={{ fontSize: scaled(12), gap: scaled(6) }}
        whileTap={{ scale: 0.95 }}
        onClick={onLogin}
      >
        <LogIn style={{ width: scaled(14), height: scaled(14) }} />
        Sign in
      </motion.button>
      <div className="mt-6 text-muted-foreground/40" style={{ fontSize: scaled(9) }}>
        v1.2.0-5-gabc123f
      </div>
    </div>
  );
}

// ============================================================
// Types
// ============================================================

type StatusState = 'none' | 'offline' | 'sync-failed' | 'long-timer';

interface LayoutProps {
  timer: ReturnType<typeof useFakeTimer>;
  onStart: () => void;
  onStop: () => void;
  onPlay: (entry: MockEntry) => void;
  selectedProject: MockProject | null;
  onProjectSelect: (project: MockProject | null) => void;
}

type PopupView = 'timer' | 'login';

// ============================================================
// DevTrayInner — state orchestrator
// ============================================================

function DevTrayV2Inner() {
  const timer = useFakeTimer();
  const [layout, setLayout] = useState<LayoutType>('liquid-glass');
  const [view, setView] = useState<PopupView>('timer');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<SettingsPanelStyle>('expand');
  const [selectedProject, setSelectedProject] = useState<MockProject | null>(null);
  const [statusState, setStatusState] = useState<StatusState>('none');
  const [statusDismissed, setStatusDismissed] = useState(false);

  const handleStart = () => {
    timer.start();
  };

  const handleStop = () => {
    timer.stop();
  };

  const handlePlay = (_entry?: MockEntry) => {
    if (!timer.running) timer.start();
  };

  const handleSettingsToggle = () => {
    setSettingsOpen((o) => !o);
  };

  const handleLogin = () => {
    setView('timer');
  };

  const LayoutComponent = layout === 'layered' ? LayeredLayout : layout === 'hero' ? HeroLayout : LiquidGlassLayout;

  const isExpand = panelStyle === 'expand';
  const isDrawer = panelStyle === 'drawer';
  const isOverlay = panelStyle === 'overlay';

  return (
    <div className="mx-auto max-w-[960px] pb-20">
      {/* Page header */}
      <div className="mb-8 text-center">
        <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
          Tray Popup &mdash; v2
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stable layout: no size jump on idle &harr; tracking. In-progress entry highlighted. Click Play/Stop to test.
        </p>
      </div>

      {/* Controls above popup */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-6">
        {/* View toggle */}
        <div className="flex items-center gap-2">
          <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">View</span>
          <div className="flex gap-1">
            {([['timer', 'Timer'], ['login', 'Login']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setView(key);
                  if (key === 'login') setSettingsOpen(false);
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  view === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Layout toggle */}
        {view === 'timer' && (
          <div className="flex items-center gap-2">
            <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layout</span>
            <div className="flex gap-1">
              {([['layered', 'A / Layered'], ['hero', 'B / Hero'], ['liquid-glass', 'C / Liquid Glass']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setLayout(key)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                    layout === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Panel style toggle */}
        {view === 'timer' && (
          <div className="flex items-center gap-2">
            <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings Style</span>
            <div className="flex gap-1">
              {([
                ['expand', 'Expand', PanelRight],
                ['drawer', 'Drawer', PanelBottom],
                ['overlay', 'Overlay', Maximize2],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setPanelStyle(key)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                    panelStyle === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status toggle */}
        {view === 'timer' && (
          <div className="flex items-center gap-2">
            <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <div className="flex gap-1">
              {([
                ['none', 'None'],
                ['offline', 'Offline'],
                ['sync-failed', 'Sync Failed'],
                ['long-timer', 'Long Timer'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setStatusState(key);
                    setStatusDismissed(false);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                    statusState === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* The popup */}
      <div className="flex justify-center">
        <motion.div
          className="relative overflow-hidden rounded-xl"
          style={{
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
          layout
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="flex">
            {/* Main popup column */}
            <motion.div style={{ width: scaled(420), flexShrink: 0 }} layout>
              <AnimatePresence mode="wait">
                {view === 'login' ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LoginView onLogin={handleLogin} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="timer"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="relative">
                      <PopupHeader onSettingsClick={handleSettingsToggle} />
                      <AnimatePresence>
                        {statusState !== 'none' && !statusDismissed && (
                          <StatusBanner
                            status={statusState}
                            onDismiss={() => setStatusDismissed(true)}
                            onStopTimer={handleStop}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                    <LayoutComponent
                      timer={timer}
                      onStart={handleStart}
                      onStop={handleStop}
                      onPlay={handlePlay}
                      selectedProject={selectedProject}
                      onProjectSelect={setSelectedProject}
                    />
                    {/* Drawer: slides up inside popup */}
                    {isDrawer && (
                      <SettingsDrawer
                        open={settingsOpen}
                        layout={layout}
                        onLayoutChange={setLayout}
                        onClose={() => setSettingsOpen(false)}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Overlay: absolute positioned inside popup */}
              {isOverlay && view === 'timer' && (
                <SettingsOverlay
                  open={settingsOpen}
                  layout={layout}
                  onLayoutChange={setLayout}
                  onClose={() => setSettingsOpen(false)}
                />
              )}
            </motion.div>

            {/* Expand: settings panel on the right */}
            {isExpand && view === 'timer' && (
              <AnimatePresence>
                {settingsOpen && (
                  <motion.div
                    className="shrink-0 overflow-hidden border-l border-border bg-background"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: scaled(240), opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    layout
                  >
                    <div style={{ width: scaled(240) }}>
                      <SettingsContent
                        layout={layout}
                        onLayoutChange={setLayout}
                        onClose={() => setSettingsOpen(false)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================
// Page export with providers
// ============================================================

const queryClient = new QueryClient();

export function DevTrayV2Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        
          <DevToolbar />
          <div className="p-6">
            <DevTrayV2Inner />
          </div>
        
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
