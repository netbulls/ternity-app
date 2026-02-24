import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Play, Square, FolderKanban, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useAnimationControls } from 'motion/react';
import { scaled } from '@/lib/scaled';

// ============================================================
// Timer state model
// ============================================================
type TimerState = 'idle' | 'incomplete' | 'running';

function useFakeTimer() {
  const [state, setState] = useState<TimerState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState('');
  const [hasProject, setHasProject] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isComplete = description.trim().length > 0 && hasProject;

  // Derive state from running + completeness
  const derivedState: TimerState = state === 'idle' ? 'idle' : isComplete ? 'running' : 'incomplete';

  const start = useCallback(() => {
    setState('incomplete');
    setElapsed(0);
    setDescription('');
    setHasProject(false);
  }, []);

  const stop = useCallback(() => {
    setState('idle');
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (state !== 'idle') {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const display = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return {
    state: derivedState,
    elapsed,
    display,
    description,
    setDescription,
    hasProject,
    setHasProject,
    start,
    stop,
    toggle: state === 'idle' ? start : stop,
  };
}

// ============================================================
// Color palette per state
// ============================================================
function stateColors(state: TimerState) {
  switch (state) {
    case 'idle':
      return {
        accent: 'var(--muted-foreground)',
        accentHsl: 'hsl(var(--muted-foreground))',
        orbBg: 'hsl(var(--muted-foreground) / 0.2)',
        orbShadow: '0 0 0px transparent',
        timerColor: 'hsl(var(--muted-foreground) / 0.15)',
        borderColor: 'hsl(var(--border) / 0.3)',
        cardTint: 'transparent',
        btnBg: 'hsl(var(--primary) / 0.06)',
        btnBorder: 'hsl(var(--primary) / 0.2)',
        btnColor: 'hsl(var(--primary))',
        btnHoverBg: 'hsl(var(--primary) / 0.12)',
        btnHoverBorder: 'hsl(var(--primary) / 0.35)',
      };
    case 'incomplete':
      return {
        accent: '38 92% 50%',
        accentHsl: 'hsl(38 92% 50%)',
        orbBg: 'hsl(38 92% 50%)',
        orbShadow: '0 0 10px hsl(38 92% 50% / 0.4), 0 0 24px hsl(38 92% 50% / 0.15)',
        timerColor: 'hsl(38 92% 50%)',
        borderColor: 'hsl(38 92% 50% / 0.15)',
        cardTint: 'hsl(38 92% 50% / 0.02)',
        btnBg: 'hsl(var(--destructive) / 0.06)',
        btnBorder: 'hsl(var(--destructive) / 0.2)',
        btnColor: 'hsl(var(--destructive))',
        btnHoverBg: 'hsl(var(--destructive) / 0.12)',
        btnHoverBorder: 'hsl(var(--destructive) / 0.35)',
      };
    case 'running':
      return {
        accent: 'var(--primary)',
        accentHsl: 'hsl(var(--primary))',
        orbBg: 'hsl(var(--primary))',
        orbShadow: '0 0 10px hsl(var(--primary) / 0.4), 0 0 24px hsl(var(--primary) / 0.15)',
        timerColor: 'hsl(var(--primary))',
        borderColor: 'hsl(var(--primary) / 0.15)',
        cardTint: 'hsl(var(--primary) / 0.02)',
        btnBg: 'hsl(var(--destructive) / 0.06)',
        btnBorder: 'hsl(var(--destructive) / 0.2)',
        btnColor: 'hsl(var(--destructive))',
        btnHoverBg: 'hsl(var(--destructive) / 0.12)',
        btnHoverBorder: 'hsl(var(--destructive) / 0.35)',
      };
  }
}

// ============================================================
// Animated digit
// ============================================================
function AnimatedDigit({ char }: { char: string }) {
  return (
    <span className="text-box-cap inline-block overflow-hidden" style={{ width: char === ':' ? '0.35em' : '0.6em', textAlign: 'center' }}>
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
// Timer display — color transitions smoothly between states
// ============================================================
function TimerDisplay({ display, state }: { display: string; state: TimerState }) {
  const colors = stateColors(state);
  return (
    <motion.span
      className="text-box-cap font-brand font-bold tabular-nums leading-none"
      style={{ fontSize: scaled(28), letterSpacing: '2px' }}
      animate={{ color: colors.timerColor }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      {display.split('').map((ch, i) => (
        <AnimatedDigit key={i} char={ch} />
      ))}
    </motion.span>
  );
}

// ============================================================
// Status orb — breathing pulse in incomplete, steady glow in running
// ============================================================
function StatusOrb({ state }: { state: TimerState }) {
  const colors = stateColors(state);
  return (
    <div className="relative shrink-0" style={{ width: scaled(10), height: scaled(10) }}>
      {/* Outer breathing ring for incomplete */}
      <AnimatePresence>
        {state === 'incomplete' && (
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 2.2, 1],
              opacity: [0.4, 0, 0.4],
            }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ background: 'hsl(38 92% 50% / 0.3)' }}
          />
        )}
      </AnimatePresence>
      {/* Core orb */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          background: colors.orbBg,
          boxShadow: colors.orbShadow,
        }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
    </div>
  );
}

// ============================================================
// Glass card — border, tint, and edge effects transition per state
// ============================================================
function GlassCard({ state, children }: { state: TimerState; children: React.ReactNode }) {
  const colors = stateColors(state);

  return (
    <motion.div
      className="relative"
      style={{
        borderRadius: scaled(14),
        padding: scaled(14),
        background: 'hsl(var(--card) / 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid',
      }}
      animate={{
        borderColor: colors.borderColor,
      }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      {/* Card tint overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: scaled(14) }}
        animate={{ background: colors.cardTint }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />
      {/* Top highlight (glass refraction) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: '50%',
          background: 'linear-gradient(180deg, hsl(var(--foreground) / 0.02) 0%, transparent 100%)',
          borderRadius: `${scaled(14)} ${scaled(14)} 0 0`,
        }}
      />
      {/* Content */}
      <div className="relative">{children}</div>

      {/* Bottom edge effects */}
      <AnimatePresence mode="wait">
        {state === 'running' && (
          <motion.div
            key="liquid-edge"
            className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
            style={{ height: 3, borderRadius: `0 0 ${scaled(14)} ${scaled(14)}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="absolute top-0 h-full"
              style={{ width: '35%', background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.6) 0%, transparent 70%)' }}
              animate={{ left: ['-10%', '75%'] }}
              transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
            />
            <motion.div
              className="absolute top-0 h-full"
              style={{ width: '20%', background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.4) 0%, transparent 70%)' }}
              animate={{ left: ['80%', '5%'] }}
              transition={{ duration: 7, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
            />
          </motion.div>
        )}
        {state === 'incomplete' && (
          <motion.div
            key="incomplete-edge"
            className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
            style={{
              height: 2,
              borderRadius: `0 0 ${scaled(14)} ${scaled(14)}`,
              background: 'hsl(var(--border) / 0.08)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="absolute top-0 h-full"
              style={{
                width: '40%',
                background: 'radial-gradient(ellipse at center, hsl(38 92% 50% / 0.6) 0%, transparent 70%)',
              }}
              animate={{ left: ['-40%', '100%'] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: [0.4, 0, 0.6, 1],
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================
// Description input — matches real app exactly
// ============================================================
function DescInput({
  state,
  value,
  onChange,
}: {
  state: TimerState;
  value: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [animClass, setAnimClass] = useState('');
  const prevValueRef = useRef('');
  const isRunning = state !== 'idle';

  const commit = useCallback(() => {
    if (value === prevValueRef.current) return;
    const cleared = value.trim().length === 0 && prevValueRef.current.trim().length > 0;
    const filled = value.trim().length > 0;
    prevValueRef.current = value;
    if (cleared || filled) {
      setAnimClass(cleared ? 'input-clear' : 'input-commit');
      setTimeout(() => setAnimClass(''), 500);
    }
  }, [value]);

  return (
    <div>
      <motion.input
        className={`w-full text-foreground outline-none placeholder:italic placeholder:text-muted-foreground/40 ${animClass}`}
        style={{
          padding: `${scaled(5.5)} ${scaled(10)}`,
          fontSize: scaled(13),
          fontWeight: 500,
          background: 'transparent',
          border: '1px solid',
          borderRadius: scaled(8),
          fontFamily: "'Inter', sans-serif",
        }}
        animate={focused && !animClass ? breathingBorder(state) : { borderColor: 'transparent' }}
        transition={focused && !animClass ? breathingBorderTransition : { duration: 0.2 }}
        placeholder={isRunning ? 'Add description...' : 'What are you working on?'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
            commit();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
      />
    </div>
  );
}

// ============================================================
// Project pill — matches real app exactly
// ============================================================
function breathingBorder(state: TimerState) {
  const color = state === 'incomplete' ? '38 92% 50%' : 'var(--primary)';
  return {
    borderColor: [
      `hsl(${color} / 0.3)`,
      `hsl(${color} / 0.6)`,
      `hsl(${color} / 0.3)`,
    ],
  };
}
const breathingBorderTransition = {
  duration: 2,
  repeat: Infinity,
  ease: 'easeInOut' as const,
};

// Shared keyframes (pill-pop from globals.css + input-commit)
const sharedStyles = document.createElement('style');
sharedStyles.textContent = `
@keyframes pill-pop {
  0% { transform: scale(1); border-color: hsl(var(--primary) / 0.4); }
  40% { transform: scale(1.1); border-color: hsl(142 71% 45% / 0.8); }
  100% { transform: scale(1); border-color: hsl(var(--border)); }
}
.pill-pop { animation: pill-pop 0.45s ease-out; will-change: transform, border-color; }

@keyframes input-commit {
  0% { border-color: hsl(var(--primary) / 0.6); background: hsl(var(--primary) / 0.04); }
  50% { border-color: hsl(142 71% 45% / 0.8); background: hsl(var(--primary) / 0.06); }
  100% { border-color: transparent; background: transparent; }
}
.input-commit { animation: input-commit 0.5s ease-out; will-change: border-color, background; }

@keyframes input-clear {
  0% { border-color: hsl(38 92% 50% / 0.6); background: hsl(38 92% 50% / 0.04); }
  50% { border-color: hsl(38 92% 50% / 0.8); background: hsl(38 92% 50% / 0.06); }
  100% { border-color: transparent; background: transparent; }
}
.input-clear { animation: input-clear 0.5s ease-out; will-change: border-color, background; }

@keyframes pill-clear {
  0% { transform: scale(1); border-color: hsl(38 92% 50% / 0.4); }
  40% { transform: scale(1.1); border-color: hsl(38 92% 50% / 0.8); }
  100% { transform: scale(1); border-color: transparent; }
}
.pill-clear { animation: pill-clear 0.45s ease-out; will-change: transform, border-color; }

.text-box-cap { text-box: trim-both cap alphabetic; }
`;
if (!document.querySelector('[data-shared-styles]')) {
  sharedStyles.setAttribute('data-shared-styles', '');
  document.head.appendChild(sharedStyles);
}

function ProjectPill({ state, hasProject, onToggle }: { state: TimerState; hasProject: boolean; onToggle: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pillAnim, setPillAnim] = useState('');

  const handlePillClick = () => {
    setPickerOpen((o) => !o);
  };

  const handleSelect = () => {
    onToggle();
    setPickerOpen(false);
    setPillAnim('pill-pop');
    setTimeout(() => setPillAnim(''), 500);
  };

  const handleDeselect = () => {
    onToggle();
    setPickerOpen(false);
    setPillAnim('pill-clear');
    setTimeout(() => setPillAnim(''), 500);
  };

  return (
    <div
      className="relative flex items-center"
      style={{ marginTop: scaled(4), minWidth: 0 }}
    >
      <motion.span
        className={`flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground ${pillAnim}`}
        style={{
          gap: scaled(5),
          fontSize: scaled(11),
          border: '1px solid',
          borderRadius: scaled(12),
          padding: `${scaled(2)} ${scaled(8)}`,
          margin: `0 ${scaled(-8)}`,
        }}
        animate={pickerOpen ? breathingBorder(state) : { borderColor: 'transparent' }}
        transition={pickerOpen ? breathingBorderTransition : { duration: 0.2 }}
        onClick={handlePillClick}
      >
        {hasProject ? (
          <>
            <div
              className="shrink-0 rounded-full"
              style={{ width: scaled(6), height: scaled(6), background: 'hsl(var(--primary))' }}
            />
            <span>Acme Corp</span>
            <span className="text-muted-foreground/30">&rsaquo;</span>
            <span>Website Redesign</span>
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
      </motion.span>
      {/* Fake picker dropdown */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            className="absolute left-0 z-50 overflow-hidden"
            style={{
              top: '100%',
              marginTop: scaled(4),
              width: scaled(200),
              borderRadius: scaled(8),
              border: '1px solid hsl(var(--border) / 0.3)',
              background: 'hsl(var(--card) / 0.95)',
              backdropFilter: 'blur(12px)',
              padding: scaled(4),
            }}
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            {hasProject ? (
              <button
                className="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                style={{ fontSize: scaled(11), gap: scaled(6) }}
                onClick={handleDeselect}
              >
                <FolderKanban style={{ width: scaled(10), height: scaled(10), opacity: 0.4 }} />
                No project
              </button>
            ) : (
              <button
                className="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                style={{ fontSize: scaled(11), gap: scaled(6) }}
                onClick={handleSelect}
              >
                <div className="shrink-0 rounded-full" style={{ width: scaled(6), height: scaled(6), background: 'hsl(var(--primary))' }} />
                Acme Corp &rsaquo; Website Redesign
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Button infrastructure
// ============================================================
type BtnSize = 'small' | 'big';
type BtnProps = { state: TimerState; onClick: (e: React.MouseEvent) => void; size?: BtnSize };
const btnBase = "relative flex cursor-pointer items-center justify-center overflow-hidden font-brand font-semibold uppercase";

function btnSizeStyles(size: BtnSize) {
  return size === 'big'
    ? { fontSize: scaled(10), letterSpacing: '0.8px', height: scaled(34), width: '100%' as const, borderRadius: scaled(8), gap: scaled(6) }
    : { fontSize: scaled(10), letterSpacing: '0.5px', height: scaled(30), width: scaled(72), borderRadius: scaled(10), gap: scaled(6) };
}

function btnLabel(size: BtnSize, isRunning: boolean) {
  return size === 'big' ? (isRunning ? 'Stop Timer' : 'Start Timer') : (isRunning ? 'Stop' : 'Start');
}

function BtnLabel({ isRunning, label }: { isRunning: boolean; label: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={isRunning ? 'stop' : 'start'}
        className="relative z-[1] flex items-center"
        style={{ gap: scaled(6) }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {isRunning
          ? <Square style={{ width: scaled(11), height: scaled(11) }} fill="currentColor" />
          : <Play style={{ width: scaled(11), height: scaled(11) }} fill="currentColor" />}
        {label}
      </motion.span>
    </AnimatePresence>
  );
}

// ============================================================
// Original button — Ripple + bounce
// ============================================================
function OriginalButton({ state, onClick, size = 'small' }: BtnProps) {
  const isRunning = state !== 'idle';
  const colors = stateColors(state);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const nextId = useRef(0);

  const fire = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = nextId.current++;
    const color = isRunning ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--primary) / 0.2)';
    setRipples((r) => [...r, { id, x, y, color }]);
    setTimeout(() => setRipples((r) => r.filter((ri) => ri.id !== id)), 600);
    onClick(e);
  }, [onClick, isRunning]);

  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        backdropFilter: 'blur(8px)',
        border: '1px solid',
      }}
      animate={{
        background: colors.btnBg,
        borderColor: colors.btnBorder,
        color: colors.btnColor,
      }}
      whileHover={{
        background: colors.btnHoverBg,
        borderColor: colors.btnHoverBorder,
      }}
      whileTap={{ scale: size === 'big' ? 0.97 : 0.9 }}
      onClick={fire}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
    >
      {ripples.map((r) => (
        <motion.span key={r.id} className="pointer-events-none absolute rounded-full"
          style={{ width: 40, height: 40, left: r.x - 20, top: r.y - 20, background: r.color }}
          initial={{ scale: 0, opacity: 0.4 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      ))}
      <BtnLabel isRunning={isRunning} label={btnLabel(size, isRunning)} />
    </motion.button>
  );
}

// ============================================================
// Elastic Jelly button
// ============================================================
function ElasticJellyButton({ state, onClick, size = 'small' }: BtnProps) {
  const isRunning = state !== 'idle';
  const colors = stateColors(state);
  const controls = useAnimationControls();

  const fire = useCallback(async (e: React.MouseEvent) => {
    await controls.start({
      scaleX: [1, 1.3, 0.8, 1.15, 0.95, 1.02, 1],
      scaleY: [1, 0.7, 1.25, 0.9, 1.08, 0.98, 1],
      transition: { duration: 0.6, times: [0, 0.15, 0.3, 0.45, 0.65, 0.8, 1] },
    });
    onClick(e);
  }, [onClick, controls]);

  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        border: '1px solid',
      }}
      animate={{
        background: colors.btnBg,
        borderColor: colors.btnBorder,
        color: colors.btnColor,
      }}
      whileHover={{
        scaleX: 1.05, scaleY: 0.97,
        background: colors.btnHoverBg,
      }}
      onClick={fire}
      transition={{ type: 'spring', damping: 8, stiffness: 200 }}
    >
      <BtnLabel isRunning={isRunning} label={btnLabel(size, isRunning)} />
    </motion.button>
  );
}

// ============================================================
// Magnetic button
// ============================================================
function MagneticButton({ state, onClick, size = 'small' }: BtnProps) {
  const isRunning = state !== 'idle';
  const colors = stateColors(state);
  const ref = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pull = size === 'big' ? 0.15 : 0.3;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setOffset({ x: (e.clientX - cx) * pull, y: (e.clientY - cy) * pull });
  }, [pull]);

  const handleMouseLeave = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  const fire = useCallback((e: React.MouseEvent) => {
    setOffset({ x: 0, y: 0 });
    onClick(e);
  }, [onClick]);

  return (
    <motion.button
      ref={ref}
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        border: '1px solid',
      }}
      animate={{
        x: offset.x,
        y: offset.y,
        background: colors.btnBg,
        borderColor: colors.btnBorder,
        color: colors.btnColor,
      }}
      whileTap={{ scale: size === 'big' ? 0.97 : 0.85 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={fire}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
    >
      <BtnLabel isRunning={isRunning} label={btnLabel(size, isRunning)} />
    </motion.button>
  );
}

// ============================================================
// Variants
// ============================================================
const VARIANTS = {
  'original': { title: 'Original', desc: 'Ripple + bounce', Btn: OriginalButton },
  'elastic': { title: 'Elastic Jelly', desc: 'Squash & stretch', Btn: ElasticJellyButton },
  'magnetic': { title: 'Magnetic', desc: 'Follows cursor', Btn: MagneticButton },
} as const;

type VariantKey = keyof typeof VARIANTS;

// ============================================================
// Timer card — full 3-state interactive prototype
// ============================================================
function TimerCard({ variant, btnSize }: { variant: VariantKey; btnSize: BtnSize }) {
  const timer = useFakeTimer();
  const { Btn } = VARIANTS[variant];

  return (
    <div
      style={{
        width: scaled(345),
        borderRadius: scaled(14),
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0,0,0,0.4), 0 0 0 1px hsl(var(--border) / 0.15)',
      }}
    >
      <div style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', padding: scaled(8) }}>
        <GlassCard state={timer.state}>
          {btnSize === 'big' ? (
            <>
              <div className="relative flex items-center" style={{ gap: scaled(10), marginBottom: scaled(7) }}>
                <StatusOrb state={timer.state} />
                <TimerDisplay display={timer.display} state={timer.state} />
              </div>
              <DescInput
                state={timer.state}
                value={timer.description}
                onChange={timer.setDescription}
              />
              <ProjectPill state={timer.state} hasProject={timer.hasProject} onToggle={() => timer.setHasProject(!timer.hasProject)} />
              <div style={{ marginTop: scaled(10) }}>
                <Btn state={timer.state} onClick={timer.toggle} size="big" />
              </div>
            </>
          ) : (
            <>
              <div className="relative flex items-center" style={{ gap: scaled(10), marginBottom: scaled(7) }}>
                <StatusOrb state={timer.state} />
                <TimerDisplay display={timer.display} state={timer.state} />
                <Btn state={timer.state} onClick={timer.toggle} size="small" />
              </div>
              <DescInput
                state={timer.state}
                value={timer.description}
                onChange={timer.setDescription}
              />
              <ProjectPill state={timer.state} hasProject={timer.hasProject} onToggle={() => timer.setHasProject(!timer.hasProject)} />
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ============================================================
// State legend
// ============================================================
function StateLegend() {
  return (
    <div className="flex items-center justify-center" style={{ gap: scaled(20), marginTop: scaled(8) }}>
      {[
        { label: 'Idle', color: 'hsl(var(--muted-foreground) / 0.3)', desc: 'Not running' },
        { label: 'Incomplete', color: 'hsl(38 92% 50%)', desc: 'Missing desc or project' },
        { label: 'Running', color: 'hsl(var(--primary))', desc: 'All fields filled' },
      ].map((s) => (
        <div key={s.label} className="flex items-center" style={{ gap: scaled(6) }}>
          <div className="rounded-full" style={{ width: scaled(8), height: scaled(8), background: s.color }} />
          <span style={{ fontSize: scaled(11), color: 'hsl(var(--foreground) / 0.4)' }}>
            <strong>{s.label}</strong> — {s.desc}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Page content
// ============================================================
function TimerLooksContent() {
  const variantKeys = Object.keys(VARIANTS) as VariantKey[];

  return (
    <div className="mx-auto px-6 py-8" style={{ maxWidth: 1600 }}>
      <h1
        className="text-center font-brand font-normal uppercase tracking-[5px] text-foreground/30"
        style={{ fontSize: scaled(11) }}
      >
        Timer States
      </h1>
      <p className="mt-1 text-center text-xs text-foreground/15">
        3 states: idle → incomplete (amber) → running (green). Click Start, then type description + click project to transition.
      </p>
      <StateLegend />

      {/* Column headers */}
      <div className="mx-auto mt-10 flex justify-center" style={{ gap: scaled(20), maxWidth: scaled(750) }}>
        <div className="font-brand text-xs font-semibold uppercase tracking-widest text-foreground/20" style={{ width: scaled(345), textAlign: 'center' }}>
          Inline Button
        </div>
        <div className="font-brand text-xs font-semibold uppercase tracking-widest text-foreground/20" style={{ width: scaled(345), textAlign: 'center' }}>
          Full-Width Bar
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center" style={{ gap: scaled(36) }}>
        {variantKeys.map((key) => (
          <div key={key}>
            <div className="text-center" style={{ marginBottom: scaled(10) }}>
              <div className="font-brand text-sm font-semibold uppercase tracking-widest text-foreground/40">
                {VARIANTS[key].title}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/40">{VARIANTS[key].desc}</div>
            </div>
            <div className="flex justify-center" style={{ gap: scaled(20) }}>
              <TimerCard variant={key} btnSize="small" />
              <TimerCard variant={key} btnSize="big" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Page shell
// ============================================================
export function DevTimerLooksPage() {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        
          <div className="min-h-screen bg-background text-foreground">
            <DevToolbar />
            <TimerLooksContent />
          </div>
        
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
