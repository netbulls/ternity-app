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
  children?: LabFeatureGroup[];
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
        name: 'presence',
        id: 'presence-lab',
        description: 'Presence & availability — team board, my day, away flow, schedule, leave, admin reconciliation, quarterly balance, lista obecności',
        date: '2026-02-17T21:00:00',
        items: [
          { kind: 'exploration', title: 'presence-a7d4', file: 'web/presence-a7d4.html', description: 'Full system — 8 screens: team board, my day, away flow, schedule setup, leave request, admin reconciliation, quarterly balance, attendance record', date: '2026-02-17T21:00:00' },
          { kind: 'prototype', title: 'Presence System', route: '/dev/presence', description: 'Interactive prototype: team board with live status, my day reconciliation, schedule editor, leave request, admin views, quarterly balance, attendance record', date: '2026-02-17T22:00:00' },
        ],
      },
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
          { kind: 'exploration', title: 'entry-rows-a3c7', file: 'web/entry-rows-a3c7.html', description: 'Entry row variants — multi-line descriptions and project names with consistent row heights (A-H)', date: '2026-02-17T18:00:00' },
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
        name: 'downloads',
        id: 'downloads-lab',
        description: 'Downloads page — layout, channels, release notes',
        date: '2026-02-21T13:00:00',
        items: [],
        children: [
          {
            name: 'release notes',
            id: 'downloads-notes-lab',
            description: 'Prominence, placement, and formatting within the download card',
            date: '2026-02-21T12:00:00',
            items: [
              { kind: 'exploration', title: 'release-notes-0ffa', file: 'web/release-notes-0ffa.html', description: 'Multi-category stress test — G1a (colored dots) and G1b (accent bars) with 2, 3, and 4 changelog categories. CSS grid vs flexbox wrap layout.', date: '2026-02-21T14:00:00' },
              { kind: 'exploration', title: 'release-notes-b1ba', file: 'web/release-notes-b1ba.html', description: 'G1 content styling — 4 treatments: a) Colored dots + dashes, b) Left accent bars per category, c) Badge pills with icons, d) Single column minimal. All interactive.', date: '2026-02-21T13:00:00' },
              { kind: 'exploration', title: 'release-notes-9780', file: 'web/release-notes-9780.html', description: 'G focused — ribbon after downloads, expands down. 3 sub-variants: G1) Flat two-column, G2) Teal callout card, G3) Promoted section with header bar. Interactive.', date: '2026-02-21T12:00:00' },
              { kind: 'exploration', title: 'release-notes-c2f4', file: 'web/release-notes-c2f4.html', description: '3 variants: G) Ribbon→Hero combo (F+C), H1) Toggleable side drawer via button, H2) Side tab trigger on card edge', date: '2026-02-21T11:00:00' },
              { kind: 'exploration', title: 'release-notes-a7f3', file: 'web/release-notes-a7f3.html', description: '6 variants: A) Open by default, B) Promoted section with teal accent, C) Hero callout above downloads, D) Inline with badge, E) Side panel, F) Summary ribbon', date: '2026-02-21T10:00:00' },
              { kind: 'exploration', title: 'downloads-c3e9', file: 'web/downloads-c3e9.html', description: 'Multi-card era — 3 variants: K1) Expandable accordion per card, K2) Clickable version popover, K3) Shared panel below cards', date: '2026-02-19T20:00:00' },
            ],
          },
          {
            name: 'channels',
            id: 'downloads-channels-lab',
            description: 'Release vs snapshot toggle, version display, architecture rows',
            date: '2026-02-19T19:00:00',
            items: [
              { kind: 'exploration', title: 'downloads-f4a7', file: 'web/downloads-f4a7.html', description: 'Aligned — consistent badge-pair channel selector (active=filled, inactive=muted outline), CSS subgrid for cross-card row alignment', date: '2026-02-19T19:00:00' },
              { kind: 'exploration', title: 'downloads-e8a1', file: 'web/downloads-e8a1.html', description: 'J1 Refined — app-style segmented control (bg-primary/8), Release/Snapshot channels, arch rows per card', date: '2026-02-19T18:00:00' },
              { kind: 'exploration', title: 'downloads-d9f3', file: 'web/downloads-d9f3.html', description: 'Channel + Architecture — 3 variants: J1) Arch Rows, J2) Primary + Expand, J3) Arch Pills', date: '2026-02-19T17:00:00' },
              { kind: 'exploration', title: 'downloads-a2c5', file: 'web/downloads-a2c5.html', description: 'Channel switcher — 3 variants: H1) Pill Toggle, H2) Version Dropdown, H3) Tab Underline', date: '2026-02-19T16:00:00' },
              { kind: 'exploration', title: 'downloads-b3d7', file: 'web/downloads-b3d7.html', description: 'Version states — 3 variants: G1) Badge + Version Row, G2) Status Header, G3) Inline Version', date: '2026-02-19T15:00:00' },
            ],
          },
          {
            name: 'page layout',
            id: 'downloads-page-lab',
            description: 'Multi-product structure, framework tabs, platform selectors, download rows',
            date: '2026-02-20T00:30:00',
            items: [
              { kind: 'prototype', title: 'Downloads Page', route: '/dev/downloads', description: 'L1 implementation — framework tabs (top), platform tabs (middle), channel badges with disabled state + version (bottom). 3 mock products: Tauri (release+snapshot), Flutter (snapshot only), Electron (release only)', date: '2026-02-20T00:30:00' },
              { kind: 'exploration', title: 'downloads-e5b3', file: 'web/downloads-e5b3.html', description: 'L1 Interactive mockup — framework tabs switch all content (desc, badges, version, downloads, notes). Channel toggle, platform tabs, empty states. Data-driven.', date: '2026-02-19T22:00:00' },
              { kind: 'exploration', title: 'downloads-d7f2', file: 'web/downloads-d7f2.html', description: 'Back to basics — 5 variants: L1) Tabbed Product Selector, L2) Smart Card + Dropdown, L3) Pill Accordion, L4) Hero + Table, L5) Slim Stacked Cards', date: '2026-02-19T21:00:00' },
              { kind: 'exploration', title: 'downloads-f1a9', file: 'web/downloads-f1a9.html', description: 'F refined — 3 sub-variants: F1) Flex Stretch, F2) Grid Rows, F3) Icon Cards', date: '2026-02-19T14:00:00' },
              { kind: 'exploration', title: 'downloads-e4b2', file: 'web/downloads-e4b2.html', description: 'App-first layouts — 3 variants: D) Big CTA Hero, E) Split Layout, F) Platform First', date: '2026-02-19T13:00:00' },
              { kind: 'exploration', title: 'downloads-c7e1', file: 'web/downloads-c7e1.html', description: 'Multi-product layouts — 3 variants: A) Framework Tabs, B) Comparison Cards, C) Hero + List', date: '2026-02-19T12:00:00' },
              { kind: 'exploration', title: 'downloads-a4f8', file: 'web/downloads-a4f8.html', description: 'Initial explorations — 3 variants: A) Hero + Platform Grid, B) Product Card + Tabs, C) Minimal Table', date: '2026-02-18T00:00:00' },
            ],
          },
        ],
      },
      {
        name: 'project-management',
        id: 'project-management-lab',
        description: 'Client & project CRUD — tables, dialogs, active/inactive status',
        date: '2026-02-16T23:30:00',
        items: [
          { kind: 'exploration', title: 'projects-c4a1', file: 'web/projects-c4a1.html', description: 'v3 — scope tabs, client drill-down with breadcrumb, "New" dropdown, inline "+ New Client", deactivate cascade warning', date: '2026-02-17T01:30:00' },
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
        name: 'timer-section',
        id: 'desktop-timer-lab',
        description: 'Timer section UI — idle/start/running states, empty start flow, incomplete entry indicators',
        date: '2026-02-17T23:00:00',
        items: [
          { kind: 'exploration', title: 'timer-section-v6', file: 'desktop/timer-section-v6.html', description: 'v6 — full flow: idle → empty start → incomplete → complete. 8 designs: Ghost Input, Split Blade, Holographic, Radar Sweep, Marquee Stack, Brutalist, Liquid Glass, Typewriter', date: '2026-02-17T23:00:00' },
          { kind: 'exploration', title: 'timer-section-v5', file: 'desktop/timer-section-v5.html', description: 'v5 — 8 designs with real data lengths: Split Horizon, Neon Frame, Command Line, Floating Layers, Accent Rail, Ring Counter, Billboard, Gradient Wave', date: '2026-02-17T20:00:00' },
          { kind: 'exploration', title: 'timer-section-v4', file: 'desktop/timer-section-v4.html', description: 'v4 — refined variants: Glass Tower Refined, Theater Evolved, Stacked Cards, Wide Timer Bar', date: '2026-02-17T17:58:00' },
          { kind: 'exploration', title: 'timer-section-v3', file: 'desktop/timer-section-v3.html', description: 'v3 — 8 designs: Command Bar, Split Deck, Orbital, Neon Strip, Glass Tower, Theater, Radar, Brutalist Tape', date: '2026-02-17T17:36:00' },
        ],
      },
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

// Sort groups (and nested children) within each section by date descending (newest first)
function sortGroups(groups: LabFeatureGroup[]) {
  groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const group of groups) {
    group.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (group.children) sortGroups(group.children);
  }
}
for (const section of LAB_SECTIONS) {
  sortGroups(section.groups);
}

/** Flat list of all groups across all sections (for backward compat) */
function flattenGroups(groups: LabFeatureGroup[]): LabFeatureGroup[] {
  return groups.flatMap((g) => [g, ...(g.children ? flattenGroups(g.children) : [])]);
}
export const LAB_GROUPS: LabFeatureGroup[] = LAB_SECTIONS.flatMap((s) => flattenGroups(s.groups));
