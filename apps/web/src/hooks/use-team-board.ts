import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type PresenceStatus = 'active' | 'overtime' | 'idle' | 'off';

export interface TeamBoardEntry {
  id: string;
  projectName: string;
  projectColor: string;
  description: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number;
}

export interface TeamBoardMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  status: PresenceStatus;
  schedule: { start: string; end: string } | null;
  runningEntry: {
    projectName: string;
    projectColor: string;
    description: string;
    startedAt: string;
  } | null;
  entries: TeamBoardEntry[];
}

// ── Hook ───────────────────────────────────────────────────────────────────

/** Format date as YYYY-MM-DD */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function useTeamBoard(date?: Date) {
  const dateStr = date ? toDateString(date) : undefined;
  const today = !date || isToday(date);

  return useQuery({
    queryKey: dateStr ? ['team-board', dateStr] : ['team-board'],
    queryFn: () =>
      apiFetch<TeamBoardMember[]>(dateStr ? `/team/board?date=${dateStr}` : '/team/board'),
    refetchInterval: today ? 30_000 : false, // Only poll for today
  });
}
