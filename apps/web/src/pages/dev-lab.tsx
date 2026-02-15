import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { DevToolbar } from '@/dev/dev-toolbar';
import { DevNav, type NavItem } from '@/dev/dev-nav';
import { LabSection } from '@/dev/section-lab';
import { LAB_GROUPS } from '@/dev/lab-data';

const LAB_NAV_ITEMS: NavItem[] = [
  {
    id: 'design-lab',
    label: 'Design Lab',
    children: LAB_GROUPS.map((g) => ({ id: g.id, label: g.name })),
  },
];

function DevLabContent() {
  const [activeScale, setActiveScale] = useState(1.1);

  const handleScaleChange = (scale: number) => {
    setActiveScale(scale);
    document.documentElement.style.setProperty('--t-scale', String(scale));
  };

  const zoom = activeScale / 1.1;

  return (
    <div className="min-h-screen bg-background">
      <DevToolbar activeScale={activeScale} onScaleChange={handleScaleChange} />

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
  if (!import.meta.env.DEV) return null;

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
      <ThemeProvider>
        <DevLabContent />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
