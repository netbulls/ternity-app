import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { DownloadsResponse } from '@ternity/shared';

export function useDownloads() {
  return useQuery({
    queryKey: ['downloads'],
    queryFn: () => apiFetch<DownloadsResponse>('/downloads'),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
