import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { ProjectOption, TagOption, UserOption, CreateTag, UpdateTag } from '@ternity/shared';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<ProjectOption[]>('/projects'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagOption[]>('/tags'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTag) =>
      apiFetch<TagOption>('/tags', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err) => {
      toast.error(`Failed to create tag: ${err.message}`);
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTag & { id: string }) =>
      apiFetch<TagOption>(`/tags/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err) => {
      toast.error(`Failed to update tag: ${err.message}`);
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err) => {
      toast.error(`Failed to delete tag: ${err.message}`);
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserOption[]>('/users'),
    staleTime: 5 * 60 * 1000,
  });
}
