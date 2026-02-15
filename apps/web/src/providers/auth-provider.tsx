import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useLogto } from '@logto/react';
import type { AuthContext as AuthContextType } from '@ternity/shared';
import { setTokenGetter } from '@/lib/api';

interface AuthContextValue {
  user: AuthContextType | null;
  isLoading: boolean;
  error: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const authMode = import.meta.env.VITE_AUTH_MODE ?? 'stub';

// ── Stub mode ───────────────────────────────────────────────────────────────

function StubAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((data: AuthContextType) => {
        setUser(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const signIn = useCallback(() => {
    // Stub: no-op, user is always signed in
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, error: false, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Logto mode ──────────────────────────────────────────────────────────────
//
// State machine: init → fetching → done | error
//   init     = SDK still loading or waiting for isAuthenticated
//   fetching = authenticated, fetching user profile from API
//   done     = settled (user may or may not be set)
//   error    = profile fetch failed
//
// Key constraint: logto.isLoading MUST NOT appear in the isLoading formula.
// SDK token methods toggle the loading flag, which causes re-renders that
// flash the loading screen.  We isolate isLoading reads into effects only.

type AuthStatus = 'init' | 'fetching' | 'done' | 'error';

function LogtoAuthProvider({ children }: { children: ReactNode }) {
  const logto = useLogto();
  const [user, setUser] = useState<AuthContextType | null>(null);
  const [status, setStatus] = useState<AuthStatus>('init');

  // Effect 1: Detect "SDK finished loading." Handles force sign-out on mode switch
  // and the normal "not authenticated" case. Safe to include isLoading in deps —
  // this effect never calls getIdToken().
  useEffect(() => {
    if (logto.isLoading) return;

    // Force sign-out when switching from another mode to logto.
    // Ends the Logto server session so the user gets a fresh login screen.
    const forceSignout = localStorage.getItem('ternity_force_signout');
    if (forceSignout) {
      localStorage.removeItem('ternity_force_signout');
      if (logto.isAuthenticated) {
        logto.signOut(window.location.origin);
        return;
      }
    }

    if (!logto.isAuthenticated) {
      setStatus('done');
    }
  }, [logto.isLoading, logto.isAuthenticated]);

  // Effect 2: When authenticated, fetch user profile.
  // Only depends on isAuthenticated (transitions once: false→true).
  // isLoading is deliberately excluded — SDK token methods toggle it.
  useEffect(() => {
    if (!logto.isAuthenticated) {
      // Clear stale user data when session is lost (sign-out or expiry)
      setUser(null);
      return;
    }

    // Register token getter so apiFetch includes the Bearer token.
    // Uses JWT access token scoped to the Ternity API resource.
    const apiResource = 'https://api.ternity.xyz';
    setTokenGetter(async () => (await logto.getAccessToken(apiResource)) ?? null);

    let mounted = true;
    setStatus('fetching');

    (async () => {
      try {
        const token = await logto.getAccessToken(apiResource);
        if (!mounted || !token) {
          if (mounted) setStatus('error');
          return;
        }

        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mounted) return;

        if (res.status === 401) {
          // Token still expired after refresh attempt — re-authenticate.
          // If the Logto session is still valid, this redirects back immediately
          // with fresh tokens. Use sessionStorage to prevent infinite loops.
          const retryKey = 'ternity_auth_retry';
          if (!sessionStorage.getItem(retryKey)) {
            sessionStorage.setItem(retryKey, '1');
            logto.signIn(window.location.origin + '/callback');
            return;
          }
          sessionStorage.removeItem(retryKey);
          console.error('Token expired and re-auth failed');
          setStatus('error');
          return;
        }

        if (!res.ok) {
          console.error('Failed to fetch user profile:', res.status, await res.text());
          setStatus('error');
          return;
        }

        // Success — clear any retry flag
        sessionStorage.removeItem('ternity_auth_retry');

        const data: AuthContextType = await res.json();
        if (!mounted) return;

        setUser(data);
        setStatus('done');
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to fetch user profile', err);
        setStatus('error');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [logto.isAuthenticated]);

  const handleSignIn = useCallback(() => {
    logto.signIn(window.location.origin + '/callback');
  }, [logto]);

  const handleSignOut = useCallback(() => {
    // Reset to loading state immediately so AppShell doesn't race to call
    // signIn() before the sign-out redirect actually navigates the browser.
    setUser(null);
    setStatus('init');
    logto.signOut(window.location.origin);
  }, [logto]);

  // isLoading derived purely from our state machine — immune to SDK's isLoading flicker
  const isLoading = status === 'init' || status === 'fetching';
  const error = status === 'error';

  return (
    <AuthContext.Provider value={{ user, isLoading, error, signIn: handleSignIn, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Exported provider (picks mode) ──────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // Detect mode changes between stub ↔ logto
  const modeKey = 'ternity_auth_mode';
  const prevMode = localStorage.getItem(modeKey);
  if (prevMode && prevMode !== authMode) {
    if (authMode === 'logto') {
      // Switching TO logto — flag for LogtoAuthProvider to force sign-out.
      // Don't clear Logto tokens yet — signOut() needs them for end-session.
      localStorage.setItem('ternity_force_signout', '1');
    } else {
      // Switching FROM logto — clean up stale tokens
      Object.keys(localStorage)
        .filter((k) => k.startsWith('logto'))
        .forEach((k) => localStorage.removeItem(k));
    }
    sessionStorage.removeItem('ternity_auth_retry');
  }
  localStorage.setItem(modeKey, authMode);

  if (authMode === 'logto') {
    return <LogtoAuthProvider>{children}</LogtoAuthProvider>;
  }
  return <StubAuthProvider>{children}</StubAuthProvider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
