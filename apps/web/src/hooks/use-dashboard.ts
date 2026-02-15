import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useImpersonation } from '@/providers/impersonation-provider';
import type { DashboardData } from '@ternity/shared';

export function useDashboard() {
  const { effectiveUserId } = useImpersonation();

  return useQuery({
    queryKey: ['dashboard', effectiveUserId],
    queryFn: () => apiFetch<DashboardData>('/dashboard'),
    refetchInterval: 60_000,
  });
}
