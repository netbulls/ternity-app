import { useEffect } from 'react';
import type { UserPreferences } from '@ternity/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePreferences } from '@/providers/preferences-provider';
import { apiFetch } from '@/lib/api';

/**
 * Renderless component that syncs preferences with the server.
 * Place inside the auth boundary (after AuthProvider).
 */
export function PreferencesSync() {
  const { user } = useAuth();
  const { syncFromServer } = usePreferences();

  useEffect(() => {
    if (!user) return;
    apiFetch<UserPreferences>('/user/preferences')
      .then(syncFromServer)
      .catch(() => {
        // Silent — localStorage cache is fine as fallback
      });
  }, [user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
