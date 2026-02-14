import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { List } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'explorations',
    label: 'Explorations',
  },
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

function NavTree({
  activeId,
  activeParent,
  scrollTo,
}: {
  activeId: string;
  activeParent: string | undefined;
  scrollTo: (id: string) => void;
}) {
  return (
    <ul className="space-y-1 text-xs">
      {NAV_ITEMS.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => scrollTo(item.id)}
            className={cn(
              'w-full rounded-md px-2 py-1 text-left font-medium transition-colors',
              activeParent === item.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
          {item.children && (
            <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-border pl-2">
              {item.children.map((child) => (
                <li key={child.id}>
                  <button
                    onClick={() => scrollTo(child.id)}
                    className={cn(
                      'w-full rounded-md px-1.5 py-0.5 text-left transition-colors',
                      activeId === child.id
                        ? 'font-medium text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {child.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DevNav() {
  const [activeId, setActiveId] = useState('');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash) {
      const hashId = window.location.hash.slice(1);
      setActiveId(hashId);
      // Browser native hash scroll fires before React renders — scroll manually after paint
      requestAnimationFrame(() => {
        const el = document.getElementById(hashId);
        if (el) el.scrollIntoView({ block: 'start' });
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (top?.target.id) {
          setActiveId(top.target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );

    const allIds = NAV_ITEMS.flatMap((item) => [
      item.id,
      ...(item.children?.map((c) => c.id) ?? []),
    ]);
    for (const id of allIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
      setActiveId(id);
      setOpen(false);
    }
  };

  const activeParent = NAV_ITEMS.find(
    (item) =>
      item.id === activeId || item.children?.some((c) => c.id === activeId),
  )?.id;

  return (
    <>
      {/* Wide screens: fixed side TOC */}
      <nav className="fixed right-4 top-16 z-40 hidden w-40 xl:block">
        <NavTree activeId={activeId} activeParent={activeParent} scrollTo={scrollTo} />
      </nav>

      {/* Narrow screens: floating toggle + dropdown */}
      <div className="fixed bottom-4 right-4 z-40 xl:hidden" ref={dropdownRef}>
        {open && (
          <div className="absolute bottom-12 right-0 mb-1 w-48 rounded-lg border border-border bg-card p-3 shadow-lg">
            <NavTree activeId={activeId} activeParent={activeParent} scrollTo={scrollTo} />
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border border-border shadow-lg transition-colors',
            open
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          <List className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}
