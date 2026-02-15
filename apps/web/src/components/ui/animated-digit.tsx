import { motion, AnimatePresence } from 'motion/react';

/**
 * AnimatedDigit — per-character flip animation for timer displays.
 * Each digit slides in from below and exits upward with a subtle blur.
 * Used in timer bar and anywhere elapsed time needs visual life.
 */
export function AnimatedDigit({ char, className }: { char: string; className?: string }) {
  return (
    <span
      className={`inline-block overflow-hidden ${className ?? ''}`}
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
