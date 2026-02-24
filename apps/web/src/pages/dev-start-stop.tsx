import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Play, Square, FolderKanban, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, useAnimationControls } from 'motion/react';
import { scaled } from '@/lib/scaled';

// ============================================================
// Fake timer hook
// ============================================================
function useFakeTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setRunning(true);
    setElapsed(0);
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

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const display = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return { running, elapsed, display, toggle: running ? stop : start };
}

// ============================================================
// Animated digit
// ============================================================
function AnimatedDigit({ char }: { char: string }) {
  return (
    <span className="inline-block overflow-hidden" style={{ width: char === ':' ? '0.35em' : '0.6em', textAlign: 'center' }}>
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

function TimerDisplay({ display, running }: { display: string; running: boolean }) {
  return (
    <span
      className="font-brand font-bold tabular-nums leading-none transition-colors duration-300"
      style={{
        fontSize: scaled(28),
        letterSpacing: '2px',
        color: running ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.15)',
      }}
    >
      {display.split('').map((ch, i) => (
        <AnimatedDigit key={i} char={ch} />
      ))}
    </span>
  );
}

// ============================================================
// Shared card parts
// ============================================================
function GlassCard({ running, children }: { running: boolean; children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden transition-[border-color] duration-300"
      style={{
        borderRadius: scaled(14),
        padding: scaled(14),
        background: 'hsl(var(--card) / 0.6)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${running ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--border) / 0.3)'}`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: '50%',
          background: 'linear-gradient(180deg, hsl(var(--foreground) / 0.02) 0%, transparent 100%)',
          borderRadius: `${scaled(14)} ${scaled(14)} 0 0`,
        }}
      />
      {children}
      <div
        className="absolute inset-x-0 bottom-0 overflow-hidden transition-opacity duration-400"
        style={{ height: 3, borderRadius: `0 0 ${scaled(14)} ${scaled(14)}`, opacity: running ? 1 : 0 }}
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
      </div>
    </div>
  );
}

function StatusOrb({ running }: { running: boolean }) {
  return (
    <motion.div
      className="shrink-0 rounded-full"
      style={{ width: scaled(10), height: scaled(10) }}
      animate={{
        background: running ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.2)',
        boxShadow: running ? '0 0 8px hsl(var(--primary) / 0.5), 0 0 20px hsl(var(--primary) / 0.2)' : '0 0 0 transparent',
      }}
      transition={{ duration: 0.3 }}
    />
  );
}

function DescInput() {
  return (
    <input
      className="w-full border border-transparent bg-transparent font-sans font-medium text-foreground outline-none placeholder:italic placeholder:text-muted-foreground/40"
      style={{ fontSize: scaled(13), padding: `${scaled(8)} ${scaled(10)}`, borderRadius: scaled(8) }}
      placeholder="What are you working on?"
      readOnly
    />
  );
}

function ProjectPill() {
  return (
    <div
      className="flex cursor-pointer items-center text-muted-foreground"
      style={{ gap: scaled(5), fontSize: scaled(11), marginTop: scaled(4), padding: `${scaled(2)} ${scaled(8)}`, borderRadius: scaled(12), marginLeft: scaled(-8) }}
    >
      <FolderKanban style={{ width: scaled(10), height: scaled(10) }} />
      <span>No project</span>
      <ChevronDown style={{ width: scaled(8), height: scaled(8), opacity: 0.5 }} />
    </div>
  );
}

// ============================================================
// Shared button props
// ============================================================
type BtnSize = 'small' | 'big';
type BtnProps = { running: boolean; onClick: (e: React.MouseEvent) => void; size?: BtnSize };
const btnBase = "relative flex cursor-pointer items-center justify-center overflow-hidden font-brand font-semibold uppercase";

function btnSizeStyles(size: BtnSize) {
  return size === 'big'
    ? { fontSize: scaled(10), letterSpacing: '0.8px', height: scaled(34), width: '100%' as const, borderRadius: scaled(8), gap: scaled(6) }
    : { fontSize: scaled(10), letterSpacing: '0.5px', height: scaled(30), width: scaled(72), borderRadius: scaled(10), gap: scaled(6) };
}

function btnLabel(size: BtnSize, running: boolean) {
  return size === 'big' ? (running ? 'Stop Timer' : 'Start Timer') : (running ? 'Stop' : 'Start');
}

function BtnLabel({ running, label }: { running: boolean; label: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={running ? 'stop' : 'start'}
        className="relative z-[1] flex items-center"
        style={{ gap: scaled(6) }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {running
          ? <Square style={{ width: scaled(11), height: scaled(11) }} fill="currentColor" />
          : <Play style={{ width: scaled(11), height: scaled(11) }} fill="currentColor" />}
        {label}
      </motion.span>
    </AnimatePresence>
  );
}

// ============================================================
// 0 / ORIGINAL — Ripple + bounce (the baseline)
// ============================================================
function OriginalButton({ running, onClick, size = 'small' }: BtnProps) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const nextId = useRef(0);

  const fire = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = nextId.current++;
    const color = running ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--primary) / 0.2)';
    setRipples((r) => [...r, { id, x, y, color }]);
    setTimeout(() => setRipples((r) => r.filter((ri) => ri.id !== id)), 600);
    onClick(e);
  }, [onClick, running]);

  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        backdropFilter: 'blur(8px)',
        background: running ? 'hsl(var(--destructive) / 0.06)' : 'hsl(var(--primary) / 0.06)',
        border: `1px solid ${running ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--primary) / 0.2)'}`,
        color: running ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
      }}
      whileHover={{
        background: running ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--primary) / 0.12)',
        borderColor: running ? 'hsl(var(--destructive) / 0.35)' : 'hsl(var(--primary) / 0.35)',
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
      <BtnLabel running={running} label={btnLabel(size, running)} />
    </motion.button>
  );
}

