import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider, usePreferences } from '@/providers/preferences-provider';
import { Toaster } from '@/components/ui/sonner';
import { DevToolbar } from '@/dev/dev-toolbar';
import { DevNav, type NavItem } from '@/dev/dev-nav';
import { LabSection } from '@/dev/section-lab';
import { LAB_SECTIONS } from '@/dev/lab-data';

const LAB_NAV_ITEMS: NavItem[] = LAB_SECTIONS.map((s) => ({
  id: `lab-${s.id}`,
  label: s.product,
  children: s.groups.map((g) => ({ id: g.id, label: g.name })),
}));

function DevLabContent() {
  const { scale } = usePreferences();
  const zoom = scale / 1.1;

  return (
    <div className="min-h-screen bg-background">
      <DevToolbar />

      <div className="mx-auto max-w-5xl px-6 py-8" style={{ zoom }}>
        <h1 className="font-brand mb-2 text-2xl font-bold tracking-wider text-foreground">
          Design Lab
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Design archive — explorations and prototypes grouped by feature. Immutable record of the
          design process.
        </p>

        <LabSection />
      </div>
      <DevNav items={LAB_NAV_ITEMS} />
    </div>
  );
}

export function DevLabPage() {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: Infinity, retry: false, refetchOnMount: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        
          <DevLabContent />
          <Toaster />
        
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
