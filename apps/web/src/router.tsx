import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { TimerPage } from '@/pages/timer';
import { EntriesPage } from '@/pages/entries';
import { ReportsPage } from '@/pages/reports';
import { CalendarPage } from '@/pages/calendar';
import { LeavePage } from '@/pages/leave';
import { ProjectsPage } from '@/pages/projects';
import { SettingsPage } from '@/pages/settings';
import { CallbackPage } from '@/pages/callback';

export const router = createBrowserRouter([
  {
    path: '/callback',
    element: <CallbackPage />,
  },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <TimerPage /> },
      { path: '/entries', element: <EntriesPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/leave', element: <LeavePage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);
