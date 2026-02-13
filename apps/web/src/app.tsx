import { type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogtoProvider, LogtoConfig } from '@logto/react';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthProvider } from '@/providers/auth-provider';
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
  scopes: ['openid', 'profile', 'phone', 'email'],
  // Ternity API is set as Default API in Logto — no need to pass resource here.
  // Logto will use the default resource for token exchange automatically.
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
        <LogtoWrapper>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </LogtoWrapper>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