// ============================================================
// 1 / SHOCKWAVE — Concentric rings explode on click
// ============================================================
function ShockwaveButton({ running, onClick, size = 'small' }: BtnProps) {
  const [rings, setRings] = useState<number[]>([]);
  const nextId = useRef(0);

  const fire = useCallback((e: React.MouseEvent) => {
    const id = nextId.current++;
    setRings((r) => [...r, id]);
    setTimeout(() => setRings((r) => r.filter((ri) => ri !== id)), 800);
    onClick(e);
  }, [onClick]);

  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        background: running ? 'hsl(var(--destructive) / 0.06)' : 'hsl(var(--primary) / 0.06)',
        border: `1px solid ${running ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--primary) / 0.2)'}`,
        color: running ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
      }}
      whileHover={{ scale: size === 'big' ? 1.02 : 1.05 }}
      whileTap={{ scale: size === 'big' ? 0.97 : 0.85 }}
      onClick={fire}
      transition={{ type: 'spring', damping: 12, stiffness: 400 }}
    >
      {rings.map((id) => (
        <motion.span key={id} className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ border: `2px solid ${running ? 'hsl(var(--destructive) / 0.5)' : 'hsl(var(--primary) / 0.5)'}` }}
          initial={{ scale: 0.5, opacity: 0.8 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      ))}
      {rings.map((id) => (
        <motion.span key={`inner-${id}`} className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ border: `1px solid ${running ? 'hsl(var(--destructive) / 0.3)' : 'hsl(var(--primary) / 0.3)'}` }}
          initial={{ scale: 0.5, opacity: 0.6 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.05 }}
        />
      ))}
      <BtnLabel running={running} label={btnLabel(size, running)} />
    </motion.button>
  );
}

// ============================================================
// 2 / ELASTIC JELLY — Extreme squash & stretch with wobble
// ============================================================
function ElasticJellyButton({ running, onClick, size = 'small' }: BtnProps) {
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
        background: running ? 'hsl(var(--destructive) / 0.06)' : 'hsl(var(--primary) / 0.06)',
        border: `1px solid ${running ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--primary) / 0.2)'}`,
        color: running ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
      }}
      animate={controls}
      whileHover={{
        scaleX: 1.05, scaleY: 0.97,
        background: running ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--primary) / 0.12)',
      }}
      onClick={fire}
      transition={{ type: 'spring', damping: 8, stiffness: 200 }}
    >
      <BtnLabel running={running} label={btnLabel(size, running)} />
    </motion.button>
  );
}

