import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
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

export function useElapsedSeconds(
  startedAt: string | null | undefined,
  running: boolean,
  offset: number = 0,
) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!running || !startedAt) {
      setElapsed(offset);
      return;
    }

    const calcElapsed = () => {
      const start = new Date(startedAt).getTime();
      return offset + Math.max(0, Math.round((Date.now() - start) / 1000));
    };

    setElapsed(calcElapsed());
    intervalRef.current = setInterval(() => setElapsed(calcElapsed()), 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt, running, offset]);

  return elapsed;
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useImpersonation();

  const mutation = useMutation({
    mutationFn: (data: StartTimer) =>
      apiFetch<TimerState>('/timer/start', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (_error, variables) => {
      toast.error('Failed to start timer', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useResumeTimer() {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useImpersonation();

  const mutation = useMutation({
    mutationFn: (entryId: string) =>
      apiFetch<TimerState>(`/timer/resume/${entryId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (_error, variables) => {
      toast.error('Failed to resume timer', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useStartOrResumeTimer() {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useImpersonation();

  const mutation = useMutation({
    mutationFn: (data: StartTimer) =>
      apiFetch<TimerState>('/timer/start-or-resume', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (_error, variables) => {
      toast.error('Failed to start timer', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useImpersonation();

  const mutation = useMutation({
    mutationFn: () => apiFetch<TimerState>('/timer/stop', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: () => {
      toast.error('Failed to stop timer', {
        action: { label: 'Retry', onClick: () => mutation.mutate() },
      });
    },
  });
  return mutation;
}
