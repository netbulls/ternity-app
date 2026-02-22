import { type ReactNode, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogtoProvider, LogtoConfig, Prompt } from '@logto/react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/providers/theme-provider';
import { ScaleProvider } from '@/providers/scale-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ImpersonationProvider } from '@/providers/impersonation-provider';
import { getSimulateError, setSimulateError } from '@/lib/api';
import { router } from '@/router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

const authMode = import.meta.env.VITE_AUTH_MODE ?? 'stub';

const logtoConfig: LogtoConfig = {
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT,
  appId: import.meta.env.VITE_LOGTO_APP_ID,
  scopes: ['openid', 'profile', 'phone', 'email', 'urn:logto:scope:roles', 'admin'],
  resources: ['https://api.ternity.xyz'],
  prompt: Prompt.Login,
};

function LogtoWrapper({ children }: { children: ReactNode }) {
  if (authMode === 'logto') {
    return <LogtoProvider config={logtoConfig}>{children}</LogtoProvider>;
  }
  return <>{children}</>;
}

function useDevErrorShortcut() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        const next = !getSimulateError();
        setSimulateError(next);
        toast(next ? 'Next mutation will fail' : 'Error simulation off');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

export function App() {
  useDevErrorShortcut();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ScaleProvider>
          <LogtoWrapper>
            <AuthProvider>
              <ImpersonationProvider>
                <RouterProvider router={router} />
                <Toaster />
              </ImpersonationProvider>
            </AuthProvider>
          </LogtoWrapper>
        </ScaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
