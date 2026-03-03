import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type PresenceStatus = 'available' | 'working-off-hours' | 'idle' | 'off-schedule';

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

export function useTeamBoard() {
  return useQuery({
    queryKey: ['team-board'],
    queryFn: () => apiFetch<TeamBoardMember[]>('/team/board'),
    refetchInterval: 30_000, // Poll every 30s until SSE is built
  });
}
