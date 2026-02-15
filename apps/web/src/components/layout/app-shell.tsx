import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { ImpersonationBanner } from './impersonation-banner';
import { IdentityShift } from './identity-shift';
import { useAuth } from '@/providers/auth-provider';

const authMode = import.meta.env.VITE_AUTH_MODE ?? 'stub';

export function AppShell() {
  const { user, isLoading, error, signIn, signOut } = useAuth();

  useEffect(() => {
    // In logto mode, redirect to Logto login if not authenticated (and no error)
    if (!isLoading && !user && !error && authMode === 'logto') {
      signIn();
    }
  }, [isLoading, user, error, signIn]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // Auth error — user is authenticated with Logto but profile fetch failed
  if (error && authMode === 'logto') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-muted-foreground">Something went wrong loading your profile.</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
          <button
            onClick={signOut}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // In logto mode, wait for redirect (signIn was called above)
  if (!user && authMode === 'logto') {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <IdentityShift />
    </div>
  );
}
