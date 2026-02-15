import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useImpersonation } from '@/providers/impersonation-provider';
import type { Stats } from '@ternity/shared';

export function useStats() {
  const { effectiveUserId } = useImpersonation();

  return useQuery({
    queryKey: ['stats', effectiveUserId],
    queryFn: () => apiFetch<Stats>('/stats'),
  });
}
