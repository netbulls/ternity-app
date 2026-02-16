export interface LabExploration {
  kind: 'exploration';
  title: string;
  file: string;
  description: string;
  date: string;
}

export interface LabPrototype {
  kind: 'prototype';
  title: string;
  route: string;
  description: string;
  date: string;
}

export type LabItem = LabExploration | LabPrototype;

export interface LabFeatureGroup {
  name: string;
  id: string;
  description: string;
  date: string;
  items: LabItem[];
}

export interface LabProductSection {
  product: string;
  id: string;
  groups: LabFeatureGroup[];
}

export function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 4) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}

export const LAB_SECTIONS: LabProductSection[] = [
  {
    product: 'Web App',
    id: 'web',
    groups: [
      {
        name: 'huge-theme',
        id: 'huge-theme-lab',
        description: 'Large-screen dashboard concepts — bento, scoreboard, narrative, ambient, focus',
        date: '2026-02-15T22:00:00',
        items: [
          { kind: 'exploration', title: 'huge-cockpit-a1f7', file: 'web/huge-cockpit-a1f7.html', description: 'The Cockpit — Bento grid, no sidebar, timer as hero, everything on one screen', date: '2026-02-15T22:00:00' },
          { kind: 'exploration', title: 'huge-pulse-b3e9', file: 'web/huge-pulse-b3e9.html', description: 'The Pulse — Team-first scoreboard, each person is a large live tile', date: '2026-02-15T22:10:00' },
          { kind: 'exploration', title: 'huge-narrative-c5d2', file: 'web/huge-narrative-c5d2.html', description: 'The Narrative — Anti-dashboard, story flow, situation → progress → actions', date: '2026-02-15T22:20:00' },
          { kind: 'exploration', title: 'huge-wall-d8f4', file: 'web/huge-wall-d8f4.html', description: 'The Wall — Ambient TV display, huge numbers, live clock, activity ticker', date: '2026-02-15T22:30:00' },
          { kind: 'exploration', title: 'huge-focus-e2a6', file: 'web/huge-focus-e2a6.html', description: 'The Focus — Context-aware: tracking = timer IS the screen, idle = quick-start launchpad', date: '2026-02-15T22:40:00' },
        ],
      },
      {
        name: 'timer-mission',
        id: 'timer-mission-lab',
        description: 'Timer bar reimagined — Dock, Stage, Strip directions with state transitions',
        date: '2026-02-16T12:00:00',
        items: [
          { kind: 'exploration', title: 'timer-mission-d7f3', file: 'web/timer-mission-d7f3.html', description: 'Mission Center — 3 visual directions (Dock, Stage, Strip) for reimagining the timer bar', date: '2026-02-16T12:00:00' },
          { kind: 'prototype', title: 'Mission Center', route: '/dev/mission', description: 'Interactive prototype: Dock, Stage, Strip variants with state transitions, recent entries, smart-default picker, todo state', date: '2026-02-16T12:30:00' },
        ],
      },
      {
        name: 'entries',
        id: 'entries-lab',
        description: 'Time entries page — day groups, inline editing, timer bar flair',
        date: '2026-02-15T18:38:00',
        items: [
          { kind: 'exploration', title: 'entries-110c', file: 'web/entries-110c.html', description: 'Approved v2 with day groups and timer', date: '2026-02-15T18:38:00' },
          { kind: 'exploration', title: 'entries', file: 'web/entries.html', description: 'Day groups and timer bar', date: '2026-02-14T23:29:00' },
          { kind: 'exploration', title: 'entries-v1', file: 'web/entries-v1.html', description: 'Earlier layout iteration', date: '2026-02-14T23:29:00' },
          { kind: 'prototype', title: 'Timer Flair', route: '/dev/flair', description: 'Timer bar flair, inline editing, project picker animations', date: '2026-02-15T10:00:00' },
        ],
      },
      {
        name: 'impersonation',
        id: 'impersonation-lab',
        description: 'Admin impersonation — banner, controls, user switching',
        date: '2026-02-15T17:11:00',
        items: [
          { kind: 'exploration', title: 'impersonation-8f3d', file: 'web/impersonation-8f3d.html', description: 'Admin banner and controls', date: '2026-02-15T17:01:00' },
          { kind: 'exploration', title: 'impersonation-4a1c', file: 'web/impersonation-4a1c.html', description: 'Earlier iteration', date: '2026-02-15T17:11:00' },
        ],
      },
      {
        name: 'project-management',
        id: 'project-management-lab',
        description: 'Client & project CRUD — tables, dialogs, active/inactive status',
        date: '2026-02-16T23:30:00',
        items: [
          { kind: 'exploration', title: 'projects-b2d8', file: 'web/projects-b2d8.html', description: 'v2 — aligned with user management patterns: 3 stat cards, bulk selection, pagination, toast, same toolbar', date: '2026-02-17T00:30:00' },
          { kind: 'exploration', title: 'projects-ea7a', file: 'web/projects-ea7a.html', description: 'v1 — scope tabs, 4 stat cards, grouped-by-client view, create/deactivate dialogs', date: '2026-02-16T23:30:00' },
        ],
      },
      {
        name: 'user-management',
        id: 'user-management-lab',
        description: 'User admin — table, stat cards, filters, bulk activate/deactivate',
        date: '2026-02-14T19:12:00',
        items: [
          { kind: 'exploration', title: 'user-management', file: 'web/user-management.html', description: 'Table, stat cards, filters, bulk actions', date: '2026-02-14T19:12:00' },
        ],
      },
      {
        name: 'general',
        id: 'general-lab',
        description: 'Foundation — typography, colors, spacing, themes, primitives',
        date: '2026-02-14T19:12:00',
        items: [
          { kind: 'exploration', title: 'design-preview', file: 'web/design-preview.html', description: 'Typography, colors, spacing, primitives', date: '2026-02-14T19:12:00' },
          { kind: 'exploration', title: 'phase2-options', file: 'web/phase2-options.html', description: 'Timer layouts, icon library comparison', date: '2026-02-13T14:30:00' },
          { kind: 'exploration', title: 'theme-proposals', file: 'web/theme-proposals.html', description: 'All 6 theme palettes side-by-side', date: '2026-02-13T16:45:00' },
        ],
      },
    ],
  },
  {
    product: 'Desktop App',
    id: 'desktop',
    groups: [
      {
        name: 'tray-popup',
        id: 'desktop-tray-lab',
        description: 'System tray popup — timer, recent entries, settings, login flow',
        date: '2026-02-16T22:00:00',
        items: [
          { kind: 'prototype', title: 'Tray Popup v2', route: '/dev/tray-v2', description: 'v2 — stable layout (no size jump on idle↔tracking), in-progress entry indicator, persistent structure with animated content swaps', date: '2026-02-16T23:30:00' },
          { kind: 'prototype', title: 'Tray Popup Interactive', route: '/dev/tray', description: 'Interactive prototype: Layered + Hero layouts, settings panel (expand/drawer/overlay), login view, theme/scale switching', date: '2026-02-16T23:00:00' },
          { kind: 'exploration', title: 'tray-popup-v2', file: 'desktop/tray-popup-v2.html', description: 'v2 — bolder, bigger: Panorama (wide+progress), Spotlight (ring timer), Workspace (two-column), Pulse (team-aware)', date: '2026-02-16T22:00:00' },
          { kind: 'exploration', title: 'tray-popup', file: 'desktop/tray-popup.html', description: 'v1 — 2 variants (Layered, Hero) × 2 states (idle, tracking)', date: '2026-02-16T21:00:00' },
        ],
      },
    ],
  },
];

// Sort groups within each section by date descending (newest first)
for (const section of LAB_SECTIONS) {
  section.groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  // Also sort items within each group by date descending
  for (const group of section.groups) {
    group.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

/** Flat list of all groups across all sections (for backward compat) */
export const LAB_GROUPS: LabFeatureGroup[] = LAB_SECTIONS.flatMap((s) => s.groups);
