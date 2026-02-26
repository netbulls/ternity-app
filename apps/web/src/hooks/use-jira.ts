import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { JiraConnectionView, JiraConnectionConfig, JiraProject, JiraStatus } from '@ternity/shared';

export function useJiraConnections() {
  return useQuery({
    queryKey: ['jira-connections'],
    queryFn: () => apiFetch<JiraConnectionView[]>('/jira/connections'),
    staleTime: 30 * 1000,
  });
}

export function useJiraProjects(connectionId: string | null) {
  return useQuery({
    queryKey: ['jira-projects', connectionId],
    queryFn: () => apiFetch<JiraProject[]>(`/jira/connections/${connectionId}/projects`),
    staleTime: 5 * 60 * 1000,
    enabled: !!connectionId,
  });
}

export function useJiraStatuses(connectionId: string | null) {
  return useQuery({
    queryKey: ['jira-statuses', connectionId],
    queryFn: () => apiFetch<JiraStatus[]>(`/jira/connections/${connectionId}/statuses`),
    staleTime: 5 * 60 * 1000,
    enabled: !!connectionId,
  });
}

export function useUpdateJiraConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ connectionId, config }: { connectionId: string; config: JiraConnectionConfig }) =>
      apiFetch(`/jira/connections/${connectionId}/config`, {
        method: 'PATCH',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-connections'] });
    },
  });
}

export function useDisconnectJira() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) =>
      apiFetch(`/jira/connections/${connectionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-connections'] });
      toast.success('Jira site disconnected');
    },
    onError: () => {
      toast.error('Failed to disconnect');
    },
  });
}

export function useSyncJira() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) =>
      apiFetch<{ ok: boolean; lastSyncedAt: string }>(`/jira/connections/${connectionId}/sync`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-connections'] });
      toast.success('Sync complete');
    },
    onError: () => {
      toast.error('Sync failed');
    },
  });
}
