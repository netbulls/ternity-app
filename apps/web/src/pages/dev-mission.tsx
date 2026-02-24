import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Play, Square, FolderKanban, Check, Search, X, ChevronDown, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { scaled } from '@/lib/scaled';

// ============================================================
// Mock data
// ============================================================

interface MockProject {
  id: string;
  name: string;
  clientName: string;
  color: string;
}

interface MockRecentEntry {
  id: string;
  description: string;
  projectId: string;
  projectName: string;
  clientName: string;
  projectColor: string;
  durationSeconds: number;
  timeAgo: string;
}

const MOCK_PROJECTS: MockProject[] = [
  { id: 'p1', name: 'Brand Redesign', clientName: 'Acme Co', color: '#00D4AA' },
  { id: 'p2', name: 'API v3', clientName: 'Neon Labs', color: '#7B8CFF' },
  { id: 'p3', name: 'Mobile App', clientName: 'Acme Co', color: '#FF9F43' },
  { id: 'p4', name: 'Internal', clientName: '', color: '#00D4AA' },
  { id: 'p5', name: 'Data Pipeline', clientName: 'Neon Labs', color: '#7B8CFF' },
];

const MOCK_RECENT: MockRecentEntry[] = [
  { id: 'r1', description: 'Homepage hero section', projectId: 'p1', projectName: 'Brand Redesign', clientName: 'Acme Co', projectColor: '#00D4AA', durationSeconds: 8100, timeAgo: '2 hours ago' },
  { id: 'r2', description: 'Auth token refresh', projectId: 'p2', projectName: 'API v3', clientName: 'Neon Labs', projectColor: '#7B8CFF', durationSeconds: 2700, timeAgo: 'yesterday' },
  { id: 'r3', description: 'Navigation components', projectId: 'p1', projectName: 'Brand Redesign', clientName: 'Acme Co', projectColor: '#00D4AA', durationSeconds: 5400, timeAgo: 'yesterday' },
  { id: 'r4', description: 'Weekly standup', projectId: 'p4', projectName: 'Internal', clientName: '', projectColor: '#00D4AA', durationSeconds: 1800, timeAgo: '2 days ago' },
  { id: 'r5', description: 'Database schema review', projectId: 'p5', projectName: 'Data Pipeline', clientName: 'Neon Labs', projectColor: '#7B8CFF', durationSeconds: 3600, timeAgo: '2 days ago' },
];

