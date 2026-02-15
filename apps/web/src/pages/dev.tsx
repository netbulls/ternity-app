import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { DevToolbar } from '@/dev/dev-toolbar';
import { DevNav, type NavItem } from '@/dev/dev-nav';
import { PrimitivesSection } from '@/dev/section-primitives';
import { PatternsSection } from '@/dev/section-patterns';
import { PagesSection } from '@/dev/section-pages';

const CATALOG_NAV_ITEMS: NavItem[] = [
  {
    id: 'primitives',
    label: 'Primitives',
    children: [
      { id: 'typography', label: 'Typography' },
      { id: 'button-variants', label: 'Buttons' },
      { id: 'input', label: 'Input' },
      { id: 'badge', label: 'Badge' },
      { id: 'stat-card', label: 'Stat Card' },
      { id: 'checkbox', label: 'Checkbox' },
      { id: 'dialog', label: 'Dialog' },
      { id: 'toast-sonner', label: 'Toast' },
    ],
  },
  {
    id: 'patterns',
    label: 'Patterns',
    children: [
      { id: 'stat-cards', label: 'Stat Cards' },
      { id: 'data-table-basic', label: 'Table Basic' },
      { id: 'data-table-with-selection-bulk-actions', label: 'Table Selection' },
      { id: 'timer-bar-idle', label: 'Timer Bar' },
      { id: 'entry-rows', label: 'Entry Rows' },
      { id: 'day-groups', label: 'Day Groups' },
      { id: 'sidebar', label: 'Sidebar' },
      { id: 'manual-entry-dialog', label: 'Manual Entry' },
    ],
  },
  {
    id: 'pages',
    label: 'Pages',
    children: [
      { id: 'user-management', label: 'User Mgmt' },
      { id: 'entries', label: 'Entries' },
    ],
  },
];

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

        <PrimitivesSection />
        <PatternsSection />
        <PagesSection />
      </div>
      <DevNav items={CATALOG_NAV_ITEMS} />
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
