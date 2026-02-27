import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import { DevNav, type NavItem } from '@/dev/dev-nav';
import { scaled } from '@/lib/scaled';
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
  MockBuildInfo,
  MockSidebar,
  SettingsSection,
} from '@/dev/settings-proto-parts';

// ============================================================
// Nav items
// ============================================================

const NAV_ITEMS: NavItem[] = [
  {
    id: 'v1-settings',
    label: 'V1 — Vertical Scroll',
    children: [
      { id: 'v1-appearance', label: 'Appearance' },
      { id: 'v1-timer', label: 'Timer' },
      { id: 'v1-working-hours', label: 'Working Hours' },
      { id: 'v1-attendance', label: 'Attendance' },
      { id: 'v1-integrations', label: 'Integrations' },
      { id: 'v1-notifications', label: 'Notifications' },
    ],
  },
];

// ============================================================
// Page content
// ============================================================

function V1Content() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <DevToolbar />
      <div className="flex flex-1 overflow-hidden">
        <MockSidebar />
        <main className="flex-1 overflow-y-auto p-6" id="v1-settings">
          <h1
            className="font-brand mb-6 font-semibold tracking-wide"
            style={{ fontSize: scaled(18) }}
          >
            Settings
          </h1>

          {/* Two-column layout: settings + info sidebar */}
          <div className="grid max-w-[960px] grid-cols-[1fr_280px] gap-8">
            {/* Left: scrollable settings */}
            <div>
              <SettingsSection
                id="v1-appearance"
                title="Appearance"
                description="Customize the look and feel"
              >
                <MockThemeSelector />
                <MockScaleSelector />
                <MockPreviewCard />
              </SettingsSection>

              <SettingsSection
                id="v1-timer"
                title="Timer"
                description="Timer behavior and defaults"
              >
                <div className="mb-3">
                  <div className="mb-1.5 text-xs text-muted-foreground" style={{ fontSize: scaled(12) }}>
                    Default Project
                  </div>
                  <MockProjectSelector />
                </div>
                <MockTimerToggle />
              </SettingsSection>

              <SettingsSection id="v1-working-hours" title="Working Hours">
                <MockWorkingHours />
              </SettingsSection>

              <SettingsSection id="v1-attendance" title="Attendance">
                <MockAttendance />
              </SettingsSection>

              <SettingsSection id="v1-integrations" title="Integrations">
                <MockJiraCard />
              </SettingsSection>

              <SettingsSection id="v1-notifications" title="Notifications">
                <MockNotifications />
              </SettingsSection>
            </div>

            {/* Right: sticky info sidebar */}
            <div className="space-y-3 pt-1">
              <MockProfileCard />
              <MockBuildInfo />
            </div>
          </div>
        </main>
      </div>
      <DevNav items={NAV_ITEMS} />
    </div>
  );
}

// ============================================================
// Exported page with provider sandwich
// ============================================================

export function DevSettingsV1Page() {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <V1Content />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
