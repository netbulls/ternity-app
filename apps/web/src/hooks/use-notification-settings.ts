import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { NotificationSettings, NotificationType } from '@ternity/shared';
import { ApiError, apiFetch } from '@/lib/api';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  try {
    const parsed = JSON.parse(error.body) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // ignore JSON parse failures
  }

  return fallback;
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => apiFetch<NotificationSettings>('/notification-settings'),
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (settings: NotificationSettings) =>
      apiFetch<NotificationSettings>('/notification-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: (err) => {
      toast.error(`Failed to update notifications: ${err.message}`);
    },
  });
}

export function useSendTestNotificationEmail() {
  return useMutation({
    mutationFn: (type: NotificationType) =>
      apiFetch<{ ok: boolean; messageId: string | null }>('/notification-settings/test-email', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),
    onSuccess: () => {
      toast.success('Test email sent');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to send test email'));
    },
  });
}

export function useSendTestNotificationSms() {
  return useMutation({
    mutationFn: (type: NotificationType) =>
      apiFetch<{
        ok: boolean;
        sid: string;
        status: string | null;
        sentLastHour: number;
        limitPerHour: number;
      }>('/notification-settings/test-sms', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),
    onSuccess: (data) => {
      toast.success(`Test SMS sent (${data.sentLastHour}/${data.limitPerHour} this hour)`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429) {
        toast.error(getApiErrorMessage(error, 'SMS test limit reached (5 per hour)'));
        return;
      }
      toast.error(getApiErrorMessage(error, 'Failed to send test SMS'));
    },
  });
}
