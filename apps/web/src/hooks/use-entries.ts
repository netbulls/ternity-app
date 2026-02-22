import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useImpersonation } from '@/providers/impersonation-provider';
import type { DayGroup, Entry, CreateEntry, UpdateEntry, AdjustEntry, AuditEvent } from '@ternity/shared';

export function useEntries(from: string, to: string) {
  const { effectiveUserId } = useImpersonation();

  return useQuery({
    queryKey: ['entries', effectiveUserId, from, to],
    queryFn: () =>
      apiFetch<DayGroup[]>(`/entries?from=${from}&to=${to}`),
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

  const mutation = useMutation({
    mutationFn: ({ id, source }: { id: string; source?: string }) =>
      apiFetch(`/entries/${id}`, {
        method: 'DELETE',
        headers: source ? { 'X-Audit-Source': source } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (_error, variables) => {
      toast.error('Failed to delete entry', {
        action: { label: 'Retry', onClick: () => mutation.mutate(variables) },
      });
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

export function useEntryAudit(entryId: string | null) {
  return useQuery({
    queryKey: ['audit', entryId],
    queryFn: () => apiFetch<AuditEvent[]>(`/entries/${entryId}/audit`),
    enabled: !!entryId,
  });
}
