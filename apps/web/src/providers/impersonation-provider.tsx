import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { setImpersonateUserId } from '@/lib/api';
import { GlobalRole } from '@ternity/shared';

const TRANSITION_DURATION = 2500;

interface ImpersonationContextValue {
  /** The user being viewed (null = viewing as yourself) */
  targetUserId: string | null;
  targetDisplayName: string | null;
  /** The impersonated user's role (for banner display) */
  targetRole: string | null;
  /** True during the identity shift animation */
  isTransitioning: boolean;
  /** Set impersonation target */
  setTarget: (userId: string, displayName: string, role?: string) => void;
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
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setTargetRole(null);
      setImpersonateUserId(null);
    }
  }, [canImpersonate, targetUserId]);

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  const setTarget = useCallback(
    (userId: string, displayName: string, role?: string) => {
      if (!canImpersonate) return;

      // Start transition animation
      setIsTransitioning(true);
      setTargetUserId(userId);
      setTargetDisplayName(displayName);
      setTargetRole(role ?? null);
      // Set module-level header synchronously BEFORE invalidating queries
      setImpersonateUserId(userId);

      // Delay query invalidation until after animation completes
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => {
        setIsTransitioning(false);
        queryClient.invalidateQueries();
      }, TRANSITION_DURATION);
    },
    [canImpersonate, queryClient],
  );

  const clearImpersonation = useCallback(() => {
    setTargetUserId(null);
    setTargetDisplayName(null);
    setTargetRole(null);
    setIsTransitioning(false);
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
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
        targetRole,
        isTransitioning,
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
