import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ProjectOption, LabelOption, UserOption } from '@ternity/shared';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<ProjectOption[]>('/projects'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: () => apiFetch<LabelOption[]>('/labels'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserOption[]>('/users'),
    staleTime: 5 * 60 * 1000,
  });
}