function formatDur(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function formatTimerDisplay(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// Fake timer hook
// ============================================================

function useFakeTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setRunning(true);
    setElapsed(6128);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const reset = useCallback(() => {
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

  return { running, elapsed, start, stop, reset };
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
// Liquid Edge (same as production)
// ============================================================

function LiquidEdge() {
  return (
    <>
      <style>{`
        @keyframes mc-liquid-drift { 0% { left: -5%; } 100% { left: 70%; } }
        @keyframes mc-liquid-drift-2 { 0% { right: -5%; left: auto; } 100% { right: 75%; left: auto; } }
      `}</style>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-xl">
        <div
          className="absolute h-full"
          style={{
            width: '35%',
            background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.7) 0%, hsl(var(--primary) / 0.3) 40%, transparent 70%)',
            filter: 'blur(1px)',
            animation: 'mc-liquid-drift 5s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute h-full"
          style={{
            width: '20%',
            background: 'radial-gradient(ellipse at center, hsl(var(--chart-3) / 0.5) 0%, hsl(var(--chart-3) / 0.2) 40%, transparent 70%)',
            filter: 'blur(1px)',
            animation: 'mc-liquid-drift-2 7s ease-in-out infinite alternate',
          }}
        />
      </div>
      <motion.div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-xl"
        style={{ background: 'linear-gradient(to top, hsl(var(--primary) / 0.03), transparent)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      />
    </>
  );
}

// ============================================================
// Mini Project Picker (inline for the prototype)
// ============================================================

function MiniProjectPicker({
  value,
  onChange,
  autoOpen,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen ?? false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = MOCK_PROJECTS.find((p) => p.id === value) ?? null;

  useEffect(() => {
    if (autoOpen && !open) setOpen(true);
  }, [autoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [open]);

  // Group by client
  const grouped = new Map<string, MockProject[]>();
  for (const p of MOCK_PROJECTS) {
    const client = p.clientName || 'No Client';
    if (!grouped.has(client)) grouped.set(client, []);
    grouped.get(client)!.push(p);
  }

  const filtered = search
    ? [...grouped.entries()]
        .map(([client, projects]) => [
          client,
          projects.filter(
            (p) =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              client.toLowerCase().includes(search.toLowerCase()),
          ),
        ] as [string, MockProject[]])
        .filter(([, projects]) => projects.length > 0)
    : [...grouped.entries()];

  const handleSelect = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <motion.button
        className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs transition-colors"
        style={{
          borderColor: open
            ? 'hsl(var(--primary) / 0.4)'
            : selected
              ? 'hsl(var(--border))'
              : 'hsl(var(--border))',
          borderStyle: selected ? 'solid' : 'dashed',
          background: selected ? 'hsl(var(--muted) / 0.3)' : 'transparent',
          fontSize: scaled(12),
        }}
        onClick={() => setOpen(!open)}
        animate={
          !selected && !open
            ? {
                borderColor: [
                  'hsl(35 100% 60% / 0.2)',
                  'hsl(35 100% 60% / 0.5)',
                  'hsl(35 100% 60% / 0.2)',
                ],
              }
            : {}
        }
        transition={!selected && !open ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
      >
        {selected ? (
          <>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: selected.color }}
            />
            {selected.clientName && (
              <>
                <span
                  className="font-brand text-muted-foreground"
                  style={{ fontSize: scaled(9), letterSpacing: '1.5px', textTransform: 'uppercase' as const, fontWeight: 500 }}
                >
                  {selected.clientName}
                </span>
                <span className="text-muted-foreground">&middot;</span>
              </>
            )}
            <span className="font-medium text-foreground">{selected.name}</span>
          </>
        ) : (
          <>
            <FolderKanban className="h-3.5 w-3.5 text-amber-500/70" />
            <span className="text-amber-500/70">Pick a project</span>
          </>
        )}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-[260px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
          >
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-[12px] text-foreground outline-none"
                  style={{ border: '1px solid hsl(var(--border))' }}
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto p-1">
              {filtered.map(([client, projects], gi) => (
                <div key={client}>
                  <div
                    className="px-2.5 pb-1 pt-2.5 font-brand text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
                    style={{ letterSpacing: '1.5px', opacity: 0.6 }}
                  >
                    {client}
                  </div>
                  {projects.map((p, pi) => {
                    const isSelected = p.id === value;
                    return (
                      <motion.button
                        key={p.id}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                          isSelected
                            ? 'bg-primary/8 text-foreground'
                            : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                        }`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: gi * 0.05 + pi * 0.03, duration: 0.15 }}
                        onClick={() => handleSelect(p.id)}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="flex-1 truncate">{p.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="border-t border-border p-1">
              <button
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                onClick={() => handleSelect(null)}
              >
                <X className="h-3 w-3" />
                <span>No project</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Recent Entry Chip
// ============================================================

function RecentChip({
  entry,
  onRestart,
}: {
  entry: MockRecentEntry;
  onRestart: (entry: MockRecentEntry) => void;
}) {
  return (
    <motion.button
      className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
      style={{ fontSize: scaled(11) }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onRestart(entry)}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: entry.projectColor }}
      />
      <span className="max-w-[140px] truncate text-foreground">{entry.description}</span>
      <span className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
        {entry.clientName ? `${entry.clientName} · ${entry.projectName}` : entry.projectName}
      </span>
      <span className="font-brand font-semibold text-foreground/60" style={{ fontSize: scaled(10) }}>
        {formatDur(entry.durationSeconds)}
      </span>
      <Play className="h-3 w-3 text-primary" />
    </motion.button>
  );
}

// ============================================================
// Recent Entry Card (for Stage grid)
// ============================================================

function RecentCard({
  entry,
  onRestart,
  index,
}: {
  entry: MockRecentEntry;
  onRestart: (entry: MockRecentEntry) => void;
  index: number;
}) {
  return (
    <motion.button
      className="group/card relative rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onRestart(entry)}
    >
      <motion.div
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover/card:opacity-100"
      >
        <Play className="h-3 w-3 fill-current" />
      </motion.div>
      <div className="mb-1 truncate text-xs font-medium text-foreground">{entry.description}</div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: entry.projectColor }}
        />
        {entry.clientName ? `${entry.clientName} · ${entry.projectName}` : entry.projectName}
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-brand font-semibold text-foreground/70">
          {formatDur(entry.durationSeconds)}
        </span>
        <span className="text-muted-foreground">{entry.timeAgo}</span>
      </div>
    </motion.button>
  );
}

// ============================================================
// VARIANT A: THE DOCK
// ============================================================

function DockVariant() {
  const timer = useFakeTimer();
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [autoOpenPicker, setAutoOpenPicker] = useState(false);
  const [justStopped, setJustStopped] = useState(false);

  const hasProject = projectId !== null;
  const isTodo = timer.running && !hasProject;

  const handleStart = () => {
    if (!hasProject) {
      // Smart default C: auto-open project picker
      setAutoOpenPicker(true);
    }
    timer.start();
    setJustStopped(false);
  };

  const handleStop = () => {
    timer.stop();
    setJustStopped(true);
    // After 4s, transition to idle
    setTimeout(() => {
      setJustStopped(false);
      setDescription('');
      setProjectId(null);
      timer.reset();
    }, 4000);
  };

  const handleRestart = (entry: MockRecentEntry) => {
    setDescription(entry.description);
    setProjectId(entry.projectId);
    timer.start();
    setJustStopped(false);
  };

  const handleProjectChange = (id: string | null) => {
    setProjectId(id);
    setAutoOpenPicker(false);
  };

  const digits = formatTimerDisplay(timer.elapsed).split('');

  return (
    <div>
      <motion.div
        className="relative overflow-hidden rounded-xl border"
        animate={{
          borderColor: timer.running
            ? isTodo
              ? 'hsl(35 100% 60% / 0.3)'
              : 'hsl(var(--primary) / 0.3)'
            : 'hsl(var(--border))',
          backgroundColor: timer.running
            ? 'hsl(var(--t-timer-bg))'
            : 'transparent',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Row 1: Main controls */}
        <div className="flex items-center gap-4 px-5 py-3.5">
          <input
            className="flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: scaled(15) }}
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !timer.running) handleStart();
            }}
          />

          <MiniProjectPicker
            value={projectId}
            onChange={handleProjectChange}
            autoOpen={autoOpenPicker && timer.running}
          />

          {/* Timer display */}
          <div
            className="shrink-0 font-brand font-bold tabular-nums tracking-wider"
            style={{ fontSize: scaled(24) }}
          >
            {timer.running ? (
              <span style={{ color: isTodo ? 'hsl(35 100% 60%)' : 'hsl(var(--primary))' }}>
                {digits.map((d, i) => (
                  <AnimatedDigit key={i} char={d} />
                ))}
              </span>
            ) : (
              <span style={{ opacity: 0.2 }}>0:00:00</span>
            )}
          </div>

          {/* Start/Stop button */}
          <AnimatePresence mode="wait">
            {timer.running ? (
              <motion.button
                key="stop"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive text-white"
                initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                whileTap={{ scale: 0.85 }}
                onClick={handleStop}
              >
                <Square className="h-4 w-4 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                key="start"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                whileTap={{ scale: 0.85 }}
                onClick={handleStart}
              >
                <Play className="h-4 w-4 fill-current" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Row 2: Shelf */}
        <AnimatePresence mode="wait">
          {timer.running ? (
            <motion.div
              key="running-shelf"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="flex items-center gap-4 border-t px-5 py-2"
                style={{
                  borderColor: isTodo ? 'hsl(35 100% 60% / 0.1)' : 'hsl(var(--primary) / 0.1)',
                  background: isTodo ? 'hsl(35 100% 60% / 0.03)' : 'hsl(var(--primary) / 0.03)',
                  fontSize: scaled(11),
                }}
              >
                {isTodo ? (
                  <span style={{ color: 'hsl(35 100% 60% / 0.7)' }}>
                    Entry needs a project to be complete
                  </span>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      Started <span className="font-medium text-foreground/80">10:23</span>
                    </span>
                    <span className="text-border">&middot;</span>
                    <span className="text-muted-foreground">
                      Today&apos;s total <span className="font-medium text-foreground/80">5h 47m</span>
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          ) : justStopped ? (
            <motion.div
              key="stopped-shelf"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="flex items-center gap-3 border-t border-border/50 bg-primary/5 px-5 py-2.5"
                style={{ fontSize: scaled(11) }}
              >
                <Check className="h-3.5 w-3.5 text-primary" />
                <span className="text-primary">
                  Session saved &mdash; {formatDur(timer.elapsed)}
                </span>
                <button
                  className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-primary"
                  onClick={() => handleRestart(MOCK_RECENT[0]!)}
                >
                  <RotateCcw className="h-3 w-3" />
                  Restart
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle-shelf"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 overflow-x-auto border-t border-border/50 bg-muted/15 px-5 py-2.5">
                <span
                  className="shrink-0 font-brand font-normal uppercase tracking-widest text-muted-foreground"
                  style={{ fontSize: scaled(9), letterSpacing: '2px' }}
                >
                  Recent
                </span>
                {MOCK_RECENT.map((entry) => (
                  <RecentChip key={entry.id} entry={entry} onRestart={handleRestart} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Liquid edge when running */}
        {timer.running && !isTodo && <LiquidEdge />}

        {/* Amber edge for todo */}
        {isTodo && (
          <motion.div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] rounded-b-xl"
            style={{ background: 'hsl(35 100% 60% / 0.4)' }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================
// VARIANT B: THE STAGE
// ============================================================

function StageVariant() {
  const timer = useFakeTimer();
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [autoOpenPicker, setAutoOpenPicker] = useState(false);

  const hasProject = projectId !== null;
  const isTodo = timer.running && !hasProject;

  const handleStart = () => {
    if (!hasProject) setAutoOpenPicker(true);
    timer.start();
  };

  const handleStop = () => {
    timer.stop();
    setTimeout(() => {
      setDescription('');
      setProjectId(null);
      timer.reset();
    }, 2000);
  };

  const handleRestart = (entry: MockRecentEntry) => {
    setDescription(entry.description);
    setProjectId(entry.projectId);
    timer.start();
  };

  const handleProjectChange = (id: string | null) => {
    setProjectId(id);
    setAutoOpenPicker(false);
  };

  const digits = formatTimerDisplay(timer.elapsed).split('');

  return (
    <div>
      <motion.div
        className="relative overflow-hidden rounded-xl border"
        animate={{
          borderColor: timer.running
            ? isTodo
              ? 'hsl(35 100% 60% / 0.3)'
              : 'hsl(var(--primary) / 0.3)'
            : 'hsl(var(--border))',
          backgroundColor: timer.running ? 'hsl(var(--t-timer-bg))' : 'transparent',
        }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence mode="wait">
          {timer.running ? (
            /* Hero mode when running */
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center py-6 text-center"
            >
              {/* Description */}
              <input
                className="mb-2 w-full max-w-md border-none bg-transparent text-center font-medium text-foreground outline-none placeholder:text-muted-foreground"
                style={{ fontSize: scaled(16) }}
                placeholder={isTodo ? 'Add a description...' : undefined}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              {/* Project */}
              <div className="mb-4">
                <MiniProjectPicker
                  value={projectId}
                  onChange={handleProjectChange}
                  autoOpen={autoOpenPicker}
                />
              </div>

              {/* Huge timer */}
              <div
                className="mb-4 font-brand font-bold tabular-nums tracking-widest"
                style={{
                  fontSize: scaled(48),
                  color: isTodo ? 'hsl(35 100% 60%)' : 'hsl(var(--primary))',
                  lineHeight: 1,
                }}
              >
                {digits.map((d, i) => (
                  <AnimatedDigit key={i} char={d} />
                ))}
              </div>

              {/* Stop button */}
              <motion.button
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-white"
                whileTap={{ scale: 0.85 }}
                onClick={handleStop}
              >
                <Square className="h-4.5 w-4.5 fill-current" />
              </motion.button>

              {/* Meta */}
              <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                {isTodo ? (
                  <span style={{ color: 'hsl(35 100% 60% / 0.7)' }}>
                    Fill in the details &mdash; this entry needs your attention
                  </span>
                ) : (
                  <>
                    Started <span className="font-medium text-foreground/70">10:23</span>
                    {' '}&middot;{' '}
                    Today&apos;s total <span className="font-medium text-foreground/70">5h 47m</span>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            /* Idle mode: input + recent grid */
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-4 px-5 py-3.5">
                <input
                  className="flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  style={{ fontSize: scaled(14) }}
                  placeholder="What are you working on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleStart();
                  }}
                />
                <MiniProjectPicker value={projectId} onChange={handleProjectChange} />
                <motion.button
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  whileTap={{ scale: 0.85 }}
                  onClick={handleStart}
                >
                  <Play className="h-4 w-4 fill-current" />
                </motion.button>
              </div>

              {/* Recent work grid */}
              <div className="border-t border-border/40 bg-muted/10 px-5 pb-4 pt-2">
                <span
                  className="mb-2 block font-brand font-normal uppercase tracking-widest text-muted-foreground"
                  style={{ fontSize: scaled(9), letterSpacing: '2px' }}
                >
                  Pick up where you left off
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {MOCK_RECENT.slice(0, 3).map((entry, i) => (
                    <RecentCard key={entry.id} entry={entry} onRestart={handleRestart} index={i} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {timer.running && !isTodo && <LiquidEdge />}
        {isTodo && (
          <motion.div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] rounded-b-xl"
            style={{ background: 'hsl(35 100% 60% / 0.4)' }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================
// VARIANT C: THE STRIP
// ============================================================

function StripVariant() {
  const timer = useFakeTimer();
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [autoOpenPicker, setAutoOpenPicker] = useState(false);

  const hasProject = projectId !== null;
  const isTodo = timer.running && !hasProject;

  const handleStart = () => {
    if (!hasProject) setAutoOpenPicker(true);
    timer.start();
  };

  const handleStop = () => {
    timer.stop();
    setTimeout(() => {
      setDescription('');
      setProjectId(null);
      timer.reset();
    }, 2000);
  };

  const handleContinue = () => {
    const last = MOCK_RECENT[0]!;
    setDescription(last.description);
    setProjectId(last.projectId);
    timer.start();
  };

  const handleRestart = (entry: MockRecentEntry) => {
    setDescription(entry.description);
    setProjectId(entry.projectId);
    timer.start();
  };

  const handleProjectChange = (id: string | null) => {
    setProjectId(id);
    setAutoOpenPicker(false);
  };

  const digits = formatTimerDisplay(timer.elapsed).split('');
  const lastEntry = MOCK_RECENT[0]!;

  return (
    <div>
      <motion.div
        className="relative overflow-hidden rounded-xl border"
        animate={{
          borderColor: timer.running
            ? isTodo
              ? 'hsl(35 100% 60% / 0.3)'
              : 'hsl(var(--primary) / 0.3)'
            : 'hsl(var(--border))',
          backgroundColor: timer.running ? 'hsl(var(--t-timer-bg))' : 'transparent',
        }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence mode="wait">
          {timer.running ? (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-5 px-5 py-4"
            >
              <input
                className="flex-1 border-none bg-transparent font-medium text-foreground outline-none placeholder:text-muted-foreground"
                style={{ fontSize: scaled(15) }}
                placeholder={isTodo ? 'What are you working on?' : undefined}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <MiniProjectPicker
                value={projectId}
                onChange={handleProjectChange}
                autoOpen={autoOpenPicker}
              />
              <div
                className="shrink-0 font-brand font-bold tabular-nums tracking-wider"
                style={{
                  fontSize: scaled(28),
                  color: isTodo ? 'hsl(35 100% 60%)' : 'hsl(var(--primary))',
                }}
              >
                {digits.map((d, i) => (
                  <AnimatedDigit key={i} char={d} />
                ))}
              </div>
              <motion.button
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive text-white"
                whileTap={{ scale: 0.85 }}
                onClick={handleStop}
              >
                <Square className="h-4 w-4 fill-current" />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-stretch">
                {/* Last session block */}
                <div className="flex items-center gap-3 border-r border-border/50 bg-muted/15 px-5 py-3.5" style={{ minWidth: '280px' }}>
                  <div className="flex-1">
                    <div
                      className="mb-1 font-brand font-normal uppercase tracking-widest text-muted-foreground"
                      style={{ fontSize: scaled(9), letterSpacing: '2px' }}
                    >
                      Last session
                    </div>
                    <div className="mb-0.5 text-sm font-medium text-foreground">{lastEntry.description}</div>
                    <div className="flex items-center gap-1.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: lastEntry.projectColor }} />
                      {lastEntry.clientName ? `${lastEntry.clientName} · ${lastEntry.projectName}` : lastEntry.projectName}
                    </div>
                  </div>
                  <div className="font-brand text-lg font-bold text-foreground/60 tabular-nums">
                    {formatDur(lastEntry.durationSeconds)}
                  </div>
                  <motion.button
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                    whileTap={{ scale: 0.95 }}
                    onClick={handleContinue}
                  >
                    <Play className="h-3 w-3 fill-current" />
                    Continue
                  </motion.button>
                </div>

                {/* New entry input */}
                <div className="flex flex-1 items-center gap-3 px-5 py-3.5">
                  <span
                    className="shrink-0 font-brand font-normal uppercase tracking-wider text-muted-foreground"
                    style={{ fontSize: scaled(10), letterSpacing: '1px' }}
                  >
                    or
                  </span>
                  <input
                    className="flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                    style={{ fontSize: scaled(14) }}
                    placeholder="Start something new..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleStart();
                    }}
                  />
                  <MiniProjectPicker value={projectId} onChange={handleProjectChange} />
                  <motion.button
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    whileTap={{ scale: 0.85 }}
                    onClick={handleStart}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </motion.button>
                </div>
              </div>

              {/* Recent chips below */}
              <div className="flex items-center gap-2 overflow-x-auto border-t border-border/30 bg-muted/8 px-5 py-2">
                <span
                  className="shrink-0 font-brand font-normal uppercase tracking-widest text-muted-foreground"
                  style={{ fontSize: scaled(9), letterSpacing: '2px' }}
                >
                  Recent
                </span>
                {MOCK_RECENT.slice(1).map((entry) => (
                  <RecentChip key={entry.id} entry={entry} onRestart={handleRestart} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {timer.running && !isTodo && <LiquidEdge />}
        {isTodo && (
          <motion.div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] rounded-b-xl"
            style={{ background: 'hsl(35 100% 60% / 0.4)' }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================
// Section wrapper
// ============================================================

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-12" id={id}>
      <div className="mb-4">
        <h2 className="font-brand text-base font-semibold tracking-wide text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">{children}</div>
    </div>
  );
}

function StateLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 first:mt-0 font-brand text-[9px] font-normal uppercase tracking-widest text-muted-foreground" style={{ letterSpacing: '2px' }}>
      {children}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

const queryClient = new QueryClient();

function DevMissionInner() {
  return (
    <div className="mx-auto max-w-[960px] pb-20">
      <div className="mb-8 text-center">
        <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">
          Timer Bar &mdash; Mission Center
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          3 interactive directions. Click Play/Stop to see state transitions. Start without a project to see the smart-default picker. Recent entries are clickable.
        </p>
      </div>

      <Section
        id="dock"
        title="A &mdash; The Dock"
        subtitle="Two-row control panel. Top row: description, client &middot; project, timer, controls. Bottom shelf: recent entries (idle), session info (running), or &ldquo;saved&rdquo; confirmation (just stopped). Try starting without picking a project first."
      >
        <StateLabel>Interactive &mdash; click to transition</StateLabel>
        <DockVariant />
      </Section>

      <Section
        id="stage"
        title="B &mdash; The Stage"
        subtitle="Timer takes center stage when running &mdash; huge digits, description and project arranged around it. Idle mode shows recent work as a grid of cards. The bar expands vertically when active."
      >
        <StateLabel>Interactive &mdash; click to transition</StateLabel>
        <StageVariant />
      </Section>

      <Section
        id="strip"
        title="C &mdash; The Strip"
        subtitle="Horizontal split: left shows last session with a &ldquo;Continue&rdquo; button, right is for starting something new. One glance tells you where you left off. Recent entries as chips below."
      >
        <StateLabel>Interactive &mdash; click to transition</StateLabel>
        <StripVariant />
      </Section>
    </div>
  );
}

export function DevMissionPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        
          <DevToolbar />
          <div className="p-6">
            <DevMissionInner />
          </div>
        
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