// ============================================================
// 3 / GLITCH MATRIX — RGB split + text scramble
// ============================================================
function GlitchButton({ running, onClick, size = 'small' }: BtnProps) {
  const [glitching, setGlitching] = useState(false);
  const label = btnLabel(size, running);

  const fire = useCallback((e: React.MouseEvent) => {
    setGlitching(true);
    setTimeout(() => { setGlitching(false); onClick(e); }, 400);
  }, [onClick]);

  const color = running ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';
  const glitchText = running ? `■ ${label.toUpperCase()}` : `▶ ${label.toUpperCase()}`;

  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        background: running ? 'hsl(var(--destructive) / 0.06)' : 'hsl(var(--primary) / 0.06)',
        border: `1px solid ${running ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--primary) / 0.2)'}`,
        color,
      }}
      whileHover={{
        background: running ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--primary) / 0.12)',
      }}
      whileTap={{ scale: size === 'big' ? 0.97 : 0.95 }}
      onClick={fire}
    >
      {glitching && (
        <>
          <motion.span className="pointer-events-none absolute inset-0 flex items-center justify-center font-brand font-semibold uppercase"
            style={{ fontSize: scaled(10), color: 'rgba(255,0,0,0.6)', mixBlendMode: 'screen' }}
            animate={{ x: [0, -3, 2, -1, 3, 0], clipPath: ['inset(0 0 60% 0)', 'inset(30% 0 20% 0)', 'inset(60% 0 0 0)', 'inset(10% 0 50% 0)', 'inset(0 0 0 0)'] }}
            transition={{ duration: 0.4, times: [0, 0.2, 0.4, 0.6, 1] }}
          >{glitchText}</motion.span>
          <motion.span className="pointer-events-none absolute inset-0 flex items-center justify-center font-brand font-semibold uppercase"
            style={{ fontSize: scaled(10), color: 'rgba(0,255,255,0.6)', mixBlendMode: 'screen' }}
            animate={{ x: [0, 3, -2, 1, -3, 0], clipPath: ['inset(60% 0 0 0)', 'inset(20% 0 30% 0)', 'inset(0 0 60% 0)', 'inset(50% 0 10% 0)', 'inset(0 0 0 0)'] }}
            transition={{ duration: 0.4, times: [0, 0.2, 0.4, 0.6, 1] }}
          >{glitchText}</motion.span>
          <motion.span className="pointer-events-none absolute inset-0"
            style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)', mixBlendMode: 'overlay' }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5, 1, 0] }}
            transition={{ duration: 0.4 }}
          />
        </>
      )}
      <motion.span className="relative z-[1]" animate={{ opacity: glitching ? 0 : 1 }}>
        <BtnLabel running={running} label={label} />
      </motion.span>
    </motion.button>
  );
}

// ============================================================
// 4 / AURORA BORDER — Conic gradient spins around the border
// ============================================================
function AuroraButton({ running, onClick, size = 'small' }: BtnProps) {
  const color = running ? 'var(--destructive)' : 'var(--primary)';
  const sz = btnSizeStyles(size);

  return (
    <div className={`relative${size === 'small' ? ' ml-auto' : ' w-full'}`} style={{ width: sz.width, height: sz.height, borderRadius: sz.borderRadius }}>
      <motion.div
        className="absolute"
        style={{
          inset: -2,
          borderRadius: sz.borderRadius + 2,
          background: `conic-gradient(from 0deg, hsl(${color} / 0.6), hsl(${color} / 0.05), hsl(${color} / 0.3), hsl(${color} / 0.05), hsl(${color} / 0.6))`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, ease: 'linear', repeat: Infinity }}
      />
      <motion.button
        className={`${btnBase} h-full w-full`}
        style={{
          position: 'relative',
          fontSize: sz.fontSize, letterSpacing: size === 'big' ? '0.8px' : '0.5px',
          borderRadius: sz.borderRadius, gap: sz.gap,
          background: 'hsl(var(--card) / 0.9)',
          color: `hsl(${color})`,
        }}
        whileHover={{
          background: running ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--primary) / 0.1)',
        }}
        whileTap={{ scale: size === 'big' ? 0.97 : 0.9 }}
        onClick={onClick}
        transition={{ type: 'spring', damping: 15, stiffness: 300 }}
      >
        <BtnLabel running={running} label={btnLabel(size, running)} />
      </motion.button>
    </div>
  );
}

