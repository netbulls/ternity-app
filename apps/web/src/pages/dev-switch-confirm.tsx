import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Play, Square, Settings, ArrowRightLeft, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { scaled } from '@/lib/scaled';

// ============================================================
// Mock data
// ============================================================
const CURRENT = {
  name: 'API Performance Testing',
  project: 'Infrastructure',
  client: 'Netbulls',
  color: '#f59e0b',
  time: '1:23:47',
  dur: '1h 23m',
};

const NEXT = {
  name: 'Dashboard redesign',
  project: 'Web',
  client: 'Acme Corp',
  color: '#3b82f6',
  time: '1:15:00',
  dur: '1h 15m',
};

const ENTRIES = [
  { name: 'Sprint retrospective', project: 'Internal', client: 'Netbulls', color: '#8b5cf6', dur: '45m' },
  { name: 'Bug fix: login timeout', project: 'Infrastructure', client: 'Netbulls', color: '#f59e0b', dur: '32m' },
  { name: 'Code review PR #142', project: 'Web', client: 'Acme Corp', color: '#3b82f6', dur: '18m' },
];

// ============================================================
// Timer clock — ticks every second for the running entry
// ============================================================
function useTickingTime(baseTime: string) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const parts = baseTime.split(':').map(Number) as [number, number, number];
  const total = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0) + seconds;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// Shared components — Header, Timer, Stats, Entries, Footer
// ============================================================
function AppHeader() {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: `${scaled(10)} ${scaled(14)}`,
        borderBottom: '1px solid hsl(var(--border) / 0.08)',
      }}
    >
      <div className="flex items-center" style={{ gap: scaled(6) }}>
        <svg viewBox="0 0 100 100" fill="none" style={{ width: scaled(16), height: scaled(16) }}>
          <path d="M18 5L82 5L62 48L82 95L18 95L38 48Z" stroke="hsl(var(--primary))" strokeWidth="5" fill="none" />
          <circle cx="40" cy="30" r="4" fill="hsl(var(--primary))" />
          <circle cx="55" cy="25" r="3" fill="hsl(var(--primary))" />
          <circle cx="62" cy="35" r="3.5" fill="hsl(var(--primary))" />
          <circle cx="45" cy="70" r="4" fill="hsl(var(--primary))" />
          <circle cx="55" cy="75" r="3" fill="hsl(var(--primary))" />
        </svg>
        <span
          className="font-brand font-semibold"
          style={{ fontSize: scaled(11), letterSpacing: '2px', color: 'hsl(var(--foreground))' }}
        >
          TERNITY
        </span>
      </div>
      <Settings
        style={{ width: scaled(14), height: scaled(14), color: 'hsl(var(--muted-foreground) / 0.5)' }}
      />
    </div>
  );
}

function TimerSection({ time }: { time: string }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: `${scaled(12)} ${scaled(16)}` }}
    >
      <div className="flex items-center" style={{ gap: scaled(10) }}>
        <motion.div
          className="rounded-full"
          style={{ width: scaled(6), height: scaled(6), background: CURRENT.color }}
          animate={{ opacity: [1, 0.4, 1], scale: [1, 1.6, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div>
          <div
            className="font-brand font-semibold tabular-nums"
            style={{ fontSize: scaled(22), letterSpacing: '1px', color: 'hsl(var(--foreground))' }}
          >
            {time}
          </div>
          <div style={{ marginTop: scaled(2) }}>
            <div style={{ fontSize: scaled(11), color: 'hsl(var(--foreground))', fontWeight: 500 }}>
              {CURRENT.name}
            </div>
            <div style={{ fontSize: scaled(10), color: 'hsl(var(--muted-foreground))', marginTop: '1px' }}>
              <span style={{ color: CURRENT.color }}>{CURRENT.client}</span> · {CURRENT.project}
            </div>
          </div>
        </div>
      </div>
      <div
        className="flex cursor-pointer items-center font-brand font-semibold"
        style={{
          gap: scaled(5),
          padding: `${scaled(6)} ${scaled(14)}`,
          borderRadius: scaled(8),
          background: 'hsl(0 80% 55% / 0.12)',
          color: 'hsl(0 80% 60%)',
          fontSize: scaled(11),
          border: '1px solid hsl(0 80% 55% / 0.2)',
        }}
      >
        <Square style={{ width: scaled(10), height: scaled(10) }} fill="currentColor" />
        STOP
      </div>
    </div>
  );
}

function StatsBar() {
  return (
    <div
      className="flex items-center"
      style={{
        gap: scaled(16),
        padding: `${scaled(8)} ${scaled(16)}`,
        borderTop: '1px solid hsl(var(--border) / 0.05)',
        borderBottom: '1px solid hsl(var(--border) / 0.05)',
      }}
    >
      {[
        { val: '5h 08m', label: 'Today' },
        { val: '5h 08m', label: 'This Week' },
      ].map((s) => (
        <div key={s.label}>
          <div
            className="font-brand font-semibold"
            style={{ fontSize: scaled(14), color: 'hsl(var(--primary))' }}
          >
            {s.val}
          </div>
          <div
            className="font-brand uppercase"
            style={{
              fontSize: scaled(8),
              letterSpacing: '1px',
              color: 'hsl(var(--muted-foreground) / 0.5)',
            }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayHeader() {
  return (
    <div className="flex justify-between" style={{ padding: `${scaled(6)} ${scaled(14)}` }}>
      <span
        className="font-brand uppercase"
        style={{ fontSize: scaled(8), letterSpacing: '1.5px', color: 'hsl(var(--muted-foreground) / 0.5)' }}
      >
        Today
      </span>
      <span
        className="font-brand"
        style={{ fontSize: scaled(9), color: 'hsl(var(--muted-foreground) / 0.3)' }}
      >
        5h 08m
      </span>
    </div>
  );
}

function EntryRow({
  entry,
  isTracking,
  onPlay,
}: {
  entry: { name: string; project: string; client: string; color: string; dur: string };
  isTracking?: boolean;
  onPlay?: () => void;
}) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: scaled(10),
        padding: `${scaled(6)} ${scaled(16)}`,
        background: isTracking ? 'hsl(var(--primary) / 0.04)' : undefined,
      }}
    >
      <div
        className="shrink-0 rounded-full"
        style={{ width: scaled(5), height: scaled(5), background: entry.color }}
      />
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{ fontSize: scaled(12), color: 'hsl(var(--foreground))', fontWeight: isTracking ? 500 : 400 }}
        >
          {entry.name}
        </div>
        <div
          className="truncate"
          style={{ fontSize: scaled(10), color: 'hsl(var(--muted-foreground))', marginTop: '1px' }}
        >
          {entry.client} · {entry.project}
        </div>
      </div>
      {isTracking ? (
        <span
          className="font-brand shrink-0"
          style={{ fontSize: scaled(9), color: 'hsl(var(--primary) / 0.7)', letterSpacing: '0.5px' }}
        >
          TRACKING
        </span>
      ) : (
        <>
          <span
            className="font-brand shrink-0 font-semibold"
            style={{ fontSize: scaled(12), color: 'hsl(var(--muted-foreground))' }}
          >
            {entry.dur}
          </span>
          <motion.div
            className="flex shrink-0 cursor-pointer items-center justify-center rounded-full"
            style={{
              width: scaled(22),
              height: scaled(22),
              color: 'hsl(var(--muted-foreground) / 0.3)',
            }}
            whileHover={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}
            whileTap={{ scale: 0.85 }}
            onClick={onPlay}
          >
            <Play style={{ width: scaled(10), height: scaled(10) }} fill="currentColor" />
          </motion.div>
        </>
      )}
    </div>
  );
}

function AppFooter() {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        gap: scaled(6),
        padding: scaled(8),
        fontSize: scaled(10),
        color: 'hsl(var(--muted-foreground) / 0.3)',
        borderTop: '1px solid hsl(var(--border) / 0.05)',
      }}
    >
      Open Ternity ↗
    </div>
  );
}

