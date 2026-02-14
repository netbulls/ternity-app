import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { TimerPage } from '@/pages/timer';
import { EntriesPage } from '@/pages/entries';
import { ReportsPage } from '@/pages/reports';
import { CalendarPage } from '@/pages/calendar';
import { LeavePage } from '@/pages/leave';
import { ProjectsPage } from '@/pages/projects';
import { SettingsPage } from '@/pages/settings';
import { UserManagementPage } from '@/pages/user-management';
import { CallbackPage } from '@/pages/callback';

export const router = createBrowserRouter([
  {
    path: '/callback',
    element: <CallbackPage />,
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev',
          lazy: async () => {
            const { DevPage } = await import('@/pages/dev');
            return { Component: DevPage };
          },
        },
        {
          path: '/dev/flair',
          lazy: async () => {
            const { DevFlairPage } = await import('@/pages/dev-flair');
            return { Component: DevFlairPage };
          },
        },
      ]
    : []),
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <TimerPage /> },
      { path: '/entries', element: <EntriesPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/leave', element: <LeavePage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/users', element: <UserManagementPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);