// ============================================================
// 5 / PARTICLE BURST — Particles explode outward on click
// ============================================================
function ParticleBurstButton({ running, onClick, size = 'small' }: BtnProps) {
  const [particles, setParticles] = useState<{ id: number; angle: number; dist: number; size: number }[]>([]);
  const nextId = useRef(0);

  const fire = useCallback((e: React.MouseEvent) => {
    const count = size === 'big' ? 18 : 12;
    const dist = size === 'big' ? 50 : 30;
    const batch = Array.from({ length: count }, () => ({
      id: nextId.current++,
      angle: Math.random() * 360,
      dist: dist + Math.random() * 40,
      size: 3 + Math.random() * 4,
    }));
    setParticles((p) => [...p, ...batch]);
    setTimeout(() => setParticles((p) => p.filter((pi) => !batch.some((b) => b.id === pi.id))), 700);
    onClick(e);
  }, [onClick, size]);

  const color = running ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';

  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        background: running ? 'hsl(var(--destructive) / 0.06)' : 'hsl(var(--primary) / 0.06)',
        border: `1px solid ${running ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--primary) / 0.2)'}`,
        color,
      }}
      whileHover={{ background: running ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--primary) / 0.12)' }}
      whileTap={{ scale: size === 'big' ? 0.97 : 0.9 }}
      onClick={fire}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
    >
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.dist;
        const ty = Math.sin(rad) * p.dist;
        return (
          <motion.span key={p.id} className="pointer-events-none absolute rounded-full"
            style={{ width: p.size, height: p.size, background: color, left: '50%', top: '50%', marginLeft: -p.size / 2, marginTop: -p.size / 2 }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: tx, y: ty, opacity: 0, scale: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
      <BtnLabel running={running} label={btnLabel(size, running)} />
    </motion.button>
  );
}

// ============================================================
// 6 / NEON FLICKER — Neon sign buzz with glow flicker
// ============================================================
function NeonFlickerButton({ running, onClick, size = 'small' }: BtnProps) {
  const [flickering, setFlickering] = useState(false);
  const color = running ? 'var(--destructive)' : 'var(--primary)';

  const fire = useCallback((e: React.MouseEvent) => {
    setFlickering(true);
    setTimeout(() => { setFlickering(false); onClick(e); }, 500);
  }, [onClick]);

  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        background: 'transparent',
        border: `1px solid hsl(${color} / 0.4)`,
        color: `hsl(${color})`,
        textShadow: `0 0 6px hsl(${color} / 0.5), 0 0 20px hsl(${color} / 0.3)`,
      }}
      animate={flickering ? {
        opacity: [1, 0.3, 1, 0.5, 1, 0.2, 1, 0.8, 1],
        boxShadow: [
          `0 0 10px hsl(${color} / 0.4), inset 0 0 10px hsl(${color} / 0.1)`,
          `0 0 2px hsl(${color} / 0.1), inset 0 0 2px hsl(${color} / 0.05)`,
          `0 0 15px hsl(${color} / 0.5), inset 0 0 15px hsl(${color} / 0.15)`,
          `0 0 3px hsl(${color} / 0.1), inset 0 0 3px hsl(${color} / 0.05)`,
          `0 0 20px hsl(${color} / 0.6), inset 0 0 20px hsl(${color} / 0.2)`,
        ],
      } : {
        opacity: 1,
        boxShadow: `0 0 10px hsl(${color} / 0.3), inset 0 0 10px hsl(${color} / 0.05)`,
      }}
      whileHover={{
        boxShadow: `0 0 20px hsl(${color} / 0.5), inset 0 0 15px hsl(${color} / 0.1)`,
      }}
      transition={flickering ? { duration: 0.5, times: [0, 0.1, 0.2, 0.35, 0.5, 0.6, 0.7, 0.85, 1] } : { duration: 0.3 }}
      onClick={fire}
    >
      <BtnLabel running={running} label={btnLabel(size, running)} />
    </motion.button>
  );
}

// ============================================================
// 7 / MAGNETIC PULL — Button tracks cursor + snaps on click
// ============================================================
function MagneticButton({ running, onClick, size = 'small' }: BtnProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const pull = size === 'big' ? 0.15 : 0.3;
  const springX = useSpring(x, { damping: 15, stiffness: 200 });
  const springY = useSpring(y, { damping: 15, stiffness: 200 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * pull);
    y.set((e.clientY - cy) * pull);
  }, [x, y, pull]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  const fire = useCallback((e: React.MouseEvent) => {
    x.set(0);
    y.set(0);
    onClick(e);
  }, [onClick, x, y]);

  return (
    <motion.button
      ref={ref}
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        background: running ? 'hsl(var(--destructive) / 0.06)' : 'hsl(var(--primary) / 0.06)',
        border: `1px solid ${running ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--primary) / 0.2)'}`,
        color: running ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
        x: springX,
        y: springY,
      }}
      whileTap={{ scale: size === 'big' ? 0.97 : 0.85 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={fire}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
    >
      <BtnLabel running={running} label={btnLabel(size, running)} />
    </motion.button>
  );
}

