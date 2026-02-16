import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { TimerPage } from '@/pages/timer';
import { ReportsPage } from '@/pages/reports';
import { CalendarPage } from '@/pages/calendar';
import { LeavePage } from '@/pages/leave';
import { ProjectsPage } from '@/pages/projects';
import { SettingsPage } from '@/pages/settings';
import { UserManagementPage } from '@/pages/user-management';
import { CallbackPage } from '@/pages/callback';
import { DashboardPage } from '@/pages/dashboard';

export const router = createBrowserRouter([
  {
    path: '/callback',
    element: <CallbackPage />,
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
      ]
    : []),
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <TimerPage /> },
      { path: '/entries', element: <Navigate to="/" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/leave', element: <LeavePage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/users', element: <UserManagementPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);
