import { type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogtoProvider, LogtoConfig, Prompt } from '@logto/react';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/providers/theme-provider';
import { ScaleProvider } from '@/providers/scale-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ImpersonationProvider } from '@/providers/impersonation-provider';
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

export function App() {
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
