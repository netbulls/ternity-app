import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useImpersonation } from '@/providers/impersonation-provider';
import type { TimerState, StartTimer } from '@ternity/shared';

export function useTimer() {
  const { effectiveUserId } = useImpersonation();

  return useQuery({
    queryKey: ['timer', effectiveUserId],
    queryFn: () => apiFetch<TimerState>('/timer'),
    refetchInterval: false, // no polling — we tick locally
  });
}

export function useElapsedSeconds(startedAt: string | null | undefined, running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!running || !startedAt) {
      setElapsed(0);
      return;
    }

    const calcElapsed = () => {
      const start = new Date(startedAt).getTime();
      return Math.max(0, Math.round((Date.now() - start) / 1000));
    };

    setElapsed(calcElapsed());
    intervalRef.current = setInterval(() => setElapsed(calcElapsed()), 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt, running]);

  return elapsed;
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useImpersonation();

  return useMutation({
    mutationFn: (data: StartTimer) =>
      apiFetch<TimerState>('/timer/start', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useResumeTimer() {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useImpersonation();

  return useMutation({
    mutationFn: (entryId: string) =>
      apiFetch<TimerState>(`/timer/resume/${entryId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useImpersonation();

  return useMutation({
    mutationFn: () =>
      apiFetch<TimerState>('/timer/stop', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
