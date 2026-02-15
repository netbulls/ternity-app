import { motion } from 'motion/react';

/**
 * BreathingGlow — subtle inner glow that pulses on editing rows.
 * Overlays as a pointer-events-none absolute div.
 * Parent must be `position: relative`.
 */
export function BreathingGlow() {
  return (
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
  );
}

/**
 * BreathingBorder — input border that pulses between dim and bright primary.
 * Use as the `animate` prop on a motion.input or motion.div with a border.
 */
export const breathingBorderAnimation = {
  borderColor: [
    'hsl(var(--primary) / 0.3)',
    'hsl(var(--primary) / 0.6)',
    'hsl(var(--primary) / 0.3)',
  ],
};

export const breathingBorderTransition = {
  duration: 2,
  repeat: Infinity,
  ease: 'easeInOut' as const,
};

/**
 * SaveFlash — green flash overlay after saving an edit.
 * Wrap in AnimatePresence, render conditionally.
 */
export function SaveFlash() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={{ backgroundColor: 'hsl(var(--primary) / 0.08)' }}
      animate={{ backgroundColor: 'hsl(var(--primary) / 0)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    />
  );
}
