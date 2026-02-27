import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type {
  JiraConnectionView,
  JiraConnectionConfig,
  JiraProject,
  JiraStatus,
  JiraSearchResult,
} from '@ternity/shared';

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
    mutationFn: ({
      connectionId,
      config,
    }: {
      connectionId: string;
      config: JiraConnectionConfig;
    }) =>
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

// ── Issue search & linking ──────────────────────────────────────────

export function useJiraSearch(query: string, mode: 'assigned' | 'recent' | 'text') {
  const params = new URLSearchParams({ mode });
  if (mode === 'text' && query) params.set('text', query);

  return useQuery({
    queryKey: ['jira-search', query, mode],
    queryFn: () => apiFetch<JiraSearchResult[]>(`/jira/search?${params}`),
    enabled: mode !== 'text' || query.length >= 2,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useJiraAssigned() {
  return useJiraSearch('', 'assigned');
}

export function useJiraRecent() {
  return useJiraSearch('', 'recent');
}

/**
 * Resolve the Ternity project ID for a Jira issue using the connection's project mappings.
 * Extracts the Jira project key from the issue key (e.g. "PROJ-123" → "PROJ"),
 * looks up the mapping, and falls back through:
 *   1. Jira project mapping for the issue's project key
 *   2. Jira connection's default project
 *   3. User's default project (from preferences)
 */
export function resolveJiraProject(
  connections: JiraConnectionView[] | undefined,
  connectionId: string,
  jiraIssueKey: string,
  userDefaultProjectId?: string | null,
): string | null {
  const connection = connections?.find((c) => c.id === connectionId);
  if (!connection) return userDefaultProjectId ?? null;

  const jiraProjectKey = jiraIssueKey.split('-')[0] ?? '';
  const mappings = connection.config.projectMappings ?? {};
  const mapped = mappings[jiraProjectKey];
  if (mapped) return mapped;

  return connection.config.defaultProjectId ?? userDefaultProjectId ?? null;
}

export function useLinkJiraIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entryId,
      jiraIssueKey,
      jiraIssueSummary,
      jiraConnectionId,
    }: {
      entryId: string;
      jiraIssueKey: string | null;
      jiraIssueSummary: string | null;
      jiraConnectionId: string | null;
    }) =>
      apiFetch(`/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ jiraIssueKey, jiraIssueSummary, jiraConnectionId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
  });
}
