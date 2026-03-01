import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { WeeklyWorkingHours } from '@ternity/shared';
import { apiFetch } from '@/lib/api';

export function useWorkingHours() {
  return useQuery({
    queryKey: ['working-hours'],
    queryFn: () => apiFetch<WeeklyWorkingHours>('/working-hours'),
  });
}

export function useUpdateWorkingHours() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (schedule: WeeklyWorkingHours) =>
      apiFetch<WeeklyWorkingHours>('/working-hours', {
        method: 'PUT',
        body: JSON.stringify(schedule),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['working-hours'] });
    },
    onError: (err) => {
      toast.error(`Failed to update working hours: ${err.message}`);
    },
  });
}
