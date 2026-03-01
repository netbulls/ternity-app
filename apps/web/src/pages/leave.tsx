import { scaled } from '@/lib/scaled';

export function LeavePage() {
  return (
    <div>
      <h1
        className="font-brand font-semibold tracking-wide text-foreground"
        style={{ fontSize: scaled(18) }}
      >
        Leave
      </h1>
      <p className="mt-4 text-muted-foreground" style={{ fontSize: scaled(13) }}>
        Coming in Phase 3.
      </p>
    </div>
  );
}
