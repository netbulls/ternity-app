import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '@/providers/theme-provider';
import { ScaleProvider, SCALES, useScale } from '@/providers/scale-provider';
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
  Layers,
  Target,
  PanelRight,
  PanelBottom,
  Maximize2,
  LogIn,
  Check,
  WifiOff,
  AlertTriangle,
  Clock,
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
}

const MOCK_ENTRIES: MockEntry[] = [
  { id: 'e1', description: 'TERN-42 Timer component', project: 'Ternity App', client: 'Acme Corp', color: 'hsl(var(--t-project-1))', duration: '1h 45m', durationSec: 6300 },
  { id: 'e2', description: 'Sprint planning', project: 'Legal500', client: 'Legal500', color: 'hsl(var(--t-project-2))', duration: '1h 15m', durationSec: 4500 },
  { id: 'e3', description: 'Client feedback review', project: 'Exegy', client: 'Exegy', color: 'hsl(var(--t-project-3))', duration: '45m', durationSec: 2700 },
];

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

function EntriesList({ tracking, onPlay }: { tracking: boolean; onPlay: () => void }) {
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
            onClick={onPlay}
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
}: {
  selected: MockProject | null;
  onSelect: (project: MockProject) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="absolute z-30 overflow-hidden rounded-lg border border-border bg-background"
      style={{
        width: scaled(260),
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        marginTop: scaled(4),
      }}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.15 }}
    >
      <div style={{ padding: `${scaled(4)} 0` }}>
        {MOCK_PROJECTS.map((project) => {
          const isSelected = selected?.id === project.id;
          return (
            <button
              key={project.id}
              className={`flex w-full items-center transition-colors ${
                isSelected
                  ? 'bg-primary/8 text-foreground'
                  : 'text-foreground hover:bg-muted/50'
              }`}
              style={{ gap: scaled(10), padding: `${scaled(8)} ${scaled(14)}` }}
              onClick={() => {
                onSelect(project);
                onClose();
              }}
            >
              <div
                className="shrink-0 rounded-full"
                style={{ width: scaled(8), height: scaled(8), background: project.color }}
              />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate" style={{ fontSize: scaled(12) }}>
                  {project.name}
                </div>
                {project.client && (
                  <div className="truncate text-muted-foreground" style={{ fontSize: scaled(10) }}>
                    {project.client}
                  </div>
                )}
              </div>
              {isSelected && (
                <Check
                  className="shrink-0 text-primary"
                  style={{ width: scaled(14), height: scaled(14) }}
                />
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
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
      bgColor: 'hsl(45 93% 47% / 0.08)',
      borderColor: 'hsl(45 93% 47% / 0.2)',
      action: null as null | { label: string; onClick: () => void },
    },
    'sync-failed': {
      icon: AlertTriangle,
      message: 'Sync failed — retrying...',
      color: 'hsl(var(--destructive))',
      bgColor: 'hsl(var(--destructive) / 0.08)',
      borderColor: 'hsl(var(--destructive) / 0.2)',
      action: null as null | { label: string; onClick: () => void },
    },
    'long-timer': {
      icon: Clock,
      message: 'Timer running for 8+ hours — did you forget to stop?',
      color: 'hsl(45 93% 47%)',
      bgColor: 'hsl(45 93% 47% / 0.08)',
      borderColor: 'hsl(45 93% 47% / 0.2)',
      action: { label: 'Stop', onClick: onStopTimer },
    },
  }[status];

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="overflow-hidden"
    >
      <div
        className="flex items-center border-b"
        style={{
          padding: `${scaled(6)} ${scaled(12)}`,
          background: config.bgColor,
          borderColor: config.borderColor,
          gap: scaled(8),
          minHeight: scaled(32),
        }}
      >
        <Icon
          className="shrink-0"
          style={{ width: scaled(13), height: scaled(13), color: config.color }}
        />
        <span className="min-w-0 flex-1 text-foreground" style={{ fontSize: scaled(11) }}>
          {config.message}
        </span>
        {config.action && (
          <button
            className="shrink-0 rounded-md font-medium transition-colors hover:bg-background/50"
            style={{
              fontSize: scaled(10),
              padding: `${scaled(2)} ${scaled(8)}`,
              color: config.color,
              border: `1px solid ${config.borderColor}`,
            }}
            onClick={config.action.onClick}
          >
            {config.action.label}
          </button>
        )}
        <button
          className="flex shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
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
                    <div className="absolute left-1/2 top-full" style={{ transform: 'translateX(-50%)' }}>
                      <ProjectPicker
                        selected={selectedProject}
                        onSelect={onProjectSelect}
                        onClose={() => setPickerOpen(false)}
                      />
                    </div>
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
// Settings Panel (inner content — shared by all 3 styles)
// ============================================================

type LayoutType = 'layered' | 'hero';

function SettingsContent({
  layout,
  onLayoutChange,
  onClose,
}: {
  layout: LayoutType;
  onLayoutChange: (l: LayoutType) => void;
  onClose: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const { scale, setScale } = useScale();

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

      {/* Layout picker */}
      <div className="mb-4">
        <span className="mb-2 block font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}>
          Layout
        </span>
        <div className="flex" style={{ gap: scaled(6) }}>
          {([['layered', 'Layered', Layers], ['hero', 'Hero', Target]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              className={`flex flex-1 items-center justify-center rounded-md border transition-colors ${
                layout === key
                  ? 'border-primary/40 bg-primary/8 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground'
              }`}
              style={{ gap: scaled(6), padding: `${scaled(8)} ${scaled(12)}`, fontSize: scaled(11) }}
              onClick={() => onLayoutChange(key)}
            >
              <Icon style={{ width: scaled(14), height: scaled(14) }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme picker */}
      <div className="mb-4">
        <span className="mb-2 block font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}>
          Theme
        </span>
        <div className="grid grid-cols-3" style={{ gap: scaled(4) }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`rounded-md border text-center transition-colors ${
                theme === t.id
                  ? 'border-primary/40 bg-primary/8 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground'
              }`}
              style={{ padding: `${scaled(6)} ${scaled(8)}`, fontSize: scaled(10) }}
              onClick={() => setTheme(t.id as ThemeId)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Scale picker */}
      <div className="mb-4">
        <span className="mb-2 block font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(8), letterSpacing: '1.5px' }}>
          Scale
        </span>
        <div className="flex" style={{ gap: scaled(4) }}>
          {SCALES.map((s) => (
            <button
              key={s.label}
              className={`flex-1 rounded-md border text-center transition-colors ${
                scale === s.value
                  ? 'border-primary/40 bg-primary/8 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground'
              }`}
              style={{ padding: `${scaled(6)} ${scaled(8)}`, fontSize: scaled(10) }}
              onClick={() => setScale(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shortcuts */}
      <div>
        <span className="mb-2 flex items-center font-brand uppercase tracking-wider text-muted-foreground" style={{ fontSize: scaled(8), letterSpacing: '1.5px', gap: scaled(4) }}>
          <Keyboard style={{ width: scaled(10), height: scaled(10) }} />
          Shortcuts
        </span>
        <div className="rounded-md border border-border bg-card" style={{ padding: `${scaled(8)} ${scaled(10)}` }}>
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
  onPlay: () => void;
  selectedProject: MockProject | null;
  onProjectSelect: (project: MockProject) => void;
}

type PopupView = 'timer' | 'login';

// ============================================================
// DevTrayInner — state orchestrator
// ============================================================

function DevTrayV2Inner() {
  const timer = useFakeTimer();
  const [layout, setLayout] = useState<LayoutType>('layered');
  const [view, setView] = useState<PopupView>('timer');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<SettingsPanelStyle>('expand');

  const handleStart = () => {
    timer.start();
  };

  const handleStop = () => {
    timer.stop();
  };

  const handlePlay = () => {
    if (!timer.running) timer.start();
  };

  const handleSettingsToggle = () => {
    setSettingsOpen((o) => !o);
  };

  const handleLogin = () => {
    setView('timer');
  };

  const LayoutComponent = layout === 'layered' ? LayeredLayout : HeroLayout;

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
              {([['layered', 'A / Layered'], ['hero', 'B / Hero']] as const).map(([key, label]) => (
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
            <motion.div style={{ width: scaled(340), flexShrink: 0 }} layout>
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
                    <PopupHeader onSettingsClick={handleSettingsToggle} />
                    <LayoutComponent
                      timer={timer}
                      onStart={handleStart}
                      onStop={handleStop}
                      onPlay={handlePlay}
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
      <ThemeProvider>
        <ScaleProvider>
          <DevToolbar />
          <div className="p-6">
            <DevTrayV2Inner />
          </div>
        </ScaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
