import { useState, useEffect, useRef, useCallback } from 'react';
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
  Layers,
  Target,
  PanelRight,
  PanelBottom,
  Maximize2,
  LogIn,
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

const MOCK_STATS = { today: '3h 45m', week: '28h 30m' };
const MOCK_STATS_TRACKING = { today: '5h 08m', week: '29h 53m' };

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
// Shared: EntriesList
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
      {MOCK_ENTRIES.map((entry) => (
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
// Layered Layout
// ============================================================

function LayeredLayout({ timer, onStart, onStop, onPlay }: LayoutProps) {
  const digits = formatTimer(timer.elapsed).split('');

  return (
    <AnimatePresence mode="wait">
      {timer.running ? (
        <motion.div
          key="tracking"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Tracking state */}
          <div
            style={{
              padding: scaled(16),
              background: 'hsl(var(--primary) / 0.04)',
              borderBottom: '1px solid hsl(var(--primary) / 0.15)',
            }}
          >
            <div className="font-medium text-foreground" style={{ fontSize: scaled(13), marginBottom: scaled(4) }}>
              TERN-42 Implement timer component
            </div>
            <div
              className="flex items-center text-muted-foreground"
              style={{ fontSize: scaled(11), gap: scaled(5), marginBottom: scaled(10) }}
            >
              <div
                className="rounded-full"
                style={{ width: scaled(6), height: scaled(6), background: 'hsl(var(--t-project-1))' }}
              />
              Acme Corp &middot; Ternity App
            </div>
            <div className="flex items-center">
              <div
                className="flex-1 font-brand font-bold tabular-nums tracking-wider text-primary"
                style={{ fontSize: scaled(24), letterSpacing: '2px' }}
              >
                {digits.map((d, i) => (
                  <AnimatedDigit key={i} char={d} />
                ))}
              </div>
              <motion.button
                className="flex shrink-0 items-center justify-center rounded-full bg-destructive text-white"
                style={{ width: scaled(32), height: scaled(32) }}
                whileTap={{ scale: 0.85 }}
                onClick={onStop}
              >
                <Square style={{ width: scaled(14), height: scaled(14) }} fill="currentColor" />
              </motion.button>
            </div>
          </div>
          <StatsStrip tracking />
          <EntriesList tracking onPlay={onPlay} />
          <PopupFooter />
        </motion.div>
      ) : (
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Idle state */}
          <div style={{ padding: scaled(16) }}>
            <input
              className="mb-2 w-full rounded-md border border-border bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              style={{ padding: `${scaled(8)} ${scaled(12)}`, fontSize: scaled(12) }}
              placeholder="What are you working on?"
              readOnly
            />
            <div className="flex items-center" style={{ gap: scaled(8) }}>
              <div
                className="flex cursor-pointer items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40"
                style={{ gap: scaled(5), padding: `${scaled(5)} ${scaled(10)}`, fontSize: scaled(11) }}
              >
                <FolderKanban style={{ width: scaled(12), height: scaled(12) }} />
                Project
                <ChevronDown style={{ width: scaled(10), height: scaled(10) }} />
              </div>
              <div
                className="ml-auto font-brand font-semibold tabular-nums tracking-wider"
                style={{ fontSize: scaled(18), color: 'hsl(var(--muted-foreground) / 0.4)', letterSpacing: '1px' }}
              >
                0:00:00
              </div>
              <motion.button
                className="flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                style={{ width: scaled(32), height: scaled(32) }}
                whileTap={{ scale: 0.85 }}
                onClick={onStart}
              >
                <Play style={{ width: scaled(14), height: scaled(14) }} fill="currentColor" />
              </motion.button>
            </div>
          </div>
          <StatsStrip tracking={false} />
          <EntriesList tracking={false} onPlay={onPlay} />
          <PopupFooter />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Hero Layout
// ============================================================

function HeroLayout({ timer, onStart, onStop, onPlay }: LayoutProps) {
  const digits = formatTimer(timer.elapsed).split('');

  return (
    <AnimatePresence mode="wait">
      {timer.running ? (
        <motion.div
          key="tracking"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Tracking: hero timer */}
          <div
            className="relative text-center"
            style={{ padding: `${scaled(20)} ${scaled(16)}`, background: 'hsl(var(--primary) / 0.03)' }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.04) 0%, transparent 70%)' }}
            />
            <div
              className="relative font-brand font-bold tabular-nums tracking-wider text-primary"
              style={{ fontSize: scaled(36), letterSpacing: '2px', lineHeight: 1 }}
            >
              {digits.map((d, i) => (
                <AnimatedDigit key={i} char={d} />
              ))}
            </div>
            <div className="relative mt-1 font-medium text-primary" style={{ fontSize: scaled(13) }}>
              Ternity App
            </div>
            <div className="relative mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
              TERN-42 Implement timer component
            </div>
            <div className="relative mt-3.5 flex items-center justify-center" style={{ gap: scaled(12) }}>
              <motion.button
                className="flex items-center justify-center rounded-full bg-destructive text-white"
                style={{ width: scaled(40), height: scaled(40) }}
                whileTap={{ scale: 0.85 }}
                onClick={onStop}
              >
                <Square style={{ width: scaled(16), height: scaled(16) }} fill="currentColor" />
              </motion.button>
            </div>
          </div>
          <MiniCards tracking />
          <EntriesList tracking onPlay={onPlay} />
          <PopupFooter />
        </motion.div>
      ) : (
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Idle: hero timer centered */}
          <div className="relative text-center" style={{ padding: `${scaled(20)} ${scaled(16)}` }}>
            <div
              className="font-brand font-bold tabular-nums tracking-wider"
              style={{ fontSize: scaled(36), color: 'hsl(var(--muted-foreground) / 0.2)', letterSpacing: '2px', lineHeight: 1 }}
            >
              0:00:00
            </div>
            <div className="flex items-center justify-center" style={{ gap: scaled(12), marginTop: scaled(14) }}>
              <input
                className="rounded-md border border-border bg-card text-center text-foreground outline-none placeholder:text-muted-foreground"
                style={{ width: scaled(200), padding: `${scaled(7)} ${scaled(12)}`, fontSize: scaled(11) }}
                placeholder="What are you working on?"
                readOnly
              />
              <motion.button
                className="flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                style={{ width: scaled(32), height: scaled(32) }}
                whileTap={{ scale: 0.85 }}
                onClick={onStart}
              >
                <Play style={{ width: scaled(14), height: scaled(14) }} fill="currentColor" />
              </motion.button>
            </div>
            <div className="relative mt-2 inline-flex">
              <div
                className="flex cursor-pointer items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40"
                style={{ gap: scaled(5), padding: `${scaled(5)} ${scaled(10)}`, fontSize: scaled(11) }}
              >
                <FolderKanban style={{ width: scaled(12), height: scaled(12) }} />
                Project
                <ChevronDown style={{ width: scaled(10), height: scaled(10) }} />
              </div>
            </div>
          </div>
          <MiniCards tracking={false} />
          <EntriesList tracking={false} onPlay={onPlay} />
          <PopupFooter />
        </motion.div>
      )}
    </AnimatePresence>
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
// TrayPopupShell — the container simulating the OS popup
// ============================================================

interface LayoutProps {
  timer: ReturnType<typeof useFakeTimer>;
  onStart: () => void;
  onStop: () => void;
  onPlay: () => void;
}

type PopupView = 'timer' | 'login';

// ============================================================
// DevTrayInner — state orchestrator
// ============================================================

function DevTrayInner() {
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
          Tray Popup &mdash; Interactive Prototype
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          System tray companion popup. Toggle layout, settings panel style, and view. Click Play/Stop to see state transitions.
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

export function DevTrayPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        
          <DevToolbar />
          <div className="p-6">
            <DevTrayInner />
          </div>
        
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
