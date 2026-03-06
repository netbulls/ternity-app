import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

export type EmploymentType = 'contractor' | 'employee';

export interface AdminUser {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  globalRole: string;
  employmentType: EmploymentType;
  active: boolean;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  teamClientName: string | null;
  entryCount: number;
  lastEntryAt: string | null;
}

export function useAdminUsers(status: string, search: string) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (search.trim()) params.set('search', search.trim());
  const qs = params.toString();

  return useQuery({
    queryKey: ['admin-users', status, search],
    queryFn: () => apiFetch<AdminUser[]>(`/admin/users${qs ? `?${qs}` : ''}`),
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/admin/users/${userId}/activate`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User activated');
    },
    onError: (err) => {
      toast.error(`Failed to activate user: ${err.message}`);
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/admin/users/${userId}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deactivated');
    },
    onError: (err) => {
      toast.error(`Failed to deactivate user: ${err.message}`);
    },
  });
}

export function useBulkActivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      apiFetch<{ count: number }>('/admin/users/bulk-activate', {
        method: 'POST',
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: (_data, userIds) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`${userIds.length} user${userIds.length === 1 ? '' : 's'} activated`);
    },
    onError: (err) => {
      toast.error(`Failed to activate users: ${err.message}`);
    },
  });
}

export function useBulkDeactivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      apiFetch<{ count: number }>('/admin/users/bulk-deactivate', {
        method: 'POST',
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: (_data, userIds) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`${userIds.length} user${userIds.length === 1 ? '' : 's'} deactivated`);
    },
    onError: (err) => {
      toast.error(`Failed to deactivate users: ${err.message}`);
    },
  });
}

export function useUpdateEmploymentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, employmentType }: { userId: string; employmentType: EmploymentType }) =>
      apiFetch(`/admin/users/${userId}/employment-type`, {
        method: 'PATCH',
        body: JSON.stringify({ employmentType }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Employment type updated');
    },
    onError: (err) => {
      toast.error(`Failed to update employment type: ${err.message}`);
    },
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, projectId }: { userId: string; projectId: string | null }) =>
      apiFetch(`/admin/users/${userId}/team`, {
        method: 'PATCH',
        body: JSON.stringify({ projectId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Team updated');
    },
    onError: (err) => {
      toast.error(`Failed to update team: ${err.message}`);
    },
  });
}
