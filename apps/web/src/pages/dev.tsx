import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { DevToolbar } from '@/dev/dev-toolbar';
import { DevNav } from '@/dev/dev-nav';
import { ExplorationsSection } from '@/dev/section-explorations';
import { PrimitivesSection } from '@/dev/section-primitives';
import { PatternsSection } from '@/dev/section-patterns';
import { PagesSection } from '@/dev/section-pages';

function DevPageContent() {
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
          Component Catalog
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Visual preview of all UI components across themes and scales. Dev-only — tree-shaken in
          production.
        </p>

        <ExplorationsSection />
        <PrimitivesSection />
        <PatternsSection />
        <PagesSection />
      </div>
      <DevNav />
    </div>
  );
}

export function DevPage() {
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
        <DevPageContent />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
