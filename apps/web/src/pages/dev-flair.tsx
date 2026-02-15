import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/theme-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { Play, Square, Check, X, ChevronDown, Search } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { scaled } from '@/lib/scaled';

// ============================================================
// Shared: fake timer hook
// ============================================================
function useFakeTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setRunning(true);
    setElapsed(6128); // start at 1:42:08 like the mockup
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
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
  const digits = display.split('');

  return { running, elapsed, display, digits, h, m, s, start, stop };
}

// ============================================================
// Animated digit — each character transitions independently
// ============================================================
function AnimatedDigit({ char, className }: { char: string; className?: string }) {
  return (
    <span className={`inline-block overflow-hidden ${className ?? ''}`} style={{ width: char === ':' ? '0.35em' : '0.6em', textAlign: 'center' }}>
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
// Smooth counting number — uses motion value for fluid interpolation
// ============================================================
function SmoothCounter({ value, className }: { value: number; className?: string }) {
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState('0:00:00');

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 0.4,
      ease: 'easeOut',
      onUpdate: (v) => {
        const rounded = Math.round(v);
        const hh = Math.floor(rounded / 3600);
        const mm = Math.floor((rounded % 3600) / 60);
        const ss = rounded % 60;
        setDisplay(`${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
      },
    });
    return () => controls.stop();
  }, [value, motionVal]);

  return <span className={className}>{display}</span>;
}

// ============================================================
// LEVEL 1: CLEAN — current design + smooth polish
// ============================================================
function TimerBarClean() {
  const { running, elapsed, start, stop } = useFakeTimer();

  return (
    <div>
      <motion.div
        className="flex items-center gap-3 rounded-lg border px-4 py-3"
        animate={{
          borderColor: running
            ? 'hsl(var(--primary) / 0.5)'
            : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.3 }}
      >
        <input
          className="flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          style={{ fontSize: scaled(13) }}
          placeholder="What are you working on?"
          defaultValue={running ? 'PROJ-347 Implement user notifications API' : ''}
        />

        {running && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
            style={{ fontSize: scaled(11) }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'hsl(var(--t-project-1))' }}
            />
            <span className="text-muted-foreground">Platform Core</span>
          </motion.div>
        )}

        <SmoothCounter
          value={running ? elapsed : 0}
          className="font-brand text-xl font-semibold tracking-wider text-primary tabular-nums"
        />

        <AnimatePresence mode="wait">
          {running ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              onClick={stop}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="start"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              onClick={start}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================================
// LEVEL 2: ALIVE — pulse, glow, animated digits
// ============================================================
function TimerBarAlive() {
  const { running, digits, start, stop } = useFakeTimer();

  return (
    <div>
      <motion.div
        className="relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
        animate={{
          borderColor: running
            ? 'hsl(var(--primary) / 0.5)'
            : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Subtle breathing glow when running */}
        {running && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-lg"
            animate={{
              boxShadow: [
                'inset 0 0 20px hsl(var(--primary) / 0.03)',
                'inset 0 0 40px hsl(var(--primary) / 0.08)',
                'inset 0 0 20px hsl(var(--primary) / 0.03)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <input
          className="relative z-10 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          style={{ fontSize: scaled(13) }}
          placeholder="What are you working on?"
          defaultValue={running ? 'PROJ-347 Implement user notifications API' : ''}
        />

        {running && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10 flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
            style={{ fontSize: scaled(11) }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'hsl(var(--t-project-1))' }}
            />
            <span className="text-muted-foreground">Platform Core</span>
          </motion.div>
        )}

        {/* Animated individual digits */}
        <div className="relative z-10 font-brand text-xl font-semibold tracking-wider text-primary tabular-nums">
          {running ? (
            digits.map((d, i) => <AnimatedDigit key={i} char={d} />)
          ) : (
            <span style={{ opacity: 0.4 }}>0:00:00</span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {running ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={stop}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="start"
              initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={start}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================================
// LEVEL 3: ELECTRIC — animated border, gradient bg, spark
// ============================================================
function TimerBarElectric() {
  const { running, digits, start, stop } = useFakeTimer();

  return (
    <div>
      {/* Outer wrapper for the animated border */}
      <div className="relative rounded-lg p-[1px]">
        {/* Animated gradient border */}
        {running && (
          <motion.div
            className="absolute inset-0 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: 'linear-gradient(var(--border-angle, 0deg), hsl(var(--primary)), hsl(var(--primary) / 0.2), hsl(var(--chart-3)), hsl(var(--primary)))',
            }}
          >
            <style>{`
              @property --border-angle {
                syntax: '<angle>';
                inherits: false;
                initial-value: 0deg;
              }
              @keyframes border-rotate {
                to { --border-angle: 360deg; }
              }
            `}</style>
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                background: 'linear-gradient(var(--border-angle, 0deg), hsl(var(--primary)), hsl(var(--primary) / 0.1), hsl(var(--chart-3)), hsl(var(--primary) / 0.3))',
                animation: 'border-rotate 3s linear infinite',
              }}
            />
          </motion.div>
        )}

        {/* Inner content */}
        <motion.div
          className="relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
          animate={{
            borderColor: running ? 'transparent' : 'hsl(var(--t-timer-border))',
            backgroundColor: 'hsl(var(--t-timer-bg))',
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Moving gradient background when running */}
          {running && (
            <>
              <motion.div
                className="pointer-events-none absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, transparent 40%, hsl(var(--chart-3) / 0.03) 70%, transparent 100%)',
                  backgroundSize: '200% 200%',
                  animation: 'gradient-shift 6s ease infinite',
                }}
              />
              <style>{`
                @keyframes gradient-shift {
                  0%, 100% { background-position: 0% 50%; }
                  50% { background-position: 100% 50%; }
                }
              `}</style>
              {/* Shimmer line */}
              <motion.div
                className="pointer-events-none absolute inset-0"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
                style={{
                  width: '30%',
                  background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.06), transparent)',
                }}
              />
            </>
          )}

          <input
            className="relative z-10 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: scaled(13) }}
            placeholder="What are you working on?"
            defaultValue={running ? 'PROJ-347 Implement user notifications API' : ''}
          />

          {running && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10 flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1"
              style={{ fontSize: scaled(11) }}
            >
              <motion.span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'hsl(var(--t-project-1))' }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-muted-foreground">Platform Core</span>
            </motion.div>
          )}

          {/* Glowing animated digits */}
          <div className="relative z-10">
            <div className="font-brand text-xl font-semibold tracking-wider tabular-nums">
              {running ? (
                <motion.span
                  className="inline-flex"
                  animate={{
                    textShadow: [
                      '0 0 8px hsl(var(--primary) / 0.3)',
                      '0 0 16px hsl(var(--primary) / 0.5)',
                      '0 0 8px hsl(var(--primary) / 0.3)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ color: 'hsl(var(--primary))' }}
                >
                  {digits.map((d, i) => (
                    <AnimatedDigit key={i} char={d} />
                  ))}
                </motion.span>
              ) : (
                <span className="text-primary" style={{ opacity: 0.4 }}>0:00:00</span>
              )}
            </div>
          </div>

          {/* Start/stop with ripple effect */}
          <AnimatePresence mode="wait">
            {running ? (
              <motion.button
                key="stop"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                whileTap={{ scale: 0.8 }}
                whileHover={{ scale: 1.1 }}
                onClick={stop}
                className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                {/* Pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-destructive"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.button>
            ) : (
              <motion.button
                key="start"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                whileTap={{ scale: 0.8 }}
                whileHover={{
                  scale: 1.1,
                  boxShadow: '0 0 20px hsl(var(--primary) / 0.4)',
                }}
                onClick={start}
                className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================
// LEVEL 3a: EMBER GLOW — one slow color wash, nothing else
// ============================================================
function TimerBarEmberGlow() {
  const { running, digits, start, stop } = useFakeTimer();

  return (
    <div>
      <motion.div
        className="relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
        animate={{
          borderColor: running
            ? 'hsl(var(--primary) / 0.4)'
            : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Single slow aurora wash — the only animation */}
        {running && (
          <>
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            >
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  background: 'linear-gradient(120deg, hsl(var(--primary) / 0.08), hsl(var(--chart-3) / 0.06), hsl(var(--primary) / 0.04), hsl(var(--chart-5) / 0.06), hsl(var(--primary) / 0.08))',
                  backgroundSize: '300% 300%',
                  animation: 'ember-wash 8s ease-in-out infinite',
                }}
              />
            </motion.div>
            <style>{`
              @keyframes ember-wash {
                0%   { background-position: 0% 50%; }
                25%  { background-position: 100% 25%; }
                50%  { background-position: 50% 100%; }
                75%  { background-position: 0% 75%; }
                100% { background-position: 0% 50%; }
              }
            `}</style>
          </>
        )}

        <input
          className="relative z-10 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          style={{ fontSize: scaled(13) }}
          placeholder="What are you working on?"
          defaultValue={running ? 'PROJ-347 Implement user notifications API' : ''}
        />

        {running && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10 flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
            style={{ fontSize: scaled(11) }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'hsl(var(--t-project-1))' }}
            />
            <span className="text-muted-foreground">Platform Core</span>
          </motion.div>
        )}

        {/* Digits with color that follows the wash */}
        <div className="relative z-10 font-brand text-xl font-semibold tracking-wider tabular-nums">
          {running ? (
            <motion.span
              className="inline-flex"
              animate={{
                color: [
                  'hsl(var(--primary))',
                  'hsl(var(--chart-3))',
                  'hsl(var(--primary))',
                ],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            >
              {digits.map((d, i) => (
                <AnimatedDigit key={i} char={d} />
              ))}
            </motion.span>
          ) : (
            <span className="text-primary" style={{ opacity: 0.4 }}>0:00:00</span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {running ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={stop}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="start"
              initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={start}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================================
// LEVEL 3b: HEARTBEAT — still most of the time, periodic pulse
// ============================================================
function TimerBarHeartbeat() {
  const { running, digits, start, stop } = useFakeTimer();

  return (
    <div>
      <motion.div
        className="relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
        animate={{
          borderColor: running
            ? 'hsl(var(--primary) / 0.4)'
            : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Sonar ping — radiates from center every 3s */}
        {running && (
          <>
            <div
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{ animation: 'heartbeat-ping 3s ease-out infinite' }}
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{ animation: 'heartbeat-ping 3s ease-out infinite 0.15s' }}
            />
            <style>{`
              @keyframes heartbeat-ping {
                0% {
                  box-shadow: inset 0 0 0 0 hsl(var(--primary) / 0.15);
                }
                8% {
                  box-shadow: inset 0 0 30px 5px hsl(var(--primary) / 0.12);
                }
                20% {
                  box-shadow: inset 0 0 60px 10px hsl(var(--primary) / 0);
                }
                100% {
                  box-shadow: inset 0 0 0 0 hsl(var(--primary) / 0);
                }
              }
            `}</style>
          </>
        )}

        <input
          className="relative z-10 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          style={{ fontSize: scaled(13) }}
          placeholder="What are you working on?"
          defaultValue={running ? 'PROJ-347 Implement user notifications API' : ''}
        />

        {running && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10 flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
            style={{ fontSize: scaled(11) }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'hsl(var(--t-project-1))' }}
            />
            <span className="text-muted-foreground">Platform Core</span>
          </motion.div>
        )}

        {/* Digits pulse subtly with the heartbeat */}
        <div className="relative z-10 font-brand text-xl font-semibold tracking-wider tabular-nums">
          {running ? (
            <motion.span
              className="inline-flex text-primary"
              animate={{
                textShadow: [
                  '0 0 0px hsl(var(--primary) / 0)',
                  '0 0 12px hsl(var(--primary) / 0.4)',
                  '0 0 0px hsl(var(--primary) / 0)',
                  '0 0 0px hsl(var(--primary) / 0)',
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeOut',
                times: [0, 0.08, 0.2, 1],
              }}
            >
              {digits.map((d, i) => (
                <AnimatedDigit key={i} char={d} />
              ))}
            </motion.span>
          ) : (
            <span className="text-primary" style={{ opacity: 0.4 }}>0:00:00</span>
          )}
        </div>

        {/* Border also pulses with the heartbeat */}
        {running && (
          <div
            className="pointer-events-none absolute inset-0 rounded-lg"
            style={{
              animation: 'heartbeat-border 3s ease-out infinite',
            }}
          />
        )}
        {running && (
          <style>{`
            @keyframes heartbeat-border {
              0%   { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
              8%   { box-shadow: 0 0 0 1px hsl(var(--primary) / 0.3); }
              20%  { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
              100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
            }
          `}</style>
        )}

        <AnimatePresence mode="wait">
          {running ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              whileTap={{ scale: 0.85 }}
              onClick={stop}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="start"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              whileTap={{ scale: 0.85 }}
              onClick={start}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================================
// LEVEL 3c: LIQUID EDGE — fluid blob drifts along bottom edge
// ============================================================
function TimerBarLiquidEdge() {
  const { running, digits, start, stop } = useFakeTimer();

  return (
    <div>
      <motion.div
        className="relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
        animate={{
          borderColor: running
            ? 'hsl(var(--primary) / 0.3)'
            : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Liquid blob that drifts along the bottom edge */}
        {running && (
          <>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-lg">
              <div
                className="absolute h-full"
                style={{
                  width: '35%',
                  background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.7) 0%, hsl(var(--primary) / 0.3) 40%, transparent 70%)',
                  filter: 'blur(1px)',
                  animation: 'liquid-drift 5s ease-in-out infinite alternate',
                }}
              />
              <div
                className="absolute h-full"
                style={{
                  width: '20%',
                  background: 'radial-gradient(ellipse at center, hsl(var(--chart-3) / 0.5) 0%, hsl(var(--chart-3) / 0.2) 40%, transparent 70%)',
                  filter: 'blur(1px)',
                  animation: 'liquid-drift-2 7s ease-in-out infinite alternate',
                }}
              />
            </div>
            <style>{`
              @keyframes liquid-drift {
                0%   { left: -5%; }
                100% { left: 70%; }
              }
              @keyframes liquid-drift-2 {
                0%   { right: -5%; left: auto; }
                100% { right: 75%; left: auto; }
              }
            `}</style>
            {/* Subtle glow reflection from the liquid onto the bar */}
            <motion.div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-lg"
              style={{
                background: 'linear-gradient(to top, hsl(var(--primary) / 0.03), transparent)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            />
          </>
        )}

        <input
          className="relative z-10 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          style={{ fontSize: scaled(13) }}
          placeholder="What are you working on?"
          defaultValue={running ? 'PROJ-347 Implement user notifications API' : ''}
        />

        {running && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10 flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
            style={{ fontSize: scaled(11) }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'hsl(var(--t-project-1))' }}
            />
            <span className="text-muted-foreground">Platform Core</span>
          </motion.div>
        )}

        {/* Clean digits — let the liquid do the talking */}
        <div className="relative z-10 font-brand text-xl font-semibold tracking-wider text-primary tabular-nums">
          {running ? (
            <span className="inline-flex">
              {digits.map((d, i) => (
                <AnimatedDigit key={i} char={d} />
              ))}
            </span>
          ) : (
            <span style={{ opacity: 0.4 }}>0:00:00</span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {running ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={stop}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="start"
              initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={start}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================================
// INLINE EDITOR — Shared types and mock data
// ============================================================
interface MockEntry {
  id: string;
  description: string;
  project: string;
  projectColor: string;
  client: string;
  startTime: string;
  endTime: string;
  duration: string;
}

const MOCK_ENTRIES: MockEntry[] = [
  {
    id: '1',
    description: 'PROJ-341 Fix pagination edge case on reports',
    project: 'Platform Core',
    projectColor: 'hsl(var(--t-project-1))',
    client: 'Acme Corp',
    startTime: '09:15',
    endTime: '11:45',
    duration: '2:30:00',
  },
  {
    id: '2',
    description: 'Design review — onboarding flow iteration 3',
    project: 'Mobile App',
    projectColor: 'hsl(var(--chart-3))',
    client: 'Acme Corp',
    startTime: '13:00',
    endTime: '14:30',
    duration: '1:30:00',
  },
  {
    id: '3',
    description: '',
    project: '',
    projectColor: '',
    client: '',
    startTime: '14:45',
    endTime: '16:20',
    duration: '1:35:00',
  },
];

type EditingField = { entryId: string; field: 'description' | 'time' | 'project' } | null;

// ============================================================
// INLINE EDITOR — F2 Alive: smooth morph, breathing focus
// ============================================================
function InlineEditorAlive() {
  const [editing, setEditing] = useState<EditingField>(null);
  const [values, setValues] = useState<Record<string, MockEntry>>(
    () => Object.fromEntries(MOCK_ENTRIES.map((e) => [e.id, { ...e }])),
  );
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');

  const handleSave = (entryId: string) => {
    setEditing(null);
    setSavedFlash(entryId);
    setTimeout(() => setSavedFlash(null), 600);
  };

  const handleCancel = () => setEditing(null);

  const filteredProjects = MOCK_PROJECTS_PICKER.map((group) => ({
    ...group,
    projects: group.projects.filter((p) =>
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      group.client.toLowerCase().includes(projectSearch.toLowerCase()),
    ),
  })).filter((g) => g.projects.length > 0);

  const handleSelectProject = (entryId: string, project: { name: string; color: string }, client: string) => {
    setValues((v) => {
      const prev = v[entryId];
      if (!prev) return v;
      return { ...v, [entryId]: { ...prev, project: project.name, projectColor: project.color, client } };
    });
    setEditing(null);
    setProjectSearch('');
    setSavedFlash(entryId);
    setTimeout(() => setSavedFlash(null), 600);
  };

  return (
    <div className="rounded-lg border border-border">
      {/* Day header */}
      <div
        className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-2"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today — Friday, 14 Feb
        </span>
        <span className="font-brand text-xs font-semibold tabular-nums text-foreground">
          5:35:00
        </span>
      </div>

      {Object.values(values).map((entry) => {
        const isEditingDesc = editing?.entryId === entry.id && editing.field === 'description';
        const isEditingTime = editing?.entryId === entry.id && editing.field === 'time';
        const isEditingProject = editing?.entryId === entry.id && editing.field === 'project';
        const isEditing = isEditingDesc || isEditingTime || isEditingProject;
        const justSaved = savedFlash === entry.id;
        const noDesc = !entry.description;

        return (
          <motion.div
            key={entry.id}
            className={`relative flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 ${isEditingProject ? 'z-20' : ''}`}
            animate={{
              backgroundColor: isEditing
                ? 'hsl(var(--muted) / 0.15)'
                : 'transparent',
            }}
            transition={{ duration: 0.2 }}
          >
            {/* Breathing glow on editing row */}
            {isEditing && (
              <motion.div
                className="pointer-events-none absolute inset-0"
                animate={{
                  boxShadow: [
                    'inset 0 0 15px hsl(var(--primary) / 0.02)',
                    'inset 0 0 30px hsl(var(--primary) / 0.06)',
                    'inset 0 0 15px hsl(var(--primary) / 0.02)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* Save flash */}
            <AnimatePresence>
              {justSaved && (
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  initial={{ backgroundColor: 'hsl(var(--primary) / 0.08)' }}
                  animate={{ backgroundColor: 'hsl(var(--primary) / 0)' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              )}
            </AnimatePresence>

            {/* Description + project */}
            <div className="relative z-10 flex-1 min-w-0">
              {/* Description — fixed height container, no layout shift */}
              <div className="flex h-5 items-center">
                <AnimatePresence mode="wait">
                  {isEditingDesc ? (
                    <motion.div
                      key="editing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex w-full items-center gap-2"
                    >
                      <motion.input
                        className="flex-1 rounded-md bg-muted/40 px-2 text-[13px] leading-5 text-foreground outline-none"
                        style={{
                          height: '20px',
                          border: '1px solid hsl(var(--primary) / 0.4)',
                        }}
                        animate={{
                          borderColor: [
                            'hsl(var(--primary) / 0.3)',
                            'hsl(var(--primary) / 0.6)',
                            'hsl(var(--primary) / 0.3)',
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        value={entry.description}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [entry.id]: { ...v[entry.id]!, description: e.target.value },
                          }))
                        }
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(entry.id);
                          if (e.key === 'Escape') handleCancel();
                        }}
                      />
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleSave(entry.id)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Check className="h-2.5 w-2.5" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={handleCancel}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-2.5 w-2.5" />
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="display"
                      initial={false}
                      className={`cursor-pointer truncate text-[13px] leading-5 ${noDesc ? 'italic text-muted-foreground' : 'text-foreground'} hover:text-primary`}
                      onClick={() => setEditing({ entryId: entry.id, field: 'description' })}
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                    >
                      {entry.description || 'No description'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Project line — fixed height, dropdown escapes */}
              <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
                {isEditingProject ? (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-1.5"
                    >
                      <motion.div
                        className="flex h-[18px] cursor-pointer items-center gap-1.5 rounded-full bg-muted/40 px-2.5"
                        style={{ border: '1px solid hsl(var(--primary) / 0.4)', fontSize: scaled(11) }}
                        animate={{
                          borderColor: [
                            'hsl(var(--primary) / 0.3)',
                            'hsl(var(--primary) / 0.6)',
                            'hsl(var(--primary) / 0.3)',
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: entry.projectColor || 'hsl(var(--muted-foreground))' }}
                        />
                        <span className="text-foreground">{entry.project || 'Select project'}</span>
                        <ChevronDown className="h-3 w-3 rotate-180 text-muted-foreground" />
                      </motion.div>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => { setEditing(null); setProjectSearch(''); }}
                        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-2.5 w-2.5" />
                      </motion.button>
                    </motion.div>

                    {/* Dropdown — P1 style */}
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="absolute left-0 top-full z-30 mt-1 w-[260px] overflow-hidden rounded-lg border border-border shadow-lg"
                        style={{ background: 'hsl(var(--popover))' }}
                      >
                        <div className="border-b border-border p-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <motion.input
                              className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-[12px] text-foreground outline-none"
                              style={{ border: '1px solid hsl(var(--border))' }}
                              whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
                              placeholder="Search projects..."
                              value={projectSearch}
                              onChange={(e) => setProjectSearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-[220px] overflow-y-auto p-1">
                          {filteredProjects.length === 0 ? (
                            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                              No projects match "{projectSearch}"
                            </div>
                          ) : (
                            filteredProjects.map((group, gi) => (
                              <div key={group.client}>
                                <div
                                  className="px-2.5 pb-1 pt-2.5 font-brand text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
                                  style={{ letterSpacing: '1.5px', opacity: 0.6 }}
                                >
                                  {group.client}
                                </div>
                                {group.projects.map((project, pi) => {
                                  const isCurrent = entry.project === project.name;
                                  return (
                                    <motion.button
                                      key={project.name}
                                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                                        isCurrent
                                          ? 'bg-primary/8 text-foreground'
                                          : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                                      }`}
                                      initial={{ opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: gi * 0.05 + pi * 0.03, duration: 0.15 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleSelectProject(entry.id, project, group.client)}
                                    >
                                      <motion.span
                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                        style={{ background: project.color }}
                                        animate={isCurrent ? { scale: [1, 1.3, 1] } : {}}
                                        transition={{ duration: 0.3 }}
                                      />
                                      <span className="flex-1 truncate">{project.name}</span>
                                      {isCurrent && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                                        >
                                          <Check className="h-3.5 w-3.5 text-primary" />
                                        </motion.div>
                                      )}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="border-t border-border p-1">
                          <motion.button
                            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setValues((v) => ({
                                ...v,
                                [entry.id]: { ...v[entry.id]!, project: '', projectColor: '', client: '' },
                              }));
                              setEditing(null);
                              setProjectSearch('');
                              setSavedFlash(entry.id);
                              setTimeout(() => setSavedFlash(null), 600);
                            }}
                          >
                            <X className="h-3 w-3" />
                            <span>No project</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </>
                ) : entry.project ? (
                  <span
                    className="flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-primary"
                    style={{ fontSize: scaled(11) }}
                    onClick={() => setEditing({ entryId: entry.id, field: 'project' })}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: entry.projectColor }}
                    />
                    {entry.client} · {entry.project}
                  </span>
                ) : (
                  <span
                    className="flex cursor-pointer items-center gap-1 text-amber-500/70 hover:text-amber-400"
                    style={{ fontSize: scaled(11) }}
                    onClick={() => setEditing({ entryId: entry.id, field: 'project' })}
                  >
                    + Add project
                  </span>
                )}
              </div>
            </div>

            {/* Time range — fixed height */}
            <div className="relative z-10 flex h-5 items-center gap-1 text-right shrink-0">
              {isEditingTime ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1"
                >
                  <motion.input
                    className="h-5 w-[48px] rounded-md bg-muted/40 px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
                    style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
                    animate={{
                      borderColor: [
                        'hsl(var(--primary) / 0.3)',
                        'hsl(var(--primary) / 0.6)',
                        'hsl(var(--primary) / 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    value={entry.startTime}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [entry.id]: { ...v[entry.id]!, startTime: e.target.value },
                      }))
                    }
                    autoFocus
                  />
                  <span className="text-[11px] text-muted-foreground">–</span>
                  <motion.input
                    className="h-5 w-[48px] rounded-md bg-muted/40 px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
                    style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
                    animate={{
                      borderColor: [
                        'hsl(var(--primary) / 0.3)',
                        'hsl(var(--primary) / 0.6)',
                        'hsl(var(--primary) / 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    value={entry.endTime}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [entry.id]: { ...v[entry.id]!, endTime: e.target.value },
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(entry.id);
                      if (e.key === 'Escape') handleCancel();
                    }}
                  />
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleSave(entry.id)}
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="h-2.5 w-2.5" />
                  </motion.button>
                </motion.div>
              ) : (
                <span
                  className="cursor-pointer text-[11px] tabular-nums text-muted-foreground hover:text-primary"
                  onClick={() => setEditing({ entryId: entry.id, field: 'time' })}
                >
                  {entry.startTime} – {entry.endTime}
                </span>
              )}
            </div>

            {/* Duration */}
            <span className="relative z-10 font-brand text-sm font-semibold tabular-nums text-foreground shrink-0">
              {entry.duration}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================================
