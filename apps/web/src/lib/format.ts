/** Format seconds as "Xh Ym" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** Format seconds as "HH:MM:SS" */
export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
}

/** Format ISO timestamp as "HH:MM" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Format date range as readable label */
export function formatDateRange(from: string, to: string): string {
  const fromDate = new Date(from + 'T12:00:00');
  const toDate = new Date(to + 'T12:00:00');

  if (from === to) {
    return formatDateLabel(from);
  }

  const fromStr = fromDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const toStr = toDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fromStr} – ${toStr}`;
}

/** Get Monday of the week containing the given date (ISO week) */
export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get Sunday of the week containing the given date */
export function getWeekEnd(dateStr: string): string {
  const mon = getWeekStart(dateStr);
  const d = new Date(mon + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Shift a date string by N days */
export function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Format ISO timestamp as relative time (e.g. "3 hours ago", "5 days ago") */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format a number with locale separators */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format date as relative label or formatted date */
export function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
