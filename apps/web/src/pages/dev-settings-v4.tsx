import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider, usePreferences } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import {
  MockThemeSelector,
  MockScaleSelector,
  MockPreviewCard,
  MockProjectSelector,
  MockTimerToggle,
  MockWorkingHours,
  MockAttendance,
  MockJiraCard,
  MockNotifications,
  MockProfileCard,
  MockSidebar,
  ComingBadge,
  SECTION_ICONS,
  MOCK_SETTINGS_DATA,
} from '@/dev/settings-proto-parts';

// ============================================================
// Card definitions
// ============================================================

interface CardDef {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: () => string;
  soon?: boolean;
  content: () => React.ReactNode;
}

function AppearanceSummary() {
  const { themeMeta, scaleMeta } = usePreferences();
  return `${themeMeta.name} · ${scaleMeta.label}`;
}

function TimerSummary() {
  return `${MOCK_SETTINGS_DATA.projects[0]!.name.split(' — ')[0]} · Confirm: on`;
}

const CARDS: CardDef[] = [
  {
    id: 'appearance',
    title: 'Appearance',
    icon: SECTION_ICONS.appearance,
    summary: AppearanceSummary,
    content: () => (
      <div>
        <p className="mb-3 text-xs text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Customize the look and feel of the interface
        </p>
        <MockThemeSelector />
        <MockScaleSelector />
        <MockPreviewCard />
      </div>
    ),
  },
  {
    id: 'timer',
    title: 'Timer',
    icon: SECTION_ICONS.timer,
    summary: TimerSummary,
    content: () => (
      <div>
        <p className="mb-3 text-xs text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Timer behavior and defaults
        </p>
        <div className="mb-3">
          <div className="mb-1.5 text-xs text-muted-foreground" style={{ fontSize: scaled(12) }}>
            Default Project
          </div>
          <MockProjectSelector />
        </div>
        <MockTimerToggle />
      </div>
    ),
  },
  {
    id: 'working-hours',
    title: 'Working Hours',
    icon: SECTION_ICONS.workingHours,
    summary: () => 'Mon–Fri, 38h/week',
    soon: true,
    content: () => <MockWorkingHours />,
  },
  {
    id: 'attendance',
    title: 'Attendance',
    icon: SECTION_ICONS.attendance,
    summary: () => 'Contractor (B2B)',
    soon: true,
    content: () => <MockAttendance />,
  },
  {
    id: 'jira',
    title: 'Jira Integration',
    icon: SECTION_ICONS.jira,
    summary: () => 'NETBULLS · Connected',
    content: () => (
      <div>
        <p className="mb-3 text-xs text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Connect your Jira workspace for issue search
        </p>
        <MockJiraCard />
      </div>
    ),
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: SECTION_ICONS.notifications,
    summary: () => 'Leave: on, Presence: off',
    soon: true,
    content: () => <MockNotifications />,
  },
  {
    id: 'profile',
    title: 'Profile',
    icon: SECTION_ICONS.profile,
    summary: () => MOCK_SETTINGS_DATA.user.name,
    content: () => <MockProfileCard />,
  },
];

// ============================================================
// Collapsible card
// ============================================================

function CollapsibleCard({
  card,
  expanded,
  onToggle,
}: {
  card: CardDef;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = card.icon;

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        expanded ? 'border-primary/30' : 'border-border',
        'bg-muted/15',
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/20"
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            expanded ? 'bg-primary/10' : 'bg-muted/40',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4 transition-colors',
              expanded ? 'text-primary' : 'text-muted-foreground',
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium" style={{ fontSize: scaled(13) }}>
            {card.title}
          </span>
        </div>
        {!expanded && (
          <span
            className="shrink-0 text-xs text-muted-foreground"
            style={{ fontSize: scaled(11) }}
          >
            {card.summary()}
          </span>
        )}
        {card.soon && !expanded && <ComingBadge />}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              expanded ? 'text-primary' : 'text-muted-foreground/40',
            )}
          />
        </motion.div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pl-[60px]">
              {card.content()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Page content
// ============================================================

function V4Content() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['appearance']));

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <DevToolbar />
      <div className="flex flex-1 overflow-hidden">
        <MockSidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <h1
              className="font-brand mb-5 font-semibold tracking-wide"
              style={{ fontSize: scaled(18) }}
            >
              Settings
            </h1>

            <div className="space-y-2">
              {CARDS.map((card) => (
                <CollapsibleCard
                  key={card.id}
                  card={card}
                  expanded={expanded.has(card.id)}
                  onToggle={() => toggle(card.id)}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// Exported page with provider sandwich
// ============================================================

export function DevSettingsV4Page() {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <V4Content />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