// ============================================================
// Shared button styles
// ============================================================
function ConfirmButton({
  variant,
  children,
  onClick,
  className = '',
  flex,
}: {
  variant: 'primary' | 'ghost' | 'danger';
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  flex?: boolean;
}) {
  const styles: Record<string, string> = {
    primary: 'bg-primary text-background hover:brightness-110',
    ghost: 'bg-transparent text-muted-foreground border border-border/15 hover:bg-muted/20 hover:text-foreground',
    danger: 'bg-destructive/12 text-destructive border border-destructive/20',
  };

  return (
    <motion.button
      className={`font-brand cursor-pointer font-semibold ${styles[variant]} ${className}`}
      style={{
        padding: `${scaled(6)} ${scaled(16)}`,
        borderRadius: scaled(8),
        fontSize: scaled(11),
        flex: flex ? 1 : undefined,
        border: variant === 'primary' ? 'none' : undefined,
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

// ============================================================
// V1: The Ripple — fullscreen overlay with pulsing ring
// ============================================================
function V1Ripple({
  show,
  onCancel,
  onSwitch,
  time,
}: {
  show: boolean;
  onCancel: () => void;
  onSwitch: () => void;
  time: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          style={{
            background: 'hsl(var(--background) / 0.92)',
            backdropFilter: 'blur(16px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Pulsing ring */}
          <motion.div
            className="relative mb-4 flex flex-col items-center justify-center rounded-full"
            style={{
              width: scaled(120),
              height: scaled(120),
              border: '2px solid hsl(var(--primary) / 0.3)',
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          >
            {/* Expanding ring animation */}
            <motion.div
              className="absolute rounded-full"
              style={{
                inset: scaled(-8),
                border: '1px solid hsl(var(--primary) / 0.1)',
              }}
              animate={{ scale: [0.9, 1.3], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <span
              className="font-brand font-bold"
              style={{ fontSize: scaled(24), color: 'hsl(var(--foreground))' }}
            >
              {time}
            </span>
            <span
              className="font-brand uppercase"
              style={{ fontSize: scaled(9), letterSpacing: '1px', color: 'hsl(var(--primary))', marginTop: scaled(2) }}
            >
              Saving
            </span>
          </motion.div>

          {/* Arrow */}
          <motion.div
            style={{ fontSize: scaled(16), color: 'hsl(var(--primary) / 0.5)', margin: `${scaled(12)} 0` }}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            ↓
          </motion.div>

          {/* Next entry info */}
          <motion.div
            className="text-center"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div style={{ fontSize: scaled(13), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
              {NEXT.name}
            </div>
            <div
              className="mt-0.5 flex items-center justify-center"
              style={{ gap: scaled(4), fontSize: scaled(10), color: 'hsl(var(--muted-foreground))' }}
            >
              <span className="rounded-full" style={{ width: scaled(5), height: scaled(5), background: NEXT.color }} />
              {NEXT.client} · {NEXT.project}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            className="flex"
            style={{ gap: scaled(8), marginTop: scaled(20) }}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <ConfirmButton variant="ghost" onClick={onCancel}>Keep going</ConfirmButton>
            <ConfirmButton variant="primary" onClick={onSwitch}>Switch</ConfirmButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// V3: The Gravity Drop — two cards drop from top
// ============================================================
function V3GravityDrop({
  show,
  onCancel,
  onSwitch,
}: {
  show: boolean;
  onCancel: () => void;
  onSwitch: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          style={{
            padding: `0 ${scaled(16)} ${scaled(14)}`,
            borderBottom: '1px solid hsl(var(--primary) / 0.2)',
            background: 'linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background) / 0.95) 100%)',
            overflow: 'hidden',
          }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="flex" style={{ gap: scaled(8), marginTop: scaled(8) }}>
            {/* Stopping card */}
            <motion.div
              className="flex-1"
              style={{
                padding: `${scaled(8)} ${scaled(10)}`,
                borderRadius: scaled(8),
                border: '1px solid hsl(var(--border) / 0.1)',
                background: 'hsl(var(--card) / 0.5)',
              }}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05, type: 'spring', damping: 20, stiffness: 250 }}
            >
              <div
                className="font-brand uppercase"
                style={{ fontSize: scaled(8), letterSpacing: '1px', marginBottom: scaled(4), color: 'hsl(0 80% 60%)' }}
              >
                ● Stopping
              </div>
              <div style={{ fontSize: scaled(11), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                {CURRENT.name}
              </div>
              <div
                className="flex items-center justify-between"
                style={{ fontSize: scaled(9), color: 'hsl(var(--muted-foreground))', marginTop: scaled(2) }}
              >
                <span>{CURRENT.client}</span>
                <span className="font-brand font-semibold">{CURRENT.dur}</span>
              </div>
            </motion.div>

            {/* Starting card */}
            <motion.div
              className="flex-1"
              style={{
                padding: `${scaled(8)} ${scaled(10)}`,
                borderRadius: scaled(8),
                border: '1px solid hsl(var(--border) / 0.1)',
                background: 'hsl(var(--card) / 0.5)',
              }}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 250 }}
            >
              <div
                className="font-brand uppercase"
                style={{ fontSize: scaled(8), letterSpacing: '1px', marginBottom: scaled(4), color: 'hsl(var(--primary))' }}
              >
                ● Starting
              </div>
              <div style={{ fontSize: scaled(11), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                {NEXT.name}
              </div>
              <div style={{ fontSize: scaled(9), color: 'hsl(var(--muted-foreground))', marginTop: scaled(2) }}>
                {NEXT.client} · {NEXT.project}
              </div>
            </motion.div>
          </div>

          {/* Buttons */}
          <motion.div
            className="flex"
            style={{ gap: scaled(6), marginTop: scaled(10) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <ConfirmButton variant="ghost" onClick={onCancel} flex>Cancel</ConfirmButton>
            <ConfirmButton variant="primary" onClick={onSwitch} flex>Switch</ConfirmButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// V9: The Split Horizon — full-screen dramatic split
// ============================================================
function V9SplitHorizon({
  show,
  onCancel,
  onSwitch,
  time,
}: {
  show: boolean;
  onCancel: () => void;
  onSwitch: () => void;
  time: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-10 flex flex-col"
          style={{ background: 'hsl(var(--background))' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* ── Top half: Stopping — bg fills edge, content hugs center ── */}
          <motion.div
            className="flex flex-1 flex-col items-center justify-end"
            style={{
              padding: `${scaled(20)} ${scaled(20)} ${scaled(24)}`,
              background: 'linear-gradient(to bottom, hsl(0 80% 55% / 0.04), transparent)',
            }}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, type: 'spring', damping: 20, stiffness: 200 }}
          >
            <div
              className="font-brand uppercase"
              style={{
                fontSize: scaled(8),
                letterSpacing: '1.5px',
                color: 'hsl(0 80% 60% / 0.6)',
                marginBottom: scaled(8),
              }}
            >
              Stopping
            </div>
            <div
              style={{ fontSize: scaled(15), fontWeight: 600, color: 'hsl(var(--foreground))', textAlign: 'center' }}
            >
              {CURRENT.name}
            </div>
            <div
              className="flex items-center"
              style={{
                gap: scaled(4),
                fontSize: scaled(11),
                color: 'hsl(var(--muted-foreground))',
                marginTop: scaled(4),
              }}
            >
              <span className="rounded-full" style={{ width: scaled(5), height: scaled(5), background: CURRENT.color }} />
              {CURRENT.client} · {CURRENT.project}
            </div>
            <motion.div
              className="font-brand font-semibold tabular-nums"
              style={{ fontSize: scaled(20), color: 'hsl(0 80% 65%)', marginTop: scaled(8) }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {time}
            </motion.div>
          </motion.div>

          {/* ── Divider with fulcrum ── */}
          <div
            className="relative z-10 flex shrink-0 items-center"
            style={{ margin: `0 ${scaled(24)}`, height: 0 }}
          >
            <div
              className="flex-1"
              style={{ height: '1px', background: 'linear-gradient(90deg, transparent, hsl(var(--muted-foreground) / 0.15))' }}
            />
            <motion.div
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                marginTop: -14,
                marginBottom: -14,
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border) / 0.15)',
                color: 'hsl(var(--muted-foreground) / 0.4)',
              }}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', damping: 15, stiffness: 200 }}
            >
              <ArrowUpDown style={{ width: 12, height: 12 }} />
            </motion.div>
            <div
              className="flex-1"
              style={{ height: '1px', background: 'linear-gradient(90deg, hsl(var(--muted-foreground) / 0.15), transparent)' }}
            />
          </div>

          {/* ── Bottom half: Starting — bg fills edge, content hugs center ── */}
          <motion.div
            className="flex flex-1 flex-col items-center justify-start"
            style={{
              padding: `${scaled(24)} ${scaled(20)} ${scaled(20)}`,
              background: 'linear-gradient(to top, hsl(var(--primary) / 0.04), transparent)',
            }}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 200 }}
          >
            <div
              className="font-brand uppercase"
              style={{
                fontSize: scaled(8),
                letterSpacing: '1.5px',
                color: 'hsl(var(--primary) / 0.6)',
                marginBottom: scaled(8),
              }}
            >
              Starting
            </div>
            <div
              style={{ fontSize: scaled(15), fontWeight: 600, color: 'hsl(var(--foreground))', textAlign: 'center' }}
            >
              {NEXT.name}
            </div>
            <div
              className="flex items-center"
              style={{
                gap: scaled(4),
                fontSize: scaled(11),
                color: 'hsl(var(--muted-foreground))',
                marginTop: scaled(4),
              }}
            >
              <span className="rounded-full" style={{ width: scaled(5), height: scaled(5), background: NEXT.color }} />
              {NEXT.client} · {NEXT.project}
            </div>
            <div
              className="font-brand font-semibold"
              style={{ fontSize: scaled(14), color: 'hsl(var(--muted-foreground) / 0.4)', marginTop: scaled(8) }}
            >
              {NEXT.dur} logged today
            </div>
          </motion.div>

          {/* ── Sticky footer buttons ── */}
          <motion.div
            className="flex shrink-0 justify-center"
            style={{
              gap: scaled(8),
              padding: scaled(12),
              borderTop: '1px solid hsl(var(--border) / 0.05)',
              background: 'hsl(var(--background))',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <ConfirmButton variant="ghost" onClick={onCancel}>Cancel</ConfirmButton>
            <ConfirmButton variant="primary" onClick={onSwitch}>Switch</ConfirmButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// V4: The Glass Card — single frosted glass card replaces timer
// ============================================================
function V4GlassCard({
  show,
  onCancel,
  onSwitch,
  time,
}: {
  show: boolean;
  onCancel: () => void;
  onSwitch: () => void;
  time: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          style={{
            margin: `0 ${scaled(8)}`,
            padding: scaled(14),
            borderRadius: scaled(14),
            background: 'hsl(var(--card) / 0.6)',
            backdropFilter: 'blur(12px)',
            border: '1px solid',
            overflow: 'hidden',
          }}
          initial={{ height: 0, opacity: 0, borderColor: 'hsl(var(--border) / 0.3)' }}
          animate={{
            height: 'auto',
            opacity: 1,
            borderColor: [
              'hsl(var(--primary) / 0.15)',
              'hsl(var(--primary) / 0.35)',
              'hsl(var(--primary) / 0.15)',
            ],
          }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { type: 'spring', damping: 25, stiffness: 300 },
            opacity: { duration: 0.2 },
            borderColor: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          {/* Top glass refraction */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{
              height: '50%',
              background: 'linear-gradient(180deg, hsl(var(--foreground) / 0.02) 0%, transparent 100%)',
              borderRadius: `${scaled(14)} ${scaled(14)} 0 0`,
            }}
          />

          {/* Header */}
          <div className="relative">
            <div
              className="font-brand mb-3 text-center uppercase"
              style={{ fontSize: scaled(9), letterSpacing: '1.5px', color: 'hsl(var(--muted-foreground) / 0.5)' }}
            >
              Switch timer?
            </div>

            {/* Two rows: stopping and starting */}
            <div className="flex flex-col" style={{ gap: scaled(8) }}>
              {/* Stopping row */}
              <motion.div
                className="flex items-center"
                style={{
                  gap: scaled(10),
                  padding: `${scaled(8)} ${scaled(10)}`,
                  borderRadius: scaled(10),
                  background: 'hsl(0 80% 55% / 0.04)',
                  border: '1px solid hsl(0 80% 55% / 0.08)',
                }}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.05, type: 'spring', damping: 20 }}
              >
                <motion.div
                  className="shrink-0 rounded-full"
                  style={{ width: scaled(8), height: scaled(8), background: CURRENT.color }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate" style={{ fontSize: scaled(11), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                    {CURRENT.name}
                  </div>
                  <div className="truncate" style={{ fontSize: scaled(9), color: 'hsl(var(--muted-foreground))' }}>
                    {CURRENT.client} · {CURRENT.project}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-brand font-semibold tabular-nums" style={{ fontSize: scaled(13), color: 'hsl(0 80% 65%)' }}>
                    {time}
                  </div>
                  <div className="font-brand uppercase" style={{ fontSize: scaled(7), letterSpacing: '1px', color: 'hsl(0 80% 60% / 0.6)' }}>
                    Stopping
                  </div>
                </div>
              </motion.div>

              {/* Arrow */}
              <div className="flex justify-center">
                <motion.div
                  style={{ color: 'hsl(var(--primary) / 0.3)' }}
                  animate={{ y: [0, 3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ArrowRightLeft style={{ width: scaled(12), height: scaled(12), transform: 'rotate(90deg)' }} />
                </motion.div>
              </div>

              {/* Starting row */}
              <motion.div
                className="flex items-center"
                style={{
                  gap: scaled(10),
                  padding: `${scaled(8)} ${scaled(10)}`,
                  borderRadius: scaled(10),
                  background: 'hsl(var(--primary) / 0.04)',
                  border: '1px solid hsl(var(--primary) / 0.08)',
                }}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 20 }}
              >
                <div
                  className="shrink-0 rounded-full"
                  style={{ width: scaled(8), height: scaled(8), background: NEXT.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate" style={{ fontSize: scaled(11), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                    {NEXT.name}
                  </div>
                  <div className="truncate" style={{ fontSize: scaled(9), color: 'hsl(var(--muted-foreground))' }}>
                    {NEXT.client} · {NEXT.project}
                  </div>
                </div>
                <div className="shrink-0">
                  <div className="font-brand uppercase" style={{ fontSize: scaled(7), letterSpacing: '1px', color: 'hsl(var(--primary) / 0.6)' }}>
                    Starting
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Buttons */}
            <motion.div
              className="flex"
              style={{ gap: scaled(6), marginTop: scaled(12) }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <ConfirmButton variant="ghost" onClick={onCancel} flex>Cancel</ConfirmButton>
              <ConfirmButton variant="primary" onClick={onSwitch} flex>Switch</ConfirmButton>
            </motion.div>
          </div>

          {/* Bottom edge glow */}
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
            style={{ height: 3, borderRadius: `0 0 ${scaled(14)} ${scaled(14)}` }}
          >
            <motion.div
              className="absolute top-0 h-full"
              style={{ width: '35%', background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.6) 0%, transparent 70%)' }}
              animate={{ left: ['-10%', '75%'] }}
              transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// V5: The Hourglass — centered overlay with hourglass motif
// ============================================================
function V5Hourglass({
  show,
  onCancel,
  onSwitch,
  time,
}: {
  show: boolean;
  onCancel: () => void;
  onSwitch: () => void;
  time: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          style={{
            background: 'hsl(var(--background) / 0.95)',
            backdropFilter: 'blur(20px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Stopping — top section */}
          <motion.div
            className="flex flex-col items-center"
            style={{ marginBottom: scaled(6) }}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, type: 'spring', damping: 20 }}
          >
            <div
              className="font-brand uppercase"
              style={{ fontSize: scaled(8), letterSpacing: '1.5px', color: 'hsl(0 80% 60% / 0.5)', marginBottom: scaled(6) }}
            >
              Stopping
            </div>
            <div className="flex items-center" style={{ gap: scaled(6) }}>
              <div className="rounded-full" style={{ width: scaled(6), height: scaled(6), background: CURRENT.color }} />
              <span style={{ fontSize: scaled(12), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                {CURRENT.name}
              </span>
            </div>
            <div style={{ fontSize: scaled(10), color: 'hsl(var(--muted-foreground))', marginTop: scaled(2) }}>
              {CURRENT.client} · {CURRENT.dur}
            </div>
          </motion.div>

          {/* Hourglass symbol */}
          <motion.div
            className="relative flex items-center justify-center"
            style={{ width: scaled(48), height: scaled(56), margin: `${scaled(4)} 0` }}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', damping: 12, stiffness: 150 }}
          >
            <svg viewBox="0 0 100 120" fill="none" style={{ width: '100%', height: '100%' }}>
              <path
                d="M18 5L82 5L62 48L82 95L18 95L38 48Z"
                stroke="hsl(var(--primary))"
                strokeWidth="4"
                strokeLinejoin="round"
                fill="none"
                opacity={0.3}
              />
              {/* Falling dot animation represented by opacity */}
              <motion.circle
                cx="50" cy="55" r="5"
                fill="hsl(var(--primary))"
                animate={{ cy: [35, 75], opacity: [0.8, 0.3, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </svg>
            <div
              className="font-brand absolute font-semibold tabular-nums"
              style={{ fontSize: scaled(11), color: 'hsl(var(--primary))', bottom: scaled(-2) }}
            >
              {time}
            </div>
          </motion.div>

          {/* Starting — bottom section */}
          <motion.div
            className="flex flex-col items-center"
            style={{ marginTop: scaled(6) }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 20 }}
          >
            <div
              className="font-brand uppercase"
              style={{ fontSize: scaled(8), letterSpacing: '1.5px', color: 'hsl(var(--primary) / 0.5)', marginBottom: scaled(6) }}
            >
              Starting
            </div>
            <div className="flex items-center" style={{ gap: scaled(6) }}>
              <div className="rounded-full" style={{ width: scaled(6), height: scaled(6), background: NEXT.color }} />
              <span style={{ fontSize: scaled(12), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                {NEXT.name}
              </span>
            </div>
            <div style={{ fontSize: scaled(10), color: 'hsl(var(--muted-foreground))', marginTop: scaled(2) }}>
              {NEXT.client} · {NEXT.project}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            className="flex"
            style={{ gap: scaled(8), marginTop: scaled(20) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <ConfirmButton variant="ghost" onClick={onCancel}>Keep going</ConfirmButton>
            <ConfirmButton variant="primary" onClick={onSwitch}>Switch</ConfirmButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// V6: The Slide-Up Sheet — bottom sheet slides up over entries
// ============================================================
function V6SlideUp({
  show,
  onCancel,
  onSwitch,
  time,
}: {
  show: boolean;
  onCancel: () => void;
  onSwitch: () => void;
  time: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-10"
            style={{ background: 'hsl(var(--background) / 0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          {/* Sheet */}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-20"
            style={{
              borderRadius: `${scaled(14)} ${scaled(14)} 0 0`,
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border) / 0.1)',
              borderBottom: 'none',
              boxShadow: '0 -12px 40px hsl(var(--background) / 0.6)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center" style={{ padding: `${scaled(8)} 0 ${scaled(4)}` }}>
              <div
                className="rounded-full"
                style={{
                  width: scaled(32),
                  height: scaled(3),
                  background: 'hsl(var(--muted-foreground) / 0.15)',
                }}
              />
            </div>

            <div style={{ padding: `0 ${scaled(16)} ${scaled(14)}` }}>
              <div
                className="font-brand mb-3 text-center uppercase"
                style={{ fontSize: scaled(9), letterSpacing: '1.5px', color: 'hsl(var(--muted-foreground) / 0.5)' }}
              >
                Switch timer?
              </div>

              {/* Stopping */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: `${scaled(10)} ${scaled(12)}`,
                  borderRadius: scaled(10),
                  background: 'hsl(0 80% 55% / 0.04)',
                  border: '1px solid hsl(0 80% 55% / 0.08)',
                  marginBottom: scaled(6),
                }}
              >
                <div className="flex items-center" style={{ gap: scaled(8) }}>
                  <Square style={{ width: scaled(12), height: scaled(12), color: 'hsl(0 80% 60%)' }} fill="hsl(0 80% 60%)" />
                  <div>
                    <div className="truncate" style={{ fontSize: scaled(11), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                      {CURRENT.name}
                    </div>
                    <div style={{ fontSize: scaled(9), color: 'hsl(var(--muted-foreground))' }}>
                      {CURRENT.client}
                    </div>
                  </div>
                </div>
                <div className="font-brand shrink-0 font-semibold tabular-nums" style={{ fontSize: scaled(14), color: 'hsl(0 80% 65%)' }}>
                  {time}
                </div>
              </div>

              {/* Starting */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: `${scaled(10)} ${scaled(12)}`,
                  borderRadius: scaled(10),
                  background: 'hsl(var(--primary) / 0.04)',
                  border: '1px solid hsl(var(--primary) / 0.08)',
                }}
              >
                <div className="flex items-center" style={{ gap: scaled(8) }}>
                  <Play style={{ width: scaled(12), height: scaled(12), color: 'hsl(var(--primary))' }} fill="hsl(var(--primary))" />
                  <div>
                    <div className="truncate" style={{ fontSize: scaled(11), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                      {NEXT.name}
                    </div>
                    <div style={{ fontSize: scaled(9), color: 'hsl(var(--muted-foreground))' }}>
                      {NEXT.client} · {NEXT.project}
                    </div>
                  </div>
                </div>
                <div className="font-brand shrink-0 uppercase" style={{ fontSize: scaled(8), letterSpacing: '1px', color: 'hsl(var(--primary) / 0.6)' }}>
                  Ready
                </div>
              </div>

              {/* Buttons */}
              <div className="flex" style={{ gap: scaled(6), marginTop: scaled(12) }}>
                <ConfirmButton variant="ghost" onClick={onCancel} flex>Cancel</ConfirmButton>
                <ConfirmButton variant="primary" onClick={onSwitch} flex>Switch</ConfirmButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// V7: The Inline Expansion — entry row expands in-place
// ============================================================
function V7InlineExpand({
  show,
  onCancel,
  onSwitch,
  time,
}: {
  show: boolean;
  onCancel: () => void;
  onSwitch: () => void;
  time: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          style={{
            margin: `${scaled(2)} ${scaled(8)}`,
            borderRadius: scaled(10),
            border: '1px solid',
            overflow: 'hidden',
          }}
          initial={{ height: 0, opacity: 0, borderColor: 'transparent' }}
          animate={{
            height: 'auto',
            opacity: 1,
            borderColor: [
              'hsl(var(--primary) / 0.1)',
              'hsl(var(--primary) / 0.25)',
              'hsl(var(--primary) / 0.1)',
            ],
          }}
          exit={{ height: 0, opacity: 0, borderColor: 'transparent' }}
          transition={{
            height: { type: 'spring', damping: 25, stiffness: 300 },
            borderColor: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          {/* Stopping line */}
          <div
            className="flex items-center"
            style={{
              gap: scaled(8),
              padding: `${scaled(8)} ${scaled(12)}`,
              borderBottom: '1px solid hsl(var(--border) / 0.06)',
            }}
          >
            <div className="rounded-full" style={{ width: scaled(5), height: scaled(5), background: CURRENT.color }} />
            <div className="min-w-0 flex-1">
              <div className="truncate" style={{ fontSize: scaled(11), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                {CURRENT.name}
              </div>
            </div>
            <span className="font-brand shrink-0 font-semibold tabular-nums" style={{ fontSize: scaled(11), color: 'hsl(0 80% 65%)' }}>
              {time}
            </span>
            <span className="font-brand shrink-0 uppercase" style={{ fontSize: scaled(7), letterSpacing: '0.5px', color: 'hsl(0 80% 60% / 0.5)' }}>
              Stop
            </span>
          </div>

          {/* Arrow connector */}
          <div
            className="flex items-center justify-center"
            style={{
              padding: `${scaled(3)} 0`,
              background: 'hsl(var(--muted) / 0.05)',
            }}
          >
            <ArrowRightLeft style={{ width: scaled(10), height: scaled(10), color: 'hsl(var(--muted-foreground) / 0.2)', transform: 'rotate(90deg)' }} />
          </div>

          {/* Starting line */}
          <div
            className="flex items-center"
            style={{
              gap: scaled(8),
              padding: `${scaled(8)} ${scaled(12)}`,
              borderBottom: '1px solid hsl(var(--border) / 0.06)',
            }}
          >
            <div className="rounded-full" style={{ width: scaled(5), height: scaled(5), background: NEXT.color }} />
            <div className="min-w-0 flex-1">
              <div className="truncate" style={{ fontSize: scaled(11), fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                {NEXT.name}
              </div>
            </div>
            <span className="font-brand shrink-0 uppercase" style={{ fontSize: scaled(7), letterSpacing: '0.5px', color: 'hsl(var(--primary) / 0.5)' }}>
              Start
            </span>
          </div>

          {/* Buttons */}
          <div
            className="flex"
            style={{
              gap: scaled(4),
              padding: `${scaled(6)} ${scaled(8)}`,
              background: 'hsl(var(--muted) / 0.05)',
            }}
          >
            <ConfirmButton variant="ghost" onClick={onCancel} flex>Cancel</ConfirmButton>
            <ConfirmButton variant="primary" onClick={onSwitch} flex>Switch</ConfirmButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// V8: The Timeline — vertical timeline with dots and connector
// ============================================================
function V8Timeline({
  show,
  onCancel,
  onSwitch,
  time,
}: {
  show: boolean;
  onCancel: () => void;
  onSwitch: () => void;
  time: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          style={{
            background: 'hsl(var(--background) / 0.94)',
            backdropFilter: 'blur(16px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative" style={{ padding: `0 ${scaled(40)}` }}>
            {/* Vertical connector line */}
            <motion.div
              className="absolute"
              style={{
                left: scaled(58),
                top: scaled(18),
                bottom: scaled(18),
                width: '1px',
                background: 'linear-gradient(to bottom, hsl(0 80% 55% / 0.3), hsl(var(--primary) / 0.3))',
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            />

            {/* Stopping node */}
            <motion.div
              className="relative flex items-start"
              style={{ gap: scaled(14), marginBottom: scaled(32) }}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05, type: 'spring', damping: 20 }}
            >
              {/* Dot */}
              <div className="relative shrink-0" style={{ marginTop: scaled(4) }}>
                <motion.div
                  className="rounded-full"
                  style={{
                    width: scaled(12),
                    height: scaled(12),
                    background: 'hsl(0 80% 55%)',
                    boxShadow: '0 0 8px hsl(0 80% 55% / 0.4)',
                  }}
                  animate={{ boxShadow: ['0 0 8px hsl(0 80% 55% / 0.4)', '0 0 16px hsl(0 80% 55% / 0.2)', '0 0 8px hsl(0 80% 55% / 0.4)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              {/* Content */}
              <div>
                <div className="font-brand uppercase" style={{ fontSize: scaled(8), letterSpacing: '1.5px', color: 'hsl(0 80% 60% / 0.6)', marginBottom: scaled(4) }}>
                  Stopping
                </div>
                <div style={{ fontSize: scaled(13), fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  {CURRENT.name}
                </div>
                <div className="flex items-center" style={{ gap: scaled(4), fontSize: scaled(10), color: 'hsl(var(--muted-foreground))', marginTop: scaled(2) }}>
                  <span className="rounded-full" style={{ width: scaled(4), height: scaled(4), background: CURRENT.color }} />
                  {CURRENT.client} · {CURRENT.project}
                </div>
                <div className="font-brand mt-1 font-semibold tabular-nums" style={{ fontSize: scaled(16), color: 'hsl(0 80% 65%)' }}>
                  {time}
                </div>
              </div>
            </motion.div>

            {/* Starting node */}
            <motion.div
              className="relative flex items-start"
              style={{ gap: scaled(14) }}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', damping: 20 }}
            >
              {/* Dot */}
              <div className="relative shrink-0" style={{ marginTop: scaled(4) }}>
                <motion.div
                  className="rounded-full"
                  style={{
                    width: scaled(12),
                    height: scaled(12),
                    background: 'hsl(var(--primary))',
                    boxShadow: '0 0 8px hsl(var(--primary) / 0.4)',
                  }}
                  animate={{ boxShadow: ['0 0 8px hsl(var(--primary) / 0.4)', '0 0 16px hsl(var(--primary) / 0.2)', '0 0 8px hsl(var(--primary) / 0.4)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              {/* Content */}
              <div>
                <div className="font-brand uppercase" style={{ fontSize: scaled(8), letterSpacing: '1.5px', color: 'hsl(var(--primary) / 0.6)', marginBottom: scaled(4) }}>
                  Starting
                </div>
                <div style={{ fontSize: scaled(13), fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  {NEXT.name}
                </div>
                <div className="flex items-center" style={{ gap: scaled(4), fontSize: scaled(10), color: 'hsl(var(--muted-foreground))', marginTop: scaled(2) }}>
                  <span className="rounded-full" style={{ width: scaled(4), height: scaled(4), background: NEXT.color }} />
                  {NEXT.client} · {NEXT.project}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Actions */}
          <motion.div
            className="flex"
            style={{ gap: scaled(8), marginTop: scaled(28) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <ConfirmButton variant="ghost" onClick={onCancel}>Keep going</ConfirmButton>
            <ConfirmButton variant="primary" onClick={onSwitch}>Switch</ConfirmButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Popup shell — 340px tray popup mockup with confirmation
// ============================================================
type VariantType = 'ripple' | 'gravity' | 'split' | 'glass' | 'hourglass' | 'slideup' | 'inline' | 'timeline';

function TrayPopupMock({ variant }: { variant: VariantType }) {
  const [confirming, setConfirming] = useState(false);
  const [switched, setSwitched] = useState(false);
  const time = useTickingTime(CURRENT.time);

  const handlePlay = useCallback(() => {
    setConfirming(true);
  }, []);

  const handleCancel = useCallback(() => {
    setConfirming(false);
  }, []);

  const handleSwitch = useCallback(() => {
    setConfirming(false);
    setSwitched(true);
    // Reset after 2s for demo purposes
    setTimeout(() => setSwitched(false), 2000);
  }, []);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: scaled(340),
        borderRadius: scaled(12),
        border: '1px solid hsl(var(--border) / 0.06)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
      }}
    >
      {/* Switched flash */}
      <AnimatePresence>
        {switched && (
          <motion.div
            className="absolute inset-0 z-20 flex items-center justify-center"
            style={{
              background: 'hsl(var(--primary) / 0.06)',
              backdropFilter: 'blur(4px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="font-brand text-center font-semibold"
              style={{ color: 'hsl(var(--primary))', fontSize: scaled(13) }}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              Switched! Now tracking
              <br />
              <span style={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>{NEXT.name}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppHeader />

      {/* Inline variants that insert between header and timer */}
      {variant === 'gravity' && (
        <V3GravityDrop show={confirming} onCancel={handleCancel} onSwitch={handleSwitch} />
      )}

      {/* V4 replaces timer section when active */}
      {variant === 'glass' && confirming ? (
        <V4GlassCard show={confirming} onCancel={handleCancel} onSwitch={handleSwitch} time={time} />
      ) : (
        <TimerSection time={time} />
      )}

      <StatsBar />
      <DayHeader />
      <EntryRow entry={{ ...CURRENT, dur: CURRENT.dur }} isTracking />

      {/* V7 replaces the next entry row with inline expansion */}
      {variant === 'inline' && confirming ? (
        <V7InlineExpand show={confirming} onCancel={handleCancel} onSwitch={handleSwitch} time={time} />
      ) : (
        <EntryRow entry={{ ...NEXT, dur: NEXT.dur }} onPlay={handlePlay} />
      )}

      {ENTRIES.map((e, i) => (
        <EntryRow key={i} entry={e} onPlay={handlePlay} />
      ))}
      <AppFooter />

      {/* Fullscreen overlays */}
      {variant === 'ripple' && (
        <V1Ripple show={confirming} onCancel={handleCancel} onSwitch={handleSwitch} time={time} />
      )}
      {variant === 'split' && (
        <V9SplitHorizon show={confirming} onCancel={handleCancel} onSwitch={handleSwitch} time={time} />
      )}
      {variant === 'hourglass' && (
        <V5Hourglass show={confirming} onCancel={handleCancel} onSwitch={handleSwitch} time={time} />
      )}
      {variant === 'timeline' && (
        <V8Timeline show={confirming} onCancel={handleCancel} onSwitch={handleSwitch} time={time} />
      )}

      {/* Bottom sheet */}
      {variant === 'slideup' && (
        <V6SlideUp show={confirming} onCancel={handleCancel} onSwitch={handleSwitch} time={time} />
      )}
    </div>
  );
}

// ============================================================
// Variant section with label
// ============================================================
const VARIANTS: { key: VariantType; id: string; name: string; desc: string }[] = [
  {
    key: 'glass',
    id: 'V4',
    name: 'The Glass Card',
    desc: 'Frosted glass card with breathing border replaces the timer. Stopping and starting entries stacked with project dots, liquid edge glow. Native to Ternity\'s glass aesthetic.',
  },
  {
    key: 'hourglass',
    id: 'V5',
    name: 'The Hourglass',
    desc: 'Brand-first — the Ternity hourglass symbol is the centerpiece with a falling dot. Stopping above, starting below. On-brand and unmistakable.',
  },
  {
    key: 'slideup',
    id: 'V6',
    name: 'The Sheet',
    desc: 'Bottom sheet with drag handle slides over entries. Entries stay visible underneath. Familiar mobile pattern adapted for the tray popup — non-destructive, dismissible.',
  },
  {
    key: 'inline',
    id: 'V7',
    name: 'The Inline',
    desc: 'Entry row expands in-place into a compact confirmation. Breathing border, stop→start connector. Zero layout shift — the popup doesn\'t move, just the row transforms.',
  },
  {
    key: 'timeline',
    id: 'V8',
    name: 'The Timeline',
    desc: 'Vertical timeline with glowing dots and gradient connector line. Red node (stopping) to teal node (starting). Chronological metaphor — time flows downward.',
  },
  {
    key: 'ripple',
    id: 'V1',
    name: 'The Ripple',
    desc: 'Radial focus — pulsing ring draws attention to the duration being saved. Centered, meditative, like pressing pause on a record player.',
  },
  {
    key: 'gravity',
    id: 'V3',
    name: 'The Gravity Drop',
    desc: 'Two cards drop from the top like a notification shade. Current and next side-by-side — clean decision panel. Pushes content down.',
  },
  {
    key: 'split',
    id: 'V9',
    name: 'The Split Horizon',
    desc: 'Full-screen split — top half shows what stops (red), bottom half shows what starts (teal). Dramatic but informative. The divider dot is the fulcrum of the decision.',
  },
];

// ============================================================
// Page content
// ============================================================
function SwitchConfirmContent() {
  return (
    <div className="mx-auto px-6 py-8" style={{ maxWidth: 1600 }}>
      <h1
        className="text-center font-brand font-normal uppercase tracking-[5px] text-foreground/30"
        style={{ fontSize: scaled(11) }}
      >
        Switch Timer Confirmation
      </h1>
      <p className="mt-1 text-center text-xs text-foreground/15">
        Click ▶ on any entry to trigger the confirmation. Each variant shows a different pattern inside the 340px tray popup.
      </p>

      <div
        className="mx-auto mt-12 flex flex-wrap justify-center"
        style={{ gap: `${scaled(56)} ${scaled(48)}` }}
      >
        {VARIANTS.map((v) => (
          <div key={v.key} className="flex flex-col items-center" style={{ gap: scaled(12) }}>
            <div
              className="font-brand uppercase"
              style={{ fontSize: scaled(10), letterSpacing: '2px', color: 'hsl(var(--muted-foreground) / 0.5)' }}
            >
              {v.id}
            </div>
            <div
              className="font-brand font-semibold"
              style={{ fontSize: scaled(13), color: 'hsl(var(--foreground) / 0.7)' }}
            >
              {v.name}
            </div>
            <div
              className="text-center"
              style={{
                fontSize: scaled(11),
                color: 'hsl(var(--muted-foreground) / 0.4)',
                lineHeight: 1.5,
                maxWidth: scaled(340),
                padding: `0 ${scaled(8)}`,
              }}
            >
              {v.desc}
            </div>
            <TrayPopupMock variant={v.key} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Page shell
// ============================================================
export function DevSwitchConfirmPage() {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        
          <div className="min-h-screen bg-background text-foreground">
            <DevToolbar />
            <SwitchConfirmContent />
          </div>
        
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