// ============================================================
// 8 / HEARTBEAT — Organic pulsing rhythm when running
// ============================================================
function HeartbeatButton({ running, onClick, size = 'small' }: BtnProps) {
  const c = running ? 'var(--destructive)' : 'var(--primary)';
  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        background: `hsl(${c} / 0.06)`,
        border: `1px solid hsl(${c} / 0.2)`,
        color: `hsl(${c})`,
      }}
      animate={running ? {
        scale: size === 'big' ? [1, 1.03, 1, 1.05, 1] : [1, 1.08, 1, 1.12, 1],
        boxShadow: [
          `0 0 0 0 hsl(${c} / 0)`,
          `0 0 0 4px hsl(${c} / 0.15)`,
          `0 0 0 0 hsl(${c} / 0)`,
          `0 0 0 6px hsl(${c} / 0.2)`,
          `0 0 0 0 hsl(${c} / 0)`,
        ],
      } : { scale: 1, boxShadow: '0 0 0 0 transparent' }}
      transition={running ? {
        duration: 1.2,
        repeat: Infinity,
        times: [0, 0.15, 0.35, 0.5, 1],
        ease: 'easeInOut',
      } : { duration: 0.3 }}
      whileHover={{ background: `hsl(${c} / 0.12)` }}
      whileTap={{ scale: size === 'big' ? 0.97 : 0.85 }}
      onClick={onClick}
    >
      <BtnLabel running={running} label={btnLabel(size, running)} />
    </motion.button>
  );
}

// ============================================================
// 9 / LIQUID FILL — Color fills up from bottom on hover, drains on click
// ============================================================
function LiquidFillButton({ running, onClick, size = 'small' }: BtnProps) {
  const [hovered, setHovered] = useState(false);
  const [filling, setFilling] = useState(false);
  const color = running ? 'var(--destructive)' : 'var(--primary)';

  const fire = useCallback((e: React.MouseEvent) => {
    setFilling(true);
    setTimeout(() => { setFilling(false); onClick(e); }, 350);
  }, [onClick]);

  return (
    <motion.button
      className={btnBase + (size === 'small' ? ' ml-auto' : ' w-full')}
      style={{
        ...btnSizeStyles(size),
        background: 'transparent',
        border: `1px solid hsl(${color} / 0.25)`,
        color: `hsl(${color})`,
      }}
      whileTap={{ scale: size === 'big' ? 0.97 : 0.9 }}
      onClick={fire}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
    >
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: `hsl(${color} / 0.12)`, transformOrigin: 'bottom' }}
        animate={{ scaleY: filling ? [1, 0] : hovered ? 1 : 0 }}
        transition={filling ? { duration: 0.35, ease: [0.4, 0, 0.2, 1] } : { duration: 0.3, ease: 'easeOut' }}
      />
      {(hovered || filling) && (
        <motion.span
          className="pointer-events-none absolute inset-x-0 rounded-[inherit]"
          style={{ height: 6, background: `hsl(${color} / 0.15)`, filter: 'blur(2px)' }}
          animate={{ top: filling ? ['0%', '100%'] : hovered ? ['100%', '0%'] : '100%' }}
          transition={{ duration: filling ? 0.35 : 0.3, ease: 'easeOut' }}
        />
      )}
      <BtnLabel running={running} label={btnLabel(size, running)} />
    </motion.button>
  );
}

// ============================================================
// 10 / GRAVITY MORPH — 3D perspective tilt + morph on click
// ============================================================
function GravityMorphButton({ running, onClick, size = 'small' }: BtnProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { damping: 20, stiffness: 200 });
  const springRotateY = useSpring(rotateY, { damping: 20, stiffness: 200 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    rotateY.set(((e.clientX - cx) / rect.width) * 25);
    rotateX.set(((cy - e.clientY) / rect.height) * 25);
  }, [rotateX, rotateY]);

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const controls = useAnimationControls();

  const fire = useCallback(async (e: React.MouseEvent) => {
    rotateX.set(0);
    rotateY.set(0);
    await controls.start({
      borderRadius: [scaled(10), scaled(20), scaled(10)],
      scale: [1, 0.8, 1.05, 1],
      transition: { duration: 0.5, times: [0, 0.3, 0.7, 1] },
    });
    onClick(e);
  }, [onClick, controls, rotateX, rotateY]);

  const color = running ? 'var(--destructive)' : 'var(--primary)';

  const sz = btnSizeStyles(size);

  return (
    <motion.div className={size === 'small' ? 'ml-auto' : 'w-full'} style={{ perspective: 400 }}>
      <motion.button
        ref={ref}
        className={btnBase + ' w-full'}
        style={{
          ...sz,
          width: '100%',
          background: `hsl(${color} / 0.06)`,
          border: `1px solid hsl(${color} / 0.2)`,
          color: `hsl(${color})`,
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={controls}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={fire}
      >
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background: useTransform(springRotateY, [-25, 25], [
              `radial-gradient(circle at 20% 50%, hsl(${color} / 0.15), transparent 60%)`,
              `radial-gradient(circle at 80% 50%, hsl(${color} / 0.15), transparent 60%)`,
            ]),
          }}
        />
        <BtnLabel running={running} label={btnLabel(size, running)} />
      </motion.button>
    </motion.div>
  );
}

