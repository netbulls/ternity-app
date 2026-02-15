import { motion } from 'motion/react';

/**
 * LiquidEdge — two fluid blobs of light that drift along the bottom edge.
 * Teal primary + accent color at different speeds.
 * Used on the timer bar when running. One focused effect, rest stays clean.
 */
export function LiquidEdge() {
  return (
    <>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-lg">
        <div
          className="absolute h-full"
          style={{
            width: '35%',
            background:
              'radial-gradient(ellipse at center, hsl(var(--primary) / 0.7) 0%, hsl(var(--primary) / 0.3) 40%, transparent 70%)',
            filter: 'blur(1px)',
            animation: 'liquid-drift 5s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute h-full"
          style={{
            width: '20%',
            background:
              'radial-gradient(ellipse at center, hsl(var(--chart-3) / 0.5) 0%, hsl(var(--chart-3) / 0.2) 40%, transparent 70%)',
            filter: 'blur(1px)',
            animation: 'liquid-drift-2 7s ease-in-out infinite alternate',
          }}
        />
      </div>
      {/* Subtle glow reflection upward */}
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
  );
}

/**
 * CSS keyframes for the liquid drift animations.
 * Include this once in the component tree (e.g. in the timer bar).
 */
export function LiquidEdgeKeyframes() {
  return (
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
  );
}
