import { scaled } from '@/lib/scaled';

export function CalendarPage() {
  return (
    <div>
      <h1
        className="font-brand font-semibold tracking-wide text-foreground"
        style={{ fontSize: scaled(18) }}
      >
        Calendar
      </h1>
      <p className="mt-4 text-muted-foreground" style={{ fontSize: scaled(13) }}>
        Coming in Phase 4.
      </p>
    </div>
  );
}
