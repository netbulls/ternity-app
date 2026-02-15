import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { setImpersonateUserId } from '@/lib/api';
import { GlobalRole } from '@ternity/shared';

interface ImpersonationContextValue {
  /** The user being viewed (null = viewing as yourself) */
  targetUserId: string | null;
  targetDisplayName: string | null;
  /** Set impersonation target */
  setTarget: (userId: string, displayName: string) => void;
  /** Clear impersonation (back to real user) */
  clearImpersonation: () => void;
  /** Whether current user can impersonate */
  canImpersonate: boolean;
  /** The effective user ID (impersonated or real) */
  effectiveUserId: string | null;
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetDisplayName, setTargetDisplayName] = useState<string | null>(null);

  const canImpersonate = user?.globalRole === GlobalRole.Admin;

  // Sync module-level impersonation state
  useEffect(() => {
    setImpersonateUserId(targetUserId);
  }, [targetUserId]);

  // Clear impersonation if user changes or loses admin
  useEffect(() => {
    if (!canImpersonate && targetUserId) {
      setTargetUserId(null);
      setTargetDisplayName(null);
      setImpersonateUserId(null);
    }
  }, [canImpersonate, targetUserId]);

  const setTarget = useCallback(
    (userId: string, displayName: string) => {
      if (!canImpersonate) return;
      setTargetUserId(userId);
      setTargetDisplayName(displayName);
      // Set module-level header synchronously BEFORE invalidating queries
      setImpersonateUserId(userId);
      queryClient.invalidateQueries();
    },
    [canImpersonate, queryClient],
  );

  const clearImpersonation = useCallback(() => {
    setTargetUserId(null);
    setTargetDisplayName(null);
    // Set module-level header synchronously BEFORE invalidating queries
    setImpersonateUserId(null);
    queryClient.invalidateQueries();
  }, [queryClient]);

  const effectiveUserId = targetUserId ?? user?.userId ?? null;

  return (
    <ImpersonationContext.Provider
      value={{
        targetUserId,
        targetDisplayName,
        setTarget,
        clearImpersonation,
        canImpersonate,
        effectiveUserId,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}
