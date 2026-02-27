import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@ternity/shared';

export function useEntries(from: string, to: string, deleted = false) {
  const { effectiveUserId } = useImpersonation();

  return useQuery({
    queryKey: ['entries', effectiveUserId, from, to, deleted],
    queryFn: () =>
      apiFetch<DayGroup[]>(`/entries?from=${from}&to=${to}${deleted ? '&deleted=true' : ''}`),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (_error, variables) => {
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
  return useQuery({
    queryKey: ['entries-recent'],
    queryFn: () => apiFetch<EntrySearchHit[]>('/entries/recent?limit=10'),
    staleTime: 30 * 1000,
  });
}

export function useEntrySearch(query: string) {
  return useQuery({
    queryKey: ['entries-search', query],
    queryFn: () => apiFetch<EntrySearchHit[]>(`/entries/search?q=${encodeURIComponent(query)}`),
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