// INLINE EDITOR — F3c Liquid Edge: liquid underline on active field
// ============================================================
function InlineEditorLiquidEdge() {
  const [editing, setEditing] = useState<EditingField>(null);
  const [values, setValues] = useState<Record<string, MockEntry>>(
    () => Object.fromEntries(MOCK_ENTRIES.map((e) => [e.id, { ...e }])),
  );
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const handleSave = (entryId: string) => {
    setEditing(null);
    setSavedFlash(entryId);
    setTimeout(() => setSavedFlash(null), 800);
  };

  const handleCancel = () => setEditing(null);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Day header */}
      <div
        className="flex items-center justify-between border-b border-border px-4 py-2"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today — Friday, 14 Feb
        </span>
        <span className="font-brand text-xs font-semibold tabular-nums text-foreground">
          5:35:00
        </span>
      </div>

      <style>{`
        @keyframes liquid-field-drift {
          0%   { left: -10%; }
          100% { left: 75%; }
        }
        @keyframes liquid-field-drift-2 {
          0%   { right: -10%; left: auto; }
          100% { right: 75%; left: auto; }
        }
        @keyframes save-ripple {
          0%   { transform: scaleX(0); opacity: 0.6; }
          100% { transform: scaleX(1); opacity: 0; }
        }
      `}</style>

      {Object.values(values).map((entry) => {
        const isEditingDesc = editing?.entryId === entry.id && editing.field === 'description';
        const isEditingTime = editing?.entryId === entry.id && editing.field === 'time';
        const isEditingProject = editing?.entryId === entry.id && editing.field === 'project';
        const justSaved = savedFlash === entry.id;
        const noDesc = !entry.description;

        return (
          <div
            key={entry.id}
            className="relative flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
          >
            {/* Save ripple — liquid shoots across bottom edge */}
            <AnimatePresence>
              {justSaved && (
                <motion.div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.6) 30%, hsl(var(--primary) / 0.8) 50%, hsl(var(--primary) / 0.6) 70%, transparent 100%)',
                      transformOrigin: 'left center',
                      animation: 'save-ripple 0.6s ease-out forwards',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Description + project */}
            <div className="relative z-10 flex-1 min-w-0">
              {/* Description — fixed height container */}
              <div className="flex h-5 items-center">
                {isEditingDesc ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="relative flex w-full items-center gap-2"
                  >
                    <div className="relative flex-1">
                      <input
                        className="h-5 w-full rounded-none border-0 bg-transparent px-0 text-[13px] leading-5 text-foreground outline-none"
                        value={entry.description}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [entry.id]: { ...v[entry.id]!, description: e.target.value },
                          }))
                        }
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(entry.id);
                          if (e.key === 'Escape') handleCancel();
                        }}
                      />
                      {/* Liquid underline on active field */}
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
                        <div
                          className="absolute h-full"
                          style={{
                            width: '40%',
                            background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.8) 0%, hsl(var(--primary) / 0.3) 50%, transparent 75%)',
                            filter: 'blur(0.5px)',
                            animation: 'liquid-field-drift 3s ease-in-out infinite alternate',
                          }}
                        />
                        <div
                          className="absolute h-full"
                          style={{
                            width: '25%',
                            background: 'radial-gradient(ellipse at center, hsl(var(--chart-3) / 0.6) 0%, hsl(var(--chart-3) / 0.2) 50%, transparent 75%)',
                            filter: 'blur(0.5px)',
                            animation: 'liquid-field-drift-2 4s ease-in-out infinite alternate',
                          }}
                        />
                      </div>
                    </div>
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleSave(entry.id)}
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check className="h-2.5 w-2.5" />
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={handleCancel}
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </motion.button>
                  </motion.div>
                ) : (
                  <span
                    className={`cursor-pointer truncate text-[13px] leading-5 ${noDesc ? 'italic text-muted-foreground' : 'text-foreground'} transition-colors hover:text-primary`}
                    onClick={() => setEditing({ entryId: entry.id, field: 'description' })}
                  >
                    {entry.description || 'No description'}
                  </span>
                )}
              </div>

              {/* Project line — fixed height */}
              <div className="mt-1 flex h-[18px] items-center gap-1.5">
                {isEditingProject ? (
                  <div className="relative flex items-center gap-2">
                    <div className="relative">
                      <div
                        className="flex h-[18px] items-center gap-1.5 bg-transparent px-0"
                        style={{ fontSize: scaled(11) }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: 'hsl(var(--t-project-1))' }}
                        />
                        <span className="text-foreground">Platform Core</span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                      {/* Liquid underline on project picker */}
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
                        <div
                          className="absolute h-full"
                          style={{
                            width: '50%',
                            background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.7) 0%, transparent 70%)',
                            animation: 'liquid-field-drift 2.5s ease-in-out infinite alternate',
                          }}
                        />
                      </div>
                    </div>
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleSave(entry.id)}
                      className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check className="h-2 w-2" />
                    </motion.button>
                  </div>
                ) : entry.project ? (
                  <span
                    className="flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                    style={{ fontSize: scaled(11) }}
                    onClick={() => setEditing({ entryId: entry.id, field: 'project' })}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: entry.projectColor }}
                    />
                    {entry.client} · {entry.project}
                  </span>
                ) : (
                  <span
                    className="flex cursor-pointer items-center gap-1 text-amber-500/70 transition-colors hover:text-amber-400"
                    style={{ fontSize: scaled(11) }}
                    onClick={() => setEditing({ entryId: entry.id, field: 'project' })}
                  >
                    + Add project
                  </span>
                )}
              </div>
            </div>

            {/* Time range — fixed height */}
            <div className="relative z-10 flex h-5 items-center gap-1 text-right shrink-0">
              {isEditingTime ? (
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <input
                      className="h-5 w-[48px] rounded-none border-0 bg-transparent px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
                      value={entry.startTime}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [entry.id]: { ...v[entry.id]!, startTime: e.target.value },
                        }))
                      }
                      autoFocus
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
                      <div
                        className="absolute h-full"
                        style={{
                          width: '60%',
                          background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.8) 0%, transparent 70%)',
                          animation: 'liquid-field-drift 2s ease-in-out infinite alternate',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground">–</span>
                  <div className="relative">
                    <input
                      className="h-5 w-[48px] rounded-none border-0 bg-transparent px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
                      value={entry.endTime}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [entry.id]: { ...v[entry.id]!, endTime: e.target.value },
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave(entry.id);
                        if (e.key === 'Escape') handleCancel();
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
                      <div
                        className="absolute h-full"
                        style={{
                          width: '60%',
                          background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.8) 0%, transparent 70%)',
                          animation: 'liquid-field-drift 2.2s ease-in-out infinite alternate',
                        }}
                      />
                    </div>
                  </div>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleSave(entry.id)}
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="h-2.5 w-2.5" />
                  </motion.button>
                </div>
              ) : (
                <span
                  className="cursor-pointer text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-primary"
                  onClick={() => setEditing({ entryId: entry.id, field: 'time' })}
                >
                  {entry.startTime} – {entry.endTime}
                </span>
              )}
            </div>

            {/* Duration */}
            <span className="relative z-10 font-brand text-sm font-semibold tabular-nums text-foreground shrink-0">
              {entry.duration}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// PROJECT PICKER DROPDOWN — E2 Alive treatment
