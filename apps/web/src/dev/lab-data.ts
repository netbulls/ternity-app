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
  date: string;
  items: LabItem[];
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

export const LAB_GROUPS: LabFeatureGroup[] = [
  {
    name: 'entries',
    id: 'entries-lab',
    date: '2026-02-15T18:38:00',
    items: [
      { kind: 'exploration', title: 'entries-110c', file: 'entries-110c.html', description: 'Approved v2 with day groups and timer', date: '2026-02-15T18:38:00' },
      { kind: 'exploration', title: 'entries', file: 'entries.html', description: 'Day groups and timer bar', date: '2026-02-14T23:29:00' },
      { kind: 'exploration', title: 'entries-v1', file: 'entries-v1.html', description: 'Earlier layout iteration', date: '2026-02-14T23:29:00' },
      { kind: 'prototype', title: 'Timer Flair', route: '/dev/flair', description: 'Timer bar flair, inline editing, project picker animations', date: '2026-02-15T10:00:00' },
    ],
  },
  {
    name: 'impersonation',
    id: 'impersonation-lab',
    date: '2026-02-15T17:11:00',
    items: [
      { kind: 'exploration', title: 'impersonation-8f3d', file: 'impersonation-8f3d.html', description: 'Admin banner and controls', date: '2026-02-15T17:01:00' },
      { kind: 'exploration', title: 'impersonation-4a1c', file: 'impersonation-4a1c.html', description: 'Earlier iteration', date: '2026-02-15T17:11:00' },
    ],
  },
  {
    name: 'user-management',
    id: 'user-management-lab',
    date: '2026-02-14T19:12:00',
    items: [
      { kind: 'exploration', title: 'user-management', file: 'user-management.html', description: 'Table, stat cards, filters, bulk actions', date: '2026-02-14T19:12:00' },
    ],
  },
  {
    name: 'general',
    id: 'general-lab',
    date: '2026-02-14T19:12:00',
    items: [
      { kind: 'exploration', title: 'design-preview', file: 'design-preview.html', description: 'Typography, colors, spacing, primitives', date: '2026-02-14T19:12:00' },
      { kind: 'exploration', title: 'phase2-options', file: 'phase2-options.html', description: 'Timer layouts, icon library comparison', date: '2026-02-13T14:30:00' },
      { kind: 'exploration', title: 'theme-proposals', file: 'theme-proposals.html', description: 'All 6 theme palettes side-by-side', date: '2026-02-13T16:45:00' },
    ],
  },
];
