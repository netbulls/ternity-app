import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { AdminProject, AdminClient, CreateProject, UpdateProject, CreateClient, UpdateClient } from '@ternity/shared';

// Re-export types for convenience
export type { AdminProject, AdminClient };

// ── Queries ─────────────────────────────────────────────────────────────

export function useAdminProjects() {
  return useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => apiFetch<AdminProject[]>('/admin/projects'),
  });
}

export function useAdminClients() {
  return useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => apiFetch<AdminClient[]>('/admin/clients'),
  });
}

// ── Project Mutations ───────────────────────────────────────────────────

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin-projects'] });
  qc.invalidateQueries({ queryKey: ['admin-clients'] });
  qc.invalidateQueries({ queryKey: ['projects'] }); // reference cache for pickers
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProject) =>
      apiFetch('/admin/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Project created');
    },
    onError: (err) => {
      toast.error(`Failed to create project: ${err.message}`);
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateProject & { id: string }) =>
      apiFetch(`/admin/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Project updated');
    },
    onError: (err) => {
      toast.error(`Failed to update project: ${err.message}`);
    },
  });
}

export function useActivateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/admin/projects/${projectId}/activate`, { method: 'PATCH' }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Project activated');
    },
    onError: (err) => {
      toast.error(`Failed to activate project: ${err.message}`);
    },
  });
}

export function useDeactivateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/admin/projects/${projectId}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Project deactivated');
    },
    onError: (err) => {
      toast.error(`Failed to deactivate project: ${err.message}`);
    },
  });
}

export function useBulkActivateProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectIds: string[]) =>
      apiFetch<{ count: number }>('/admin/projects/bulk-activate', {
        method: 'POST',
        body: JSON.stringify({ projectIds }),
      }),
    onSuccess: (_data, projectIds) => {
      invalidateAll(qc);
      toast.success(`${projectIds.length} project${projectIds.length === 1 ? '' : 's'} activated`);
    },
    onError: (err) => {
      toast.error(`Failed to activate projects: ${err.message}`);
    },
  });
}

export function useBulkDeactivateProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectIds: string[]) =>
      apiFetch<{ count: number }>('/admin/projects/bulk-deactivate', {
        method: 'POST',
        body: JSON.stringify({ projectIds }),
      }),
    onSuccess: (_data, projectIds) => {
      invalidateAll(qc);
      toast.success(`${projectIds.length} project${projectIds.length === 1 ? '' : 's'} deactivated`);
    },
    onError: (err) => {
      toast.error(`Failed to deactivate projects: ${err.message}`);
    },
  });
}

// ── Client Mutations ────────────────────────────────────────────────────

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClient) =>
      apiFetch<{ id: string; name: string }>('/admin/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Client created');
    },
    onError: (err) => {
      toast.error(`Failed to create client: ${err.message}`);
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateClient & { id: string }) =>
      apiFetch(`/admin/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Client renamed');
    },
    onError: (err) => {
      toast.error(`Failed to rename client: ${err.message}`);
    },
  });
}

export function useActivateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      apiFetch(`/admin/clients/${clientId}/activate`, { method: 'PATCH' }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Client activated');
    },
    onError: (err) => {
      toast.error(`Failed to activate client: ${err.message}`);
    },
  });
}

export function useDeactivateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      apiFetch(`/admin/clients/${clientId}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Client deactivated');
    },
    onError: (err) => {
      toast.error(`Failed to deactivate client: ${err.message}`);
    },
  });
}

export function useBulkActivateClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientIds: string[]) =>
      apiFetch<{ count: number }>('/admin/clients/bulk-activate', {
        method: 'POST',
        body: JSON.stringify({ clientIds }),
      }),
    onSuccess: (_data, clientIds) => {
      invalidateAll(qc);
      toast.success(`${clientIds.length} client${clientIds.length === 1 ? '' : 's'} activated`);
    },
    onError: (err) => {
      toast.error(`Failed to activate clients: ${err.message}`);
    },
  });
}

export function useBulkDeactivateClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientIds: string[]) =>
      apiFetch<{ count: number }>('/admin/clients/bulk-deactivate', {
        method: 'POST',
        body: JSON.stringify({ clientIds }),
      }),
    onSuccess: (_data, clientIds) => {
      invalidateAll(qc);
      toast.success(`${clientIds.length} client${clientIds.length === 1 ? '' : 's'} deactivated`);
    },
    onError: (err) => {
      toast.error(`Failed to deactivate clients: ${err.message}`);
    },
  });
}