// ============================================================
const MOCK_PROJECTS_PICKER = [
  { client: 'Acme Corp', projects: [
    { name: 'Platform Core', color: 'hsl(var(--t-project-1))' },
    { name: 'Mobile App', color: 'hsl(var(--chart-3))' },
    { name: 'API Gateway', color: 'hsl(var(--chart-5))' },
  ]},
  { client: 'Globex Inc', projects: [
    { name: 'Dashboard Redesign', color: 'hsl(var(--chart-2))' },
    { name: 'Analytics Pipeline', color: 'hsl(var(--chart-4))' },
  ]},
  { client: 'Internal', projects: [
    { name: 'Team Meetings', color: 'hsl(var(--muted-foreground))' },
    { name: 'Code Review', color: 'hsl(var(--primary))' },
  ]},
];

function ProjectPickerDemo() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ name: string; color: string; client: string } | null>(
    { name: 'Platform Core', color: 'hsl(var(--t-project-1))', client: 'Acme Corp' },
  );
  const [justSelected, setJustSelected] = useState<string | null>(null);

  const filtered = MOCK_PROJECTS_PICKER.map((group) => ({
    ...group,
    projects: group.projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      group.client.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((g) => g.projects.length > 0);

  const handleSelect = (project: { name: string; color: string }, client: string) => {
    setSelected({ ...project, client });
    setJustSelected(project.name);
    setOpen(false);
    setSearch('');
    setTimeout(() => setJustSelected(null), 600);
  };

  return (
    <div className="rounded-lg border border-border">
      {/* Simulated entry row context */}
      <div
        className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-2"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today — Friday, 14 Feb
        </span>
        <span className="font-brand text-xs font-semibold tabular-nums text-foreground">
          5:35:00
        </span>
      </div>

      {/* Entry row with project picker trigger */}
      <motion.div
        className="relative flex items-center gap-3 border-b border-border px-4 py-2.5"
        animate={{
          backgroundColor: open ? 'hsl(var(--muted) / 0.15)' : 'transparent',
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Breathing glow when picker is open */}
        {open && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            animate={{
              boxShadow: [
                'inset 0 0 15px hsl(var(--primary) / 0.02)',
                'inset 0 0 30px hsl(var(--primary) / 0.06)',
                'inset 0 0 15px hsl(var(--primary) / 0.02)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Save flash */}
        <AnimatePresence>
          {justSelected && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ backgroundColor: 'hsl(var(--primary) / 0.08)' }}
              animate={{ backgroundColor: 'hsl(var(--primary) / 0)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex-1 min-w-0">
          <div className="flex h-5 items-center">
            <span className="truncate text-[13px] leading-5 text-foreground">
              PROJ-341 Fix pagination edge case on reports
            </span>
          </div>
          <div className="mt-1 flex h-[18px] items-center gap-1.5">
            <span
              className="flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-primary"
              style={{ fontSize: scaled(11) }}
              onClick={() => setOpen(!open)}
            >
              <span
                className="h-2 w-2 rounded-full transition-colors"
                style={{ background: selected?.color ?? 'hsl(var(--muted-foreground))' }}
              />
              {selected ? `${selected.client} · ${selected.name}` : '+ Add project'}
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </span>
          </div>
        </div>

        <span className="relative z-10 text-[11px] tabular-nums text-muted-foreground">09:15 – 11:45</span>
        <span className="relative z-10 font-brand text-sm font-semibold tabular-nums text-foreground">2:30:00</span>

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute left-4 top-full z-30 mt-1 w-[260px] overflow-hidden rounded-lg border border-border shadow-lg"
              style={{ background: 'hsl(var(--popover))' }}
            >
              {/* Search input */}
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <motion.input
                    className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-[12px] text-foreground outline-none"
                    style={{ border: '1px solid hsl(var(--border))' }}
                    whileFocus={{
                      borderColor: 'hsl(var(--primary) / 0.5)',
                    }}
                    placeholder="Search projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Project list */}
              <div className="max-h-[220px] overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                    No projects match "{search}"
                  </div>
                ) : (
                  filtered.map((group, gi) => (
                    <div key={group.client}>
                      {/* Client header */}
                      <div
                        className="px-2.5 pb-1 pt-2.5 font-brand text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
                        style={{ letterSpacing: '1.5px', opacity: 0.6 }}
                      >
                        {group.client}
                      </div>

                      {/* Projects */}
                      {group.projects.map((project, pi) => {
                        const isSelected = selected?.name === project.name;
                        return (
                          <motion.button
                            key={project.name}
                            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                              isSelected
                                ? 'bg-primary/8 text-foreground'
                                : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                            }`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: gi * 0.05 + pi * 0.03, duration: 0.15 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelect(project, group.client)}
                          >
                            <motion.span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ background: project.color }}
                              animate={isSelected ? {
                                scale: [1, 1.3, 1],
                              } : {}}
                              transition={{ duration: 0.3 }}
                            />
                            <span className="flex-1 truncate">{project.name}</span>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                              >
                                <Check className="h-3.5 w-3.5 text-primary" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* No project option */}
              <div className="border-t border-border p-1">
                <motion.button
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelected(null);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <X className="h-3 w-3" />
                  <span>No project</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Second row — static */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex h-5 items-center">
            <span className="truncate text-[13px] leading-5 text-foreground">
              Design review — onboarding flow iteration 3
            </span>
          </div>
          <div className="mt-1 flex h-[18px] items-center gap-1.5">
            <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: scaled(11) }}>
              <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--chart-3))' }} />
              Acme Corp · Mobile App
            </span>
          </div>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">13:00 – 14:30</span>
        <span className="font-brand text-sm font-semibold tabular-nums text-foreground">1:30:00</span>
      </div>
    </div>
  );
}

// ============================================================
// PROJECT CONFIRM ANIMATIONS — 3 options with P1 dropdown
// ============================================================

// Shared P1-style dropdown for confirm demos
function ConfirmDropdown({
  open,
  search,
  onSearchChange,
  currentProject,
  onSelect,
  onClear,
}: {
  open: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  currentProject: string;
  onSelect: (project: { name: string; color: string }, client: string) => void;
  onClear: () => void;
}) {
  const filtered = MOCK_PROJECTS_PICKER.map((group) => ({
    ...group,
    projects: group.projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      group.client.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((g) => g.projects.length > 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute left-0 top-full z-30 mt-1 w-[260px] overflow-hidden rounded-lg border border-border shadow-lg"
          style={{ background: 'hsl(var(--popover))' }}
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <motion.input
                className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-[12px] text-foreground outline-none"
                style={{ border: '1px solid hsl(var(--border))' }}
                whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
                placeholder="Search projects..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                No projects match "{search}"
              </div>
            ) : (
              filtered.map((group, gi) => (
                <div key={group.client}>
                  <div
                    className="px-2.5 pb-1 pt-2.5 font-brand text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
                    style={{ letterSpacing: '1.5px', opacity: 0.6 }}
                  >
                    {group.client}
                  </div>
                  {group.projects.map((project, pi) => {
                    const isSelected = currentProject === project.name;
                    return (
                      <motion.button
                        key={project.name}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                          isSelected
                            ? 'bg-primary/8 text-foreground'
                            : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                        }`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: gi * 0.05 + pi * 0.03, duration: 0.15 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelect(project, group.client)}
                      >
                        <motion.span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: project.color }}
                          animate={isSelected ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        />
                        <span className="flex-1 truncate">{project.name}</span>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                          >
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border p-1">
            <motion.button
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              whileTap={{ scale: 0.98 }}
              onClick={onClear}
            >
              <X className="h-3 w-3" />
              <span>No project</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// C1: Pill Pop — spring scale + green border glow
function ConfirmPillPop() {
  const [project, setProject] = useState({ name: 'Platform Core', color: 'hsl(var(--t-project-1))', client: 'Acme Corp' });
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleSelect = (p: { name: string; color: string }, client: string) => {
    setProject({ ...p, client });
    setOpen(false);
    setSearch('');
    setConfirming(true);
    setTimeout(() => setConfirming(false), 500);
  };

  return (
    <div className="rounded-lg border border-border">
      <div
        className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-2"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today — Friday, 14 Feb
        </span>
        <span className="font-brand text-xs font-semibold tabular-nums text-foreground">5:35:00</span>
      </div>
      <div className={`relative flex items-center gap-3 px-4 py-2.5 ${open ? 'z-20' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex h-5 items-center">
            <span className="truncate text-[13px] leading-5 text-foreground">
              PROJ-341 Fix pagination edge case on reports
            </span>
          </div>
          <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
            <motion.span
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5"
              style={{ fontSize: scaled(11), border: '1px solid transparent' }}
              animate={confirming ? {
                scale: [1, 1.1, 1],
                borderColor: [
                  'hsl(142 71% 45% / 0.8)',
                  'hsl(142 71% 45% / 0.4)',
                  'hsl(142 71% 45% / 0)',
                ],
                boxShadow: [
                  '0 0 8px hsl(142 71% 45% / 0.3)',
                  '0 0 4px hsl(142 71% 45% / 0.1)',
                  '0 0 0px hsl(142 71% 45% / 0)',
                ],
              } : {
                scale: 1,
                borderColor: 'hsl(var(--border) / 0)',
                boxShadow: '0 0 0px transparent',
              }}
              transition={confirming ? { duration: 0.45, ease: 'easeOut' } : { duration: 0 }}
              onClick={() => setOpen(!open)}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />
              <AnimatePresence mode="wait">
                <motion.span
                  key={project.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-muted-foreground"
                >
                  {project.client} · {project.name}
                </motion.span>
              </AnimatePresence>
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </motion.span>
            <ConfirmDropdown
              open={open}
              search={search}
              onSearchChange={setSearch}
              currentProject={project.name}
              onSelect={handleSelect}
              onClear={() => { setOpen(false); setSearch(''); }}
            />
          </div>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">09:15 – 11:45</span>
        <span className="font-brand text-sm font-semibold tabular-nums text-foreground">2:30:00</span>
      </div>
    </div>
  );
}

// C2: Check Flash — checkmark replaces dot, morphs back
function ConfirmCheckFlash() {
  const [project, setProject] = useState({ name: 'Platform Core', color: 'hsl(var(--t-project-1))', client: 'Acme Corp' });
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleSelect = (p: { name: string; color: string }, client: string) => {
    setProject({ ...p, client });
    setOpen(false);
    setSearch('');
    setConfirming(true);
    setTimeout(() => setConfirming(false), 700);
  };

  return (
    <div className="rounded-lg border border-border">
      <div
        className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-2"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today — Friday, 14 Feb
        </span>
        <span className="font-brand text-xs font-semibold tabular-nums text-foreground">5:35:00</span>
      </div>
      <div className={`relative flex items-center gap-3 px-4 py-2.5 ${open ? 'z-20' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex h-5 items-center">
            <span className="truncate text-[13px] leading-5 text-foreground">
              PROJ-341 Fix pagination edge case on reports
            </span>
          </div>
          <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
            <span
              className="flex cursor-pointer items-center gap-1.5 text-muted-foreground"
              style={{ fontSize: scaled(11) }}
              onClick={() => setOpen(!open)}
            >
              <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                <AnimatePresence mode="wait">
                  {confirming ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 90 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 300 }}
                      className="absolute flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style={{ background: 'hsl(142 71% 45%)' }}
                    >
                      <Check className="h-2 w-2 text-white" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="dot"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                      className="absolute h-2 w-2 rounded-full"
                      style={{ background: project.color }}
                    />
                  )}
                </AnimatePresence>
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={project.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {project.client} · {project.name}
                </motion.span>
              </AnimatePresence>
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </span>
            <ConfirmDropdown
              open={open}
              search={search}
              onSearchChange={setSearch}
              currentProject={project.name}
              onSelect={handleSelect}
              onClear={() => { setOpen(false); setSearch(''); }}
            />
          </div>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">09:15 – 11:45</span>
        <span className="font-brand text-sm font-semibold tabular-nums text-foreground">2:30:00</span>
      </div>
    </div>
  );
}

// C3: Color Sweep — green wash fills pill left→right, then fades
function ConfirmColorSweep() {
  const [project, setProject] = useState({ name: 'Platform Core', color: 'hsl(var(--t-project-1))', client: 'Acme Corp' });
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleSelect = (p: { name: string; color: string }, client: string) => {
    setProject({ ...p, client });
    setOpen(false);
    setSearch('');
    setConfirming(true);
    setTimeout(() => setConfirming(false), 600);
  };

  return (
    <div className="rounded-lg border border-border">
      <div
        className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-2"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today — Friday, 14 Feb
        </span>
        <span className="font-brand text-xs font-semibold tabular-nums text-foreground">5:35:00</span>
      </div>
      <div className={`relative flex items-center gap-3 px-4 py-2.5 ${open ? 'z-20' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex h-5 items-center">
            <span className="truncate text-[13px] leading-5 text-foreground">
              PROJ-341 Fix pagination edge case on reports
            </span>
          </div>
          <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
            <span
              className="relative flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-full px-2 py-0.5 text-muted-foreground"
              style={{ fontSize: scaled(11) }}
              onClick={() => setOpen(!open)}
            >
              {/* Sweep overlay */}
              <AnimatePresence>
                {confirming && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{ background: 'hsl(142 71% 45% / 0.15)' }}
                    initial={{ clipPath: 'inset(0 100% 0 0)' }}
                    animate={{ clipPath: 'inset(0 0% 0 0)' }}
                    exit={{ opacity: 0 }}
                    transition={{
                      clipPath: { duration: 0.25, ease: 'easeOut' },
                      opacity: { duration: 0.3, delay: 0.25 },
                    }}
                  />
                )}
              </AnimatePresence>
              <span className="relative h-2 w-2 rounded-full" style={{ background: project.color }} />
              <AnimatePresence mode="wait">
                <motion.span
                  key={project.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="relative"
                >
                  {project.client} · {project.name}
                </motion.span>
              </AnimatePresence>
              <ChevronDown className={`relative h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </span>
            <ConfirmDropdown
              open={open}
              search={search}
              onSearchChange={setSearch}
              currentProject={project.name}
              onSelect={handleSelect}
              onClear={() => { setOpen(false); setSearch(''); }}
            />
          </div>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">09:15 – 11:45</span>
        <span className="font-brand text-sm font-semibold tabular-nums text-foreground">2:30:00</span>
      </div>
    </div>
  );
}

// FinalInlineEditor — superseded by FinalSetDemo, kept for reference
export function FinalInlineEditor() {
  const [editing, setEditing] = useState<EditingField>(null);
  const [values, setValues] = useState<Record<string, MockEntry>>(
    () => Object.fromEntries(MOCK_ENTRIES.map((e) => [e.id, { ...e }])),
  );
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [pillPop, setPillPop] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');

  const handleSave = (entryId: string) => {
    setEditing(null);
    setSavedFlash(entryId);
    setTimeout(() => setSavedFlash(null), 600);
  };

  const handleCancel = () => { setEditing(null); setProjectSearch(''); };

  const handleSelectProject = (entryId: string, project: { name: string; color: string }, client: string) => {
    setValues((v) => ({
      ...v,
      [entryId]: { ...v[entryId]!, project: project.name, projectColor: project.color, client },
    }));
    setEditing(null);
    setProjectSearch('');
    // C1 Pill Pop instead of row flash
    setPillPop(entryId);
    setTimeout(() => setPillPop(null), 500);
  };

  return (
    <div className="rounded-lg border border-border">
      {/* Day header */}
      <div
        className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-2"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today — Friday, 14 Feb
        </span>
        <span className="font-brand text-xs font-semibold tabular-nums text-foreground">
          5:35:00
        </span>
      </div>

      {Object.values(values).map((entry) => {
        const isEditingDesc = editing?.entryId === entry.id && editing.field === 'description';
        const isEditingTime = editing?.entryId === entry.id && editing.field === 'time';
        const isEditingProject = editing?.entryId === entry.id && editing.field === 'project';
        const isEditing = isEditingDesc || isEditingTime || isEditingProject;
        const justSaved = savedFlash === entry.id;
        const isPillPop = pillPop === entry.id;
        const noDesc = !entry.description;

        return (
          <motion.div
            key={entry.id}
            className={`group/row relative flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 ${isEditingProject ? 'z-20' : ''}`}
            animate={{
              backgroundColor: isEditing
                ? 'hsl(var(--muted) / 0.15)'
                : 'transparent',
            }}
            transition={{ duration: 0.2 }}
          >
            {/* Breathing glow on editing row */}
            {isEditing && (
              <motion.div
                className="pointer-events-none absolute inset-0"
                animate={{
                  boxShadow: [
                    'inset 0 0 15px hsl(var(--primary) / 0.02)',
                    'inset 0 0 30px hsl(var(--primary) / 0.06)',
                    'inset 0 0 15px hsl(var(--primary) / 0.02)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* Save flash (for desc/time saves) */}
            <AnimatePresence>
              {justSaved && (
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  initial={{ backgroundColor: 'hsl(var(--primary) / 0.08)' }}
                  animate={{ backgroundColor: 'hsl(var(--primary) / 0)' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              )}
            </AnimatePresence>

            {/* Description + project */}
            <div className="relative z-10 flex-1 min-w-0">
              {/* Description — fixed height container */}
              <div className="flex h-5 items-center">
                <AnimatePresence mode="wait">
                  {isEditingDesc ? (
                    <motion.div
                      key="editing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex w-full items-center gap-2"
                    >
                      <motion.input
                        className="flex-1 rounded-md bg-muted/40 px-2 text-[13px] leading-5 text-foreground outline-none"
                        style={{
                          height: '20px',
                          border: '1px solid hsl(var(--primary) / 0.4)',
                        }}
                        animate={{
                          borderColor: [
                            'hsl(var(--primary) / 0.3)',
                            'hsl(var(--primary) / 0.6)',
                            'hsl(var(--primary) / 0.3)',
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        value={entry.description}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [entry.id]: { ...v[entry.id]!, description: e.target.value },
                          }))
                        }
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(entry.id);
                          if (e.key === 'Escape') handleCancel();
                        }}
                      />
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleSave(entry.id)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Check className="h-2.5 w-2.5" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={handleCancel}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-2.5 w-2.5" />
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="display"
                      initial={false}
                      className={`cursor-pointer truncate text-[13px] leading-5 ${noDesc ? 'italic text-muted-foreground' : 'text-foreground'} hover:text-primary`}
                      onClick={() => setEditing({ entryId: entry.id, field: 'description' })}
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                    >
                      {entry.description || 'No description'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Project line — fixed height, dropdown escapes */}
              <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
                {isEditingProject ? (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-1.5"
                    >
                      <motion.div
                        className="flex h-[18px] cursor-pointer items-center gap-1.5 rounded-full bg-muted/40 px-2.5"
                        style={{ border: '1px solid hsl(var(--primary) / 0.4)', fontSize: scaled(11) }}
                        animate={{
                          borderColor: [
                            'hsl(var(--primary) / 0.3)',
                            'hsl(var(--primary) / 0.6)',
                            'hsl(var(--primary) / 0.3)',
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: entry.projectColor || 'hsl(var(--muted-foreground))' }}
                        />
                        <span className="text-foreground">{entry.project || 'Select project'}</span>
                        <ChevronDown className="h-3 w-3 rotate-180 text-muted-foreground" />
                      </motion.div>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => { setEditing(null); setProjectSearch(''); }}
                        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-2.5 w-2.5" />
                      </motion.button>
                    </motion.div>

                    {/* P1-style Dropdown */}
                    <ConfirmDropdown
                      open={true}
                      search={projectSearch}
                      onSearchChange={setProjectSearch}
                      currentProject={entry.project}
                      onSelect={(project, client) => handleSelectProject(entry.id, project, client)}
                      onClear={() => {
                        setValues((v) => ({
                          ...v,
                          [entry.id]: { ...v[entry.id]!, project: '', projectColor: '', client: '' },
                        }));
                        setEditing(null);
                        setProjectSearch('');
                        setPillPop(entry.id);
                        setTimeout(() => setPillPop(null), 500);
                      }}
                    />
                  </>
                ) : entry.project ? (
                  /* C1 Pill Pop on the project display */
                  <motion.span
                    className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground hover:text-primary"
                    style={{ fontSize: scaled(11), border: '1px solid transparent' }}
                    animate={isPillPop ? {
                      scale: [1, 1.1, 1],
                      borderColor: [
                        'hsl(142 71% 45% / 0.8)',
                        'hsl(142 71% 45% / 0.4)',
                        'hsl(142 71% 45% / 0)',
                      ],
                      boxShadow: [
                        '0 0 8px hsl(142 71% 45% / 0.3)',
                        '0 0 4px hsl(142 71% 45% / 0.1)',
                        '0 0 0px hsl(142 71% 45% / 0)',
                      ],
                    } : {
                      scale: 1,
                      borderColor: 'hsl(var(--border) / 0)',
                      boxShadow: '0 0 0px transparent',
                    }}
                    transition={isPillPop ? { duration: 0.45, ease: 'easeOut' } : { duration: 0 }}
                    onClick={() => setEditing({ entryId: entry.id, field: 'project' })}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: entry.projectColor }}
                    />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={entry.project}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                      >
                        {entry.client} · {entry.project}
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                ) : (
                  <span
                    className="flex cursor-pointer items-center gap-1 text-amber-500/70 hover:text-amber-400"
                    style={{ fontSize: scaled(11) }}
                    onClick={() => setEditing({ entryId: entry.id, field: 'project' })}
                  >
                    + Add project
                  </span>
                )}
              </div>
            </div>

            {/* Time range — fixed height */}
            <div className="relative z-10 flex h-5 items-center gap-1 text-right shrink-0">
              {isEditingTime ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1"
                >
                  <motion.input
                    className="h-5 w-[48px] rounded-md bg-muted/40 px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
                    style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
                    animate={{
                      borderColor: [
                        'hsl(var(--primary) / 0.3)',
                        'hsl(var(--primary) / 0.6)',
                        'hsl(var(--primary) / 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    value={entry.startTime}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [entry.id]: { ...v[entry.id]!, startTime: e.target.value },
                      }))
                    }
                    autoFocus
                  />
                  <span className="text-[11px] text-muted-foreground">–</span>
                  <motion.input
                    className="h-5 w-[48px] rounded-md bg-muted/40 px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
                    style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
                    animate={{
                      borderColor: [
                        'hsl(var(--primary) / 0.3)',
                        'hsl(var(--primary) / 0.6)',
                        'hsl(var(--primary) / 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    value={entry.endTime}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [entry.id]: { ...v[entry.id]!, endTime: e.target.value },
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(entry.id);
                      if (e.key === 'Escape') handleCancel();
                    }}
                  />
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleSave(entry.id)}
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="h-2.5 w-2.5" />
                  </motion.button>
                </motion.div>
              ) : (
                <span
                  className="cursor-pointer text-[11px] tabular-nums text-muted-foreground hover:text-primary"
                  onClick={() => setEditing({ entryId: entry.id, field: 'time' })}
                >
                  {entry.startTime} – {entry.endTime}
                </span>
              )}
            </div>

            {/* Duration */}
            <span className="relative z-10 font-brand text-sm font-semibold tabular-nums text-foreground shrink-0">
              {entry.duration}
            </span>

            {/* Play on hover — continue this task */}
            <motion.button
              className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100"
              whileHover={{
                color: 'hsl(var(--primary))',
                backgroundColor: 'hsl(var(--primary) / 0.1)',
              }}
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.15 }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================================
// Final Set Demo — wired timer bar + entry rows
// ============================================================
function FinalSetDemo() {
  const { running, digits, start, stop } = useFakeTimer();
  const [runningEntryId, setRunningEntryId] = useState<string | null>(null);
  const [timerDesc, setTimerDesc] = useState('');
  const [timerProject, setTimerProject] = useState('');
  const [timerProjectColor, setTimerProjectColor] = useState('');

  const [editing, setEditing] = useState<EditingField>(null);
  const [values, setValues] = useState<Record<string, MockEntry>>(
    () => Object.fromEntries(MOCK_ENTRIES.map((e) => [e.id, { ...e }])),
  );
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [pillPop, setPillPop] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');

  const handlePlay = (entryId: string) => {
    const entry = values[entryId];
    if (!entry) return;
    setRunningEntryId(entryId);
    setTimerDesc(entry.description || 'No description');
    setTimerProject(entry.project);
    setTimerProjectColor(entry.projectColor);
    start();
  };

  const handleStop = () => {
    stop();
    setRunningEntryId(null);
    setTimerDesc('');
    setTimerProject('');
    setTimerProjectColor('');
  };

  const handleTimerStart = () => {
    setRunningEntryId(null);
    start();
  };

  const handleSave = (entryId: string) => {
    setEditing(null);
    setSavedFlash(entryId);
    setTimeout(() => setSavedFlash(null), 600);
  };

  const handleCancel = () => { setEditing(null); setProjectSearch(''); };

  const handleSelectProject = (entryId: string, project: { name: string; color: string }, client: string) => {
    setValues((v) => ({
      ...v,
      [entryId]: { ...v[entryId]!, project: project.name, projectColor: project.color, client },
    }));
    setEditing(null);
    setProjectSearch('');
    setPillPop(entryId);
    setTimeout(() => setPillPop(null), 500);
    // Update timer bar if this is the running entry
    if (runningEntryId === entryId) {
      setTimerProject(project.name);
      setTimerProjectColor(project.color);
    }
  };

  return (
    <div>
      {/* ---- Timer Bar (Liquid Edge) ---- */}
      <motion.div
        className="relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
        animate={{
          borderColor: running
            ? 'hsl(var(--primary) / 0.3)'
            : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.3 }}
      >
        {running && (
          <>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-lg">
              <div
                className="absolute h-full"
                style={{
                  width: '35%',
                  background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.7) 0%, hsl(var(--primary) / 0.3) 40%, transparent 70%)',
                  filter: 'blur(1px)',
                  animation: 'liquid-drift 5s ease-in-out infinite alternate',
                }}
              />
              <div
                className="absolute h-full"
                style={{
                  width: '20%',
                  background: 'radial-gradient(ellipse at center, hsl(var(--chart-3) / 0.5) 0%, hsl(var(--chart-3) / 0.2) 40%, transparent 70%)',
                  filter: 'blur(1px)',
                  animation: 'liquid-drift-2 7s ease-in-out infinite alternate',
                }}
              />
            </div>
            <motion.div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-lg"
              style={{
                background: 'linear-gradient(to top, hsl(var(--primary) / 0.03), transparent)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            />
          </>
        )}

        <input
          className="relative z-10 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          style={{ fontSize: scaled(13) }}
          placeholder="What are you working on?"
          value={running ? timerDesc : ''}
          onChange={(e) => setTimerDesc(e.target.value)}
          readOnly={!running}
        />

        {running && timerProject && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10 flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
            style={{ fontSize: scaled(11) }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: timerProjectColor || 'hsl(var(--muted-foreground))' }}
            />
            <span className="text-muted-foreground">{timerProject}</span>
          </motion.div>
        )}

        <div className="relative z-10 font-brand text-xl font-semibold tracking-wider text-primary tabular-nums">
          {running ? (
            <span className="inline-flex">
              {digits.map((d, i) => (
                <AnimatedDigit key={i} char={d} />
              ))}
            </span>
          ) : (
            <span style={{ opacity: 0.4 }}>0:00:00</span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {running ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleStop}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="start"
              initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleTimerStart}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ---- Entry Rows ---- */}
      <div className="mt-6 rounded-lg border border-border">
        {/* Day header */}
        <div
          className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-2"
          style={{ background: 'hsl(var(--muted) / 0.3)' }}
        >
          <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today — Friday, 14 Feb
          </span>
          <span className="font-brand text-xs font-semibold tabular-nums text-foreground">
            5:35:00
          </span>
        </div>

        {Object.values(values).map((entry) => {
          const isEditingDesc = editing?.entryId === entry.id && editing.field === 'description';
          const isEditingTime = editing?.entryId === entry.id && editing.field === 'time';
          const isEditingProject = editing?.entryId === entry.id && editing.field === 'project';
          const isEditing = isEditingDesc || isEditingTime || isEditingProject;
          const justSaved = savedFlash === entry.id;
          const isPillPop = pillPop === entry.id;
          const noDesc = !entry.description;
          const isRunning = runningEntryId === entry.id && running;

          return (
            <motion.div
              key={entry.id}
              className={`group/row relative flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 ${isEditingProject ? 'z-20' : ''}`}
              animate={{
                backgroundColor: isRunning
                  ? 'hsl(var(--primary) / 0.06)'
                  : isEditing
                    ? 'hsl(var(--muted) / 0.15)'
                    : 'transparent',
              }}
              transition={{ duration: 0.2 }}
            >
              {/* Running indicator — teal left border */}
              <AnimatePresence>
                {isRunning && (
                  <motion.div
                    className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
                    style={{ background: 'hsl(var(--primary))' }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    exit={{ scaleY: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                  />
                )}
              </AnimatePresence>

              {/* Breathing glow on editing row */}
              {isEditing && (
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  animate={{
                    boxShadow: [
                      'inset 0 0 15px hsl(var(--primary) / 0.02)',
                      'inset 0 0 30px hsl(var(--primary) / 0.06)',
                      'inset 0 0 15px hsl(var(--primary) / 0.02)',
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Save flash */}
              <AnimatePresence>
                {justSaved && (
                  <motion.div
                    className="pointer-events-none absolute inset-0"
                    initial={{ backgroundColor: 'hsl(var(--primary) / 0.08)' }}
                    animate={{ backgroundColor: 'hsl(var(--primary) / 0)' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                )}
              </AnimatePresence>

              {/* Description + project */}
              <div className="relative z-10 flex-1 min-w-0">
                {/* Description */}
                <div className="flex h-5 items-center">
                  <AnimatePresence mode="wait">
                    {isEditingDesc ? (
                      <motion.div
                        key="editing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex w-full items-center gap-2"
                      >
                        <motion.input
                          className="flex-1 rounded-md bg-muted/40 px-2 text-[13px] leading-5 text-foreground outline-none"
                          style={{ height: '20px', border: '1px solid hsl(var(--primary) / 0.4)' }}
                          animate={{
                            borderColor: [
                              'hsl(var(--primary) / 0.3)',
                              'hsl(var(--primary) / 0.6)',
                              'hsl(var(--primary) / 0.3)',
                            ],
                          }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          value={entry.description}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [entry.id]: { ...v[entry.id]!, description: e.target.value },
                            }))
                          }
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(entry.id);
                            if (e.key === 'Escape') handleCancel();
                          }}
                        />
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => handleSave(entry.id)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        >
                          <Check className="h-2.5 w-2.5" />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={handleCancel}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-2.5 w-2.5" />
                        </motion.button>
                      </motion.div>
                    ) : (
                      <motion.span
                        key="display"
                        initial={false}
                        className={`cursor-pointer truncate text-[13px] leading-5 ${noDesc ? 'italic text-muted-foreground' : isRunning ? 'text-primary' : 'text-foreground'} hover:text-primary`}
                        onClick={() => setEditing({ entryId: entry.id, field: 'description' })}
                        whileHover={{ x: 2 }}
                        transition={{ duration: 0.1 }}
                      >
                        {entry.description || 'No description'}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Project line */}
                <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
                  {isEditingProject ? (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5"
                      >
                        <motion.div
                          className="flex h-[18px] cursor-pointer items-center gap-1.5 rounded-full bg-muted/40 px-2.5"
                          style={{ border: '1px solid hsl(var(--primary) / 0.4)', fontSize: scaled(11) }}
                          animate={{
                            borderColor: [
                              'hsl(var(--primary) / 0.3)',
                              'hsl(var(--primary) / 0.6)',
                              'hsl(var(--primary) / 0.3)',
                            ],
                          }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: entry.projectColor || 'hsl(var(--muted-foreground))' }}
                          />
                          <span className="text-foreground">{entry.project || 'Select project'}</span>
                          <ChevronDown className="h-3 w-3 rotate-180 text-muted-foreground" />
                        </motion.div>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => { setEditing(null); setProjectSearch(''); }}
                          className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-2.5 w-2.5" />
                        </motion.button>
                      </motion.div>

                      <ConfirmDropdown
                        open={true}
                        search={projectSearch}
                        onSearchChange={setProjectSearch}
                        currentProject={entry.project}
                        onSelect={(project, client) => handleSelectProject(entry.id, project, client)}
                        onClear={() => {
                          setValues((v) => ({
                            ...v,
                            [entry.id]: { ...v[entry.id]!, project: '', projectColor: '', client: '' },
                          }));
                          setEditing(null);
                          setProjectSearch('');
                          setPillPop(entry.id);
                          setTimeout(() => setPillPop(null), 500);
                        }}
                      />
                    </>
                  ) : entry.project ? (
                    <motion.span
                      className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground hover:text-primary"
                      style={{ fontSize: scaled(11), border: '1px solid transparent' }}
                      animate={isPillPop ? {
                        scale: [1, 1.1, 1],
                        borderColor: [
                          'hsl(142 71% 45% / 0.8)',
                          'hsl(142 71% 45% / 0.4)',
                          'hsl(142 71% 45% / 0)',
                        ],
                        boxShadow: [
                          '0 0 8px hsl(142 71% 45% / 0.3)',
                          '0 0 4px hsl(142 71% 45% / 0.1)',
                          '0 0 0px hsl(142 71% 45% / 0)',
                        ],
                      } : {
                        scale: 1,
                        borderColor: 'hsl(var(--border) / 0)',
                        boxShadow: '0 0 0px transparent',
                      }}
                      transition={isPillPop ? { duration: 0.45, ease: 'easeOut' } : { duration: 0 }}
                      onClick={() => setEditing({ entryId: entry.id, field: 'project' })}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: entry.projectColor }}
                      />
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={entry.project}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                        >
                          {entry.client} · {entry.project}
                        </motion.span>
                      </AnimatePresence>
                    </motion.span>
                  ) : (
                    <span
                      className="flex cursor-pointer items-center gap-1 text-amber-500/70 hover:text-amber-400"
                      style={{ fontSize: scaled(11) }}
                      onClick={() => setEditing({ entryId: entry.id, field: 'project' })}
                    >
                      + Add project
                    </span>
                  )}
                </div>
              </div>

              {/* Time range */}
              <div className="relative z-10 flex h-5 items-center gap-1 text-right shrink-0">
                {isEditingTime ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1"
                  >
                    <motion.input
                      className="h-5 w-[48px] rounded-md bg-muted/40 px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
                      style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
                      animate={{
                        borderColor: [
                          'hsl(var(--primary) / 0.3)',
                          'hsl(var(--primary) / 0.6)',
                          'hsl(var(--primary) / 0.3)',
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      value={entry.startTime}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [entry.id]: { ...v[entry.id]!, startTime: e.target.value },
                        }))
                      }
                      autoFocus
                    />
                    <span className="text-[11px] text-muted-foreground">–</span>
                    <motion.input
                      className="h-5 w-[48px] rounded-md bg-muted/40 px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
                      style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
                      animate={{
                        borderColor: [
                          'hsl(var(--primary) / 0.3)',
                          'hsl(var(--primary) / 0.6)',
                          'hsl(var(--primary) / 0.3)',
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      value={entry.endTime}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [entry.id]: { ...v[entry.id]!, endTime: e.target.value },
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave(entry.id);
                        if (e.key === 'Escape') handleCancel();
                      }}
                    />
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleSave(entry.id)}
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check className="h-2.5 w-2.5" />
                    </motion.button>
                  </motion.div>
                ) : (
                  <span
                    className={`cursor-pointer text-[11px] tabular-nums ${isRunning ? 'text-primary/70' : 'text-muted-foreground'} hover:text-primary`}
                    onClick={() => setEditing({ entryId: entry.id, field: 'time' })}
                  >
                    {isRunning ? `${entry.startTime} – now` : `${entry.startTime} – ${entry.endTime}`}
                  </span>
                )}
              </div>

              {/* Duration */}
              <span className={`relative z-10 font-brand text-sm font-semibold tabular-nums shrink-0 ${isRunning ? 'text-primary' : 'text-foreground'}`}>
                {entry.duration}
              </span>

              {/* Play/Stop button */}
              {isRunning ? (
                <motion.button
                  className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}
                  whileHover={{ backgroundColor: 'hsl(var(--destructive) / 0.2)' }}
                  whileTap={{ scale: 0.85 }}
                  onClick={handleStop}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                >
                  <Square className="h-3 w-3 fill-current" />
                </motion.button>
              ) : (
                <motion.button
                  className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100"
                  whileHover={{
                    color: 'hsl(var(--primary))',
                    backgroundColor: 'hsl(var(--primary) / 0.1)',
                  }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handlePlay(entry.id)}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </motion.button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Flair Label
// ============================================================
function FlairLabel({ id, title, desc }: { id: string; title: string; desc: string }) {
  return (
    <div className="mb-4 mt-10 first:mt-0">
      <div className="flex items-baseline gap-3">
        <span
          className="font-brand text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          style={{ letterSpacing: '3px' }}
        >
          {id}
        </span>
        <span className="font-brand text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

// ============================================================
// Page
// ============================================================
function FlairPageContent() {
  const [activeScale, setActiveScale] = useState(1.1);

  const handleScaleChange = (scale: number) => {
    setActiveScale(scale);
    document.documentElement.style.setProperty('--t-scale', String(scale));
  };

  const zoom = activeScale / 1.1;

  return (
    <div className="min-h-screen bg-background">
      <DevToolbar activeScale={activeScale} onScaleChange={handleScaleChange} />

      <div className="mx-auto max-w-3xl px-6 py-8 pb-32" style={{ zoom }}>
        <h1 className="font-brand mb-1 text-2xl font-bold tracking-wider text-foreground">
          Timer Bar — Flair Exploration
        </h1>
        <p className="mb-2 text-sm text-muted-foreground">
          Three levels of visual treatment. Click play to see each one live.
        </p>
        <p className="mb-8 text-xs text-muted-foreground/60">
          All bars start at 1:42:08 and count up. Try starting and stopping each one.
        </p>

        <FlairLabel
          id="F1"
          title="Clean"
          desc="Current design + smooth transitions. Numbers interpolate fluidly. Button springs in/out. Border animates between states."
        />
        <TimerBarClean />

        <FlairLabel
          id="F2"
          title="Alive"
          desc="Individual digit animations (each number flips independently). Subtle breathing glow when running. Button rotates on transition. Tap feedback."
        />
        <TimerBarAlive />

        <FlairLabel
          id="F3"
          title="Electric"
          desc="Animated gradient border that rotates. Moving shimmer across the bar. Glowing digits with pulsing text-shadow. Stop button has expanding pulse ring. Start button glows on hover."
        />
        <TimerBarElectric />

        <div className="mt-12 mb-8 border-t border-border pt-4">
          <h2 className="font-brand text-lg font-semibold text-foreground">
            F3 Alternatives
          </h2>
          <p className="text-xs text-muted-foreground">
            Same boldness as F3 but each focused on a single dominant effect instead of layering multiple.
          </p>
        </div>

        <FlairLabel
          id="F3a"
          title="Ember Glow"
          desc="One slow aurora color wash across the bar (~8s cycle). Digits shift color in sync. Nothing else moves. Bold through color intensity, calm through pace."
        />
        <TimerBarEmberGlow />

        <FlairLabel
          id="F3b"
          title="Heartbeat"
          desc="Clean most of the time. Every ~3 seconds a sonar ping radiates inward — brief flash, then quiet. Digits and border pulse in sync. Contrast between stillness and burst."
        />
        <TimerBarHeartbeat />

        <FlairLabel
          id="F3c"
          title="Liquid Edge"
          desc="Two fluid blobs of light drift along the bottom edge — teal and accent, different speeds. Subtle upward glow reflection. One edge, focused presence. Rest of bar stays clean."
        />
        <TimerBarLiquidEdge />

        {/* ============================================================
            INLINE EDITOR SECTION
            ============================================================ */}
        <div className="mt-16 mb-8 border-t border-border pt-6">
          <h1 className="font-brand mb-1 text-2xl font-bold tracking-wider text-foreground">
            Inline Editor — Flair Exploration
          </h1>
          <p className="mb-2 text-sm text-muted-foreground">
            Click any field (description, time, project) to edit in place. Try saving (Enter/check) and cancelling (Esc/X).
          </p>
          <p className="mb-8 text-xs text-muted-foreground/60">
            3 entry rows with different states: full entry, no-project entry, empty entry. One field editable at a time.
          </p>
        </div>

        <FlairLabel
          id="E2"
          title="Alive"
          desc="Breathing glow on editing row. Border pulses on active input. Smooth morph between display and edit states. Green flash on save. Spring animations on buttons."
        />
        <InlineEditorAlive />

        <FlairLabel
          id="E3c"
          title="Liquid Edge"
          desc="Liquid underline drifts beneath the active field — same language as the timer bar. No borders, no background change. On save, a liquid ripple shoots across the row bottom edge."
        />
        <InlineEditorLiquidEdge />

        <FlairLabel
          id="P1"
          title="Project Picker (E2 Alive)"
          desc="Click the project name to open. Spring-animated dropdown with staggered items. Search with focus glow. Selected item has checkmark + dot pulse. Breathing glow on parent row. Green flash on selection."
        />
        <ProjectPickerDemo />

        {/* ============================================================
            PROJECT CONFIRM ANIMATIONS
            ============================================================ */}
        <div className="mt-16 mb-8 border-t border-border pt-6">
          <h1 className="font-brand mb-1 text-2xl font-bold tracking-wider text-foreground">
            Project Change Confirm
          </h1>
          <p className="mb-2 text-sm text-muted-foreground">
            Click the project name to cycle through projects. Each version shows a different confirmation animation.
          </p>
        </div>

        <FlairLabel
          id="C1"
          title="Pill Pop"
          desc="Spring scale (1 → 1.1 → 1) with green border glow that fades. Tactile, focused on the pill."
        />
        <ConfirmPillPop />

        <FlairLabel
          id="C2"
          title="Check Flash"
          desc="Green checkmark circle replaces the color dot, springs in, then morphs back to the dot after 700ms."
        />
        <ConfirmCheckFlash />

        <FlairLabel
          id="C3"
          title="Color Sweep"
          desc="Green wash fills the pill left-to-right, then fades out. Like a brief progress confirmation."
        />
        <ConfirmColorSweep />

        {/* ============================================================
            FINAL SET
            ============================================================ */}
        <div className="mt-16 mb-8 border-t-2 border-primary/30 pt-6">
          <h1 className="font-brand mb-1 text-2xl font-bold tracking-wider text-primary">
            Final Set
          </h1>
          <p className="mb-2 text-sm text-muted-foreground">
            F3c Liquid Edge timer + E2 Alive editing + P1 project picker + C1 Pill Pop confirmation.
          </p>
          <p className="mb-8 text-xs text-muted-foreground/60">
            This is how the Timer & Entries page will feel. Start the timer. Edit any field. Change a project and watch the pill pop.
          </p>
        </div>

        <FinalSetDemo />
      </div>
    </div>
  );
}

export function DevFlairPage() {
  if (!import.meta.env.DEV) return null;

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FlairPageContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
