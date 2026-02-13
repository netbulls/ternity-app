export function HourglassLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" fill="none" className={className}>
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
