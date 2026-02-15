/**
 * C1 Pill Pop — spring scale + green border glow on project change confirmation.
 * Use these as the `animate` and `transition` props on a motion.span wrapping
 * the project pill display.
 *
 * Usage:
 *   <motion.span
 *     animate={isPillPop ? pillPopActiveAnimation : pillPopIdleAnimation}
 *     transition={isPillPop ? pillPopActiveTransition : pillPopIdleTransition}
 *   >
 *     {projectName}
 *   </motion.span>
 */

export const pillPopActiveAnimation = {
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
};

export const pillPopIdleAnimation = {
  scale: 1,
  borderColor: 'hsl(var(--border) / 0)',
  boxShadow: '0 0 0px transparent',
};

export const pillPopActiveTransition = {
  duration: 0.45,
  ease: 'easeOut' as const,
};

export const pillPopIdleTransition = {
  duration: 0,
};
