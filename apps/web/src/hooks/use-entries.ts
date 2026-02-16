import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useImpersonation } from '@/providers/impersonation-provider';
import type { DayGroup, Entry, CreateEntry, UpdateEntry, AuditEvent } from '@ternity/shared';

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

  return useMutation({
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
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
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
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
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
  });
}

export function useEntryAudit(entryId: string | null) {
  return useQuery({
    queryKey: ['audit', entryId],
    queryFn: () => apiFetch<AuditEvent[]>(`/entries/${entryId}/audit`),
    enabled: !!entryId,
  });
}