// ============================================================
// Timer card — renders one variant
// ============================================================
const VARIANTS = {
  'original': { title: 'Original', desc: 'Ripple from click point + spring bounce — the baseline', Btn: OriginalButton },
  'shockwave': { title: 'Shockwave', desc: 'Concentric rings explode outward on every click', Btn: ShockwaveButton },
  'elastic': { title: 'Elastic Jelly', desc: 'Extreme squash & stretch with spring overshoot', Btn: ElasticJellyButton },
  'glitch': { title: 'Glitch Matrix', desc: 'RGB split + scanlines + digital scramble', Btn: GlitchButton },
  'aurora': { title: 'Aurora Border', desc: 'Spinning conic gradient traces the border', Btn: AuroraButton },
  'particles': { title: 'Particle Burst', desc: '12 particles explode in all directions on click', Btn: ParticleBurstButton },
  'neon': { title: 'Neon Flicker', desc: 'Neon sign buzz — flickers and glows on transition', Btn: NeonFlickerButton },
  'magnetic': { title: 'Magnetic Pull', desc: 'Button follows your cursor like a magnet', Btn: MagneticButton },
  'heartbeat': { title: 'Heartbeat', desc: 'Organic double-pulse rhythm while running', Btn: HeartbeatButton },
  'liquid': { title: 'Liquid Fill', desc: 'Color fills up on hover, drains on click', Btn: LiquidFillButton },
  'gravity': { title: 'Gravity Morph', desc: '3D perspective tilt + morph shape on click', Btn: GravityMorphButton },
} as const;

type VariantKey = keyof typeof VARIANTS;

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
        <GlassCard running={timer.running}>
          {btnSize === 'big' ? (
            <>
              <div className="relative flex items-center" style={{ gap: scaled(10) }}>
                <StatusOrb running={timer.running} />
                <TimerDisplay display={timer.display} running={timer.running} />
              </div>
              <DescInput />
              <ProjectPill />
              <div style={{ marginTop: scaled(10) }}>
                <Btn running={timer.running} onClick={timer.toggle} size="big" />
              </div>
            </>
          ) : (
            <>
              <div className="relative flex items-center" style={{ gap: scaled(10), marginBottom: scaled(6) }}>
                <StatusOrb running={timer.running} />
                <TimerDisplay display={timer.display} running={timer.running} />
                <Btn running={timer.running} onClick={timer.toggle} size="small" />
              </div>
              <DescInput />
              <ProjectPill />
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ============================================================
// Page content — 10 variants in a grid
// ============================================================
function StartStopContent() {
  const variantKeys = Object.keys(VARIANTS) as VariantKey[];

  return (
    <div className="mx-auto px-6 py-8" style={{ maxWidth: 1600 }}>
      <h1
        className="text-center font-brand font-normal uppercase tracking-[5px] text-foreground/30"
        style={{ fontSize: scaled(11) }}
      >
        Start / Stop Animations
      </h1>
      <p className="mt-1 text-center text-xs text-foreground/15">
        Original + 10 animation styles — small inline button vs full-width bar. Switch themes above.
      </p>

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
            {/* Variant title */}
            <div className="text-center" style={{ marginBottom: scaled(10) }}>
              <div className="font-brand text-sm font-semibold uppercase tracking-widest text-foreground/40">
                {VARIANTS[key].title}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/40">{VARIANTS[key].desc}</div>
            </div>
            {/* Two cards side by side */}
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
export function DevStartStopPage() {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        
          <div className="min-h-screen bg-background text-foreground">
            <DevToolbar />
            <StartStopContent />
          </div>
        
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
