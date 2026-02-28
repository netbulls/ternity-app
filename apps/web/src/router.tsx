import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { TimerPage } from '@/pages/timer';
import { EntriesPage } from '@/pages/entries';
import { CalendarPage } from '@/pages/calendar';
import { LeavePage } from '@/pages/leave';
import { ProjectsPage } from '@/pages/projects';
import { SettingsPage } from '@/pages/settings';
import { UserManagementPage } from '@/pages/user-management';
import { CallbackPage } from '@/pages/callback';
import { JiraCallbackPage } from '@/pages/jira-callback';
import { DashboardPage } from '@/pages/dashboard';

export const router = createBrowserRouter([
  {
    path: '/callback',
    element: <CallbackPage />,
  },
  {
    path: '/integrations/jira/callback',
    element: <JiraCallbackPage />,
  },
  ...(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV_PAGES === 'true'
    ? [
        {
          path: '/dev',
          lazy: async () => {
            const { DevPage } = await import('@/pages/dev');
            return { Component: DevPage };
          },
        },
        {
          path: '/dev/lab',
          lazy: async () => {
            const { DevLabPage } = await import('@/pages/dev-lab');
            return { Component: DevLabPage };
          },
        },
        {
          path: '/dev/flair',
          lazy: async () => {
            const { DevFlairPage } = await import('@/pages/dev-flair');
            return { Component: DevFlairPage };
          },
        },
        {
          path: '/dev/mission',
          lazy: async () => {
            const { DevMissionPage } = await import('@/pages/dev-mission');
            return { Component: DevMissionPage };
          },
        },
        {
          path: '/dev/tray',
          lazy: async () => {
            const { DevTrayPage } = await import('@/pages/dev-tray');
            return { Component: DevTrayPage };
          },
        },
        {
          path: '/dev/tray-v2',
          lazy: async () => {
            const { DevTrayV2Page } = await import('@/pages/dev-tray-v2');
            return { Component: DevTrayV2Page };
          },
        },
        {
          path: '/dev/presence',
          lazy: async () => {
            const { DevPresencePage } = await import('@/pages/dev-presence');
            return { Component: DevPresencePage };
          },
        },
        {
          path: '/dev/downloads',
          lazy: async () => {
            const { DevDownloadsPage } = await import('@/pages/dev-downloads');
            return { Component: DevDownloadsPage };
          },
        },
        {
          path: '/dev/release-notes',
          lazy: async () => {
            const { DevReleaseNotesPage } = await import('@/pages/dev-release-notes');
            return { Component: DevReleaseNotesPage };
          },
        },
        {
          path: '/dev/start-stop',
          lazy: async () => {
            const { DevStartStopPage } = await import('@/pages/dev-start-stop');
            return { Component: DevStartStopPage };
          },
        },
        {
          path: '/dev/timer-looks',
          lazy: async () => {
            const { DevTimerLooksPage } = await import('@/pages/dev-timer-looks');
            return { Component: DevTimerLooksPage };
          },
        },
        {
          path: '/dev/switch-confirm',
          lazy: async () => {
            const { DevSwitchConfirmPage } = await import('@/pages/dev-switch-confirm');
            return { Component: DevSwitchConfirmPage };
          },
        },
        {
          path: '/dev/settings-v1',
          lazy: async () => {
            const { DevSettingsV1Page } = await import('@/pages/dev-settings-v1');
            return { Component: DevSettingsV1Page };
          },
        },
        {
          path: '/dev/settings-v3',
          lazy: async () => {
            const { DevSettingsV3Page } = await import('@/pages/dev-settings-v3');
            return { Component: DevSettingsV3Page };
          },
        },
        {
          path: '/dev/settings-v4',
          lazy: async () => {
            const { DevSettingsV4Page } = await import('@/pages/dev-settings-v4');
            return { Component: DevSettingsV4Page };
          },
        },
        {
          path: '/dev/jira-search',
          lazy: async () => {
            const { DevJiraSearchPage } = await import('@/pages/dev-jira-search');
            return { Component: DevJiraSearchPage };
          },
        },
        {
          path: '/dev/jira-v1',
          lazy: async () => {
            const { DevJiraV1Page } = await import('@/pages/dev-jira-v1');
            return { Component: DevJiraV1Page };
          },
        },
        {
          path: '/dev/jira-v9',
          lazy: async () => {
            const { DevJiraV9Page } = await import('@/pages/dev-jira-v9');
            return { Component: DevJiraV9Page };
          },
        },
        {
          path: '/dev/jira-v10',
          lazy: async () => {
            const { DevJiraV10Page } = await import('@/pages/dev-jira-v10');
            return { Component: DevJiraV10Page };
          },
        },
        {
          path: '/dev/jira-v1v10',
          lazy: async () => {
            const { DevJiraV1V10Page } = await import('@/pages/dev-jira-v1v10');
            return { Component: DevJiraV1V10Page };
          },
        },
        {
          path: '/dev/jira-v1v9',
          lazy: async () => {
            const { DevJiraV1V9Page } = await import('@/pages/dev-jira-v1v9');
            return { Component: DevJiraV1V9Page };
          },
        },
        {
          path: '/dev/jira-mapping',
          lazy: async () => {
            const { DevJiraMappingPage } = await import('@/pages/dev-jira-mapping');
            return { Component: DevJiraMappingPage };
          },
        },
      ]
    : []),
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <TimerPage /> },
      { path: '/entries', element: <EntriesPage /> },
      { path: '/dashboard', element: <Navigate to="/reports" replace /> },
      { path: '/reports', element: <DashboardPage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/leave', element: <LeavePage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/users', element: <UserManagementPage /> },
      { path: '/downloads', element: <Navigate to="/settings/downloads" replace /> },
      { path: '/settings/:tab?', element: <SettingsPage /> },
    ],
  },
]);
