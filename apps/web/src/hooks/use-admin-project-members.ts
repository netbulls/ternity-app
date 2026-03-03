import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { ProjectMemberRow, UserProjectRow } from '@ternity/shared';
import { OrgRole } from '@ternity/shared';

// ── Project → Users (V5 Bulk Matrix) ────────────────────────────────

export function useProjectMembers(projectId: string | null) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => apiFetch<ProjectMemberRow[]>(`/admin/projects/${projectId}/members`),
    enabled: !!projectId,
  });
}

export function useAssignProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      userId,
      role,
    }: {
      projectId: string;
      userId: string;
      role?: string;
    }) =>
      apiFetch(`/admin/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId, role: role ?? OrgRole.User }),
      }),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast.success('Member assigned');
    },
    onError: (err) => {
      toast.error(`Failed to assign member: ${err.message}`);
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      apiFetch(`/admin/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast.success('Member removed');
    },
    onError: (err) => {
      toast.error(`Failed to remove member: ${err.message}`);
    },
  });
}

export function useUpdateProjectMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      userId,
      role,
    }: {
      projectId: string;
      userId: string;
      role: string;
    }) =>
      apiFetch(`/admin/projects/${projectId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast.success('Role updated');
    },
    onError: (err) => {
      toast.error(`Failed to update role: ${err.message}`);
    },
  });
}

export function useBulkAssignProjectMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      userIds,
      role,
    }: {
      projectId: string;
      userIds: string[];
      role?: string;
    }) =>
      apiFetch<{ count: number }>(`/admin/projects/${projectId}/members/bulk-assign`, {
        method: 'POST',
        body: JSON.stringify({ userIds, role: role ?? OrgRole.User }),
      }),
    onSuccess: (_data, { projectId, userIds }) => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast.success(`${userIds.length} member${userIds.length === 1 ? '' : 's'} assigned`);
    },
    onError: (err) => {
      toast.error(`Failed to assign members: ${err.message}`);
    },
  });
}

export function useBulkRemoveProjectMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userIds }: { projectId: string; userIds: string[] }) =>
      apiFetch<{ count: number }>(`/admin/projects/${projectId}/members/bulk-remove`, {
        method: 'POST',
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: (_data, { projectId, userIds }) => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast.success(`${userIds.length} member${userIds.length === 1 ? '' : 's'} removed`);
    },
    onError: (err) => {
      toast.error(`Failed to remove members: ${err.message}`);
    },
  });
}

// ── User → Projects (V4 Inline Table) ───────────────────────────────

export function useUserProjects(userId: string | null) {
  return useQuery({
    queryKey: ['user-projects', userId],
    queryFn: () => apiFetch<UserProjectRow[]>(`/admin/users/${userId}/projects`),
    enabled: !!userId,
  });
}

export function useAssignUserProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      projectId,
      role,
    }: {
      userId: string;
      projectId: string;
      role?: string;
    }) =>
      apiFetch(`/admin/users/${userId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ projectId, role: role ?? OrgRole.User }),
      }),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['user-projects', userId] });
      toast.success('Project assigned');
    },
    onError: (err) => {
      toast.error(`Failed to assign project: ${err.message}`);
    },
  });
}

export function useRemoveUserProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, projectId }: { userId: string; projectId: string }) =>
      apiFetch(`/admin/users/${userId}/projects/${projectId}`, { method: 'DELETE' }),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['user-projects', userId] });
      toast.success('Project removed');
    },
    onError: (err) => {
      toast.error(`Failed to remove project: ${err.message}`);
    },
  });
}

export function useUpdateUserProjectRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      projectId,
      role,
    }: {
      userId: string;
      projectId: string;
      role: string;
    }) =>
      apiFetch(`/admin/projects/${projectId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['user-projects', userId] });
      toast.success('Role updated');
    },
    onError: (err) => {
      toast.error(`Failed to update role: ${err.message}`);
    },
  });
}
