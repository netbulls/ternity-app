import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useImpersonation } from '@/providers/impersonation-provider';
import type {
  DayGroup,
  Entry,
  EntrySearchHit,
  CreateEntry,
  UpdateEntry,
  AdjustEntry,
  MoveBlock,
  AuditEvent,
  TimerState,
} from '@ternity/shared';

/* ── Shared optimistic cache patch ──────────────────────────────── */

/**
 * Instantly patch an entry in both ['entries'] and ['timer'] query caches.
 * Use this for real-time UI sync (e.g. keystroke-by-keystroke) without an API call.
 * The actual API save should be debounced separately.
 */
function patchEntryInCache(queryClient: QueryClient, entryId: string, patch: Partial<Entry>) {
  const patchEntry = (entry: Entry): Entry => ({ ...entry, ...patch });

  queryClient.setQueriesData<DayGroup[]>({ queryKey: ['entries'] }, (old) => {
    if (!old) return old;
    return old.map((group) => ({
      ...group,
      entries: group.entries.map((e) => (e.id === entryId ? patchEntry(e) : e)),
    }));
  });

  queryClient.setQueriesData<TimerState>({ queryKey: ['timer'] }, (old) => {
    if (!old?.entry || old.entry.id !== entryId) return old;
    return { ...old, entry: patchEntry(old.entry) };
  });
}

/**
 * Hook that returns a function to optimistically patch an entry in both caches.
 * Call on every keystroke for real-time bidirectional sync between timer bar and entry list.
 */
export function useOptimisticEntryPatch() {
  const queryClient = useQueryClient();
  return useCallback(
    (entryId: string, patch: Partial<Entry>) => patchEntryInCache(queryClient, entryId, patch),
    [queryClient],
  );
}

export function useEntries(from: string, to: string, deleted = false, userId?: string | null) {
  const { effectiveUserId } = useImpersonation();

  return useQuery({
    queryKey: ['entries', userId ?? effectiveUserId, from, to, deleted],
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      if (deleted) params.set('deleted', 'true');
      if (userId) params.set('userId', userId);
      return apiFetch<DayGroup[]>(`/entries?${params}`);
    },
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ source, ...data }: CreateEntry & { source?: string }) =>
      apiFetch<Entry>('/entries', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: source ? { 'X-Audit-Source': source } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (_error, variables) => {
      toast.error('Failed to create entry', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, source, ...data }: UpdateEntry & { id: string; source?: string }) =>
      apiFetch<Entry>(`/entries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: source ? { 'X-Audit-Source': source } : undefined,
      }),
    onMutate: async (variables) => {
      const { id, source: _source, ...patch } = variables;

      // Cancel in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['entries'] });
      await queryClient.cancelQueries({ queryKey: ['timer'] });

      patchEntryInCache(queryClient, id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (_error, variables) => {
      // Rollback: refetch to get correct server state
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
      toast.error('Failed to save changes', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  const restoreEntry = useRestoreEntry();

  const mutation = useMutation({
    mutationFn: ({ id, source }: { id: string; source?: string }) =>
      apiFetch(`/entries/${id}`, {
        method: 'DELETE',
        headers: source ? { 'X-Audit-Source': source } : undefined,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      toast.success('Entry deleted', {
        action: { label: 'Undo', onClick: () => restoreEntry.mutate(variables.id) },
      });
    },
    onError: (_error, variables) => {
      toast.error('Failed to delete entry', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useRestoreEntry() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<Entry>(`/entries/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: () => {
      toast.error('Failed to restore entry');
    },
  });
  return mutation;
}

export function useAddAdjustment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, ...data }: AdjustEntry & { id: string }) =>
      apiFetch<Entry>(`/entries/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (_error, variables) => {
      toast.error('Failed to add adjustment', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useMoveBlock() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ entryId, ...data }: MoveBlock & { entryId: string }) =>
      apiFetch<Entry>(`/entries/${entryId}/move-block`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
      toast.success('Time block moved to new entry');
    },
    onError: (_error, variables) => {
      toast.error('Failed to move time block', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useSplitEntry() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      entryId,
      durationSeconds,
      note,
      description,
      projectId,
    }: {
      entryId: string;
      durationSeconds: number;
      note?: string;
      description?: string;
      projectId?: string | null;
    }) =>
      apiFetch<Entry>(`/entries/${entryId}/split`, {
        method: 'POST',
        body: JSON.stringify({ durationSeconds, note, description, projectId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      toast.success('Entry split — new entry created');
    },
    onError: (_error, variables) => {
      toast.error('Failed to split entry', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
    },
  });
  return mutation;
}

export function useRecentEntries() {
  const { effectiveUserId } = useImpersonation();
  return useQuery({
    queryKey: ['entries-recent', effectiveUserId],
    queryFn: () => apiFetch<EntrySearchHit[]>('/entries/recent?limit=10'),
    staleTime: 30 * 1000,
  });
}

export function useEntrySearch(query: string) {
  const { effectiveUserId } = useImpersonation();
  return useQuery({
    queryKey: ['entries-search', effectiveUserId, query],
    queryFn: () =>
      apiFetch<EntrySearchHit[]>(`/entries/search?q=${encodeURIComponent(query)}&limit=20`),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useEntryAudit(entryId: string | null) {
  return useQuery({
    queryKey: ['audit', entryId],
    queryFn: () => apiFetch<AuditEvent[]>(`/entries/${entryId}/audit`),
    enabled: !!entryId,
  });
}
