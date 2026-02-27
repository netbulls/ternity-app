/** Jira logo SVG — reusable across timer bar, entry rows, dropdowns */
export function JiraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.34 4.34h1.8v1.72a4.362 4.362 0 004.34 4.34V7.63a.84.84 0 00-.84-.84H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.35h1.78v1.72c.01 2.39 1.95 4.33 4.34 4.34v-9.57a.84.84 0 00-.84-.84H2z" />
    </svg>
  );
}
