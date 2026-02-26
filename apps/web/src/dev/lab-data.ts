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
        name: 'adjust-time',
        id: 'adjust-time-lab',
        description: 'Adjust entry time dialog — 10 UI approaches for adding/removing time with duration picker',
        date: '2026-02-26T20:00:00',
        items: [
          { kind: 'exploration', title: 'V1 — Spinner Columns', file: 'web/adjust-e208.html', description: 'Three vertical spinner columns (hours, minutes, seconds) with up/down chevron buttons. +/− toggle pill. Summary row with adjustment and new total.', date: '2026-02-26T20:00:00' },
          { kind: 'exploration', title: 'V2 — Slider Rail', file: 'web/adjust-ee20.html', description: 'Horizontal range slider (−120 to +120 min) with labeled ticks. Fine-tune buttons (±1m, ±5m). Seconds input for precision.', date: '2026-02-26T20:10:00' },
          { kind: 'exploration', title: 'V3 — Numpad', file: 'web/adjust-614e.html', description: 'Calculator-style 3×4 numpad. Digits fill HH:MM:SS display right-to-left. +/− toggle, backspace, clear. Horizontal flow summary.', date: '2026-02-26T20:20:00' },
          { kind: 'exploration', title: 'V4 — Preset Chips', file: 'web/adjust-3a5b.html', description: 'Quick-select preset buttons: Add row (+5m to +2h) and Remove row (−5m to −2h). Custom chip reveals minutes input.', date: '2026-02-26T20:30:00' },
          { kind: 'exploration', title: 'V5 — Radial Dial', file: 'web/adjust-a766.html', description: 'SVG circular clock dial with 60 tick marks and draggable handle. Arc fill shows minutes. Hour stepper for >60m adjustments.', date: '2026-02-26T20:40:00' },
          { kind: 'exploration', title: 'V6 — Segmented Stepper', file: 'web/adjust-0d58.html', description: 'Three horizontal rows (hrs/min/sec) each with large −/+ buttons flanking a centered value. Summary bar with net adjustment and new total.', date: '2026-02-26T20:50:00' },
          { kind: 'exploration', title: 'V7 — Timeline Bar', file: 'web/adjust-7f61.html', description: 'Horizontal bar representing current duration. Draggable handle extends/retracts with colored zone. Quick buttons for common adjustments.', date: '2026-02-26T21:00:00' },
          { kind: 'exploration', title: 'V8 — Inline Equation', file: 'web/adjust-1b52.html', description: 'Math expression: 2:15 + 0:30 = 2:45. Toggleable operator, editable operand with h/m inputs. Preset chips below.', date: '2026-02-26T21:10:00' },
          { kind: 'exploration', title: 'V9 — Clock Face', file: 'web/adjust-d449.html', description: 'SVG analog clock with 60 minute ticks. Click to set minutes (snaps to 5). Colored arc fill. +/− toggle and hours input.', date: '2026-02-26T21:20:00' },
          { kind: 'exploration', title: 'V10 — Minimal Input', file: 'web/adjust-b49e.html', description: 'Single text input parsing natural language: "+30m", "−1h15m", "1:30". Real-time parse feedback. Quick shortcut chips.', date: '2026-02-26T21:30:00' },
        ],
      },
      {
        name: 'segments',
        id: 'segments-lab',
        description: 'Expandable entry rows — time block visibility, "Move to new entry" action, 10 UI approaches',
        date: '2026-02-26T18:00:00',
        items: [
          { kind: 'exploration', title: 'V1 — Accordion Drawer', file: 'web/segments-a1b2.html', description: 'Timeline of time blocks slides down below the entry. Badge shows block count. Hover blocks for "Move to new entry".', date: '2026-02-26T18:00:00' },
          { kind: 'exploration', title: 'V2 — Inline Timeline Strip', file: 'web/segments-c3d4.html', description: 'Mini proportional color bar always visible. Click entry to expand card-style block rows with color accent.', date: '2026-02-26T18:10:00' },
          { kind: 'exploration', title: 'V3 — Side Panel', file: 'web/segments-e5f6.html', description: 'Click entry to open time blocks in a sticky side panel. No layout shift — entry list stays intact.', date: '2026-02-26T18:20:00' },
          { kind: 'exploration', title: 'V4 — Nested Cards', file: 'web/segments-g7h8.html', description: 'Each time block becomes a mini card in a responsive grid below the entry. Cards show time, duration, type.', date: '2026-02-26T18:30:00' },
          { kind: 'exploration', title: 'V5 — Stacked Rows', file: 'web/segments-i9j0.html', description: 'Indented sub-rows with same grid alignment as parent. Minimal hierarchy — just indentation and lighter styling.', date: '2026-02-26T18:40:00' },
          { kind: 'exploration', title: 'V6 — Popover Detail', file: 'web/segments-k2m3.html', description: 'Floating popover with time block list. No page layout shift — overlays the entries.', date: '2026-02-26T18:50:00' },
          { kind: 'exploration', title: 'V7 — Gantt Strip', file: 'web/segments-n4p5.html', description: 'Mini Gantt chart showing when blocks happened on a day timeline (8am–6pm). Hover bars for tooltip + action.', date: '2026-02-26T19:00:00' },
          { kind: 'exploration', title: 'V8 — Pill Strip', file: 'web/segments-q6r7.html', description: 'Always-visible scrollable time block pills below multi-block entries. Click pill for context menu.', date: '2026-02-26T19:10:00' },
          { kind: 'exploration', title: 'V9 — Left Rail', file: 'web/segments-s8t9.html', description: 'Colored vertical rail on left acts as expand trigger. Block count below rail. Click to reveal blocks.', date: '2026-02-26T19:20:00' },
          { kind: 'exploration', title: 'V10 — Bottom Sheet', file: 'web/segments-u0v1.html', description: 'Slide-up bottom sheet with time blocks. Entry list dims behind. Mobile-friendly with drag handle.', date: '2026-02-26T19:30:00' },
        ],
      },
      {
        name: 'entries',
        id: 'entries-lab',
        description: 'Time entries page — day groups, inline editing, timer bar flair',
        date: '2026-02-15T18:38:00',
        items: [
          { kind: 'exploration', title: 'switch-confirm-a7f2 — Timer Switch Confirmation', file: 'timer/switch-confirm-a7f2.html', description: '5 confirmation variants for switching timers: V1 The Swap (two-card handoff), V2 The Scoreboard (duration hero), V3 The Countdown (auto-proceed toast), V4 The Clash (VS split-screen), V5 The Inline (in-place expansion)', date: '2026-02-23T20:00:00' },
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
              { kind: 'prototype', title: 'Release Notes Readability', route: '/dev/release-notes', description: 'Monospace terminal feel, bigger text, single column, no category grouping. 3 variants: A) Terminal Log (prefix symbols), B) CHANGELOG.md file look, C) Prefix Symbols + hover tint', date: '2026-02-22T10:00:00' },
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
    product: 'Auth',
    id: 'auth',
    groups: [
      {
        name: 'login-screens',
        id: 'login-screens-lab',
        description: 'Logto sign-in experience — 5 visual directions for branded login',
        date: '2026-02-23T08:00:00',
        items: [
          { kind: 'exploration', title: 'login-bg-c5a1 — Background Logo + Wordmark', file: 'login/login-bg-c5a1.html', description: 'Background watermark with full combo logo (symbol + TERNITY): V1 Corner Signature (chosen), V2 Editorial Crop, V3 Quiet Footer, V4 Ambient Floor', date: '2026-02-23T17:00:00' },
          { kind: 'exploration', title: 'login-bg-e7a3 — Background Symbol Only', file: 'login/login-bg-e7a3.html', description: 'Background watermark with hourglass symbol only: V1 Centered, V2 Corner Mark, V3 Offset Crop, V4 Ambient Glow', date: '2026-02-23T16:00:00' },
          { kind: 'exploration', title: 'login-a1b2 — Abyss', file: 'login/login-a1b2.html', description: 'Direction 1: Minimal Dark — no background image, pure gradient, subtle teal border, premium SaaS feel (Linear/Vercel/Stripe)', date: '2026-02-23T07:55:00' },
          { kind: 'exploration', title: 'login-c3d4 — Atmosphere', file: 'login/login-c3d4.html', description: 'Direction 2: Cinematic Photo — surreal hourglass desert background, heavy frosted glass, fade-in animation, movie-poster mood', date: '2026-02-23T07:56:00' },
          { kind: 'exploration', title: 'login-e5f6 — Terminal', file: 'login/login-e5f6.html', description: 'Direction 3: Monospace Tech — terminal/code editor card, scanline texture, cursor blink animation, hacker aesthetic', date: '2026-02-23T07:58:00' },
          { kind: 'exploration', title: 'login-g7h8 — Glass Nebula', file: 'login/login-g7h8.html', description: 'Direction 4: Teal Gradient + Glass — nebula background, gradient border, breathing glow, futuristic sci-fi', date: '2026-02-23T07:59:00' },
          { kind: 'exploration', title: 'login-i9j0 — Warm Presence', file: 'login/login-i9j0.html', description: 'Direction 5: Natural + Warm — autumn path background, warm amber accent, rounded card, cozy and approachable', date: '2026-02-23T08:00:00' },
          { kind: 'exploration', title: 'login-k2m3 — Deep Glow', file: 'login/login-k2m3.html', description: 'Direction 6: Abyss + Nebula hybrid — dark base with subtle teal radial glow behind card, gradient border at 30% opacity, no image, still and refined', date: '2026-02-23T08:30:00' },
          { kind: 'exploration', title: 'login-n4p5 — Mist', file: 'login/login-n4p5.html', description: 'Direction 7: Abyss with hidden depth — teal particles image at 12% opacity, barely perceptible texture, slight card translucency, no animations', date: '2026-02-23T08:35:00' },
        ],
      },
    ],
  },
  {
    product: 'Desktop App',
    id: 'desktop',
    groups: [
      {
        name: 'start-stop',
        id: 'desktop-start-stop-lab',
        description: 'Start/stop button — visual styles, glassiness, animations, timer style collection across themes',
        date: '2026-02-22T15:12:00',
        items: [
          { kind: 'prototype', title: 'Timer Looks', route: '/dev/timer-looks', description: 'Focused prototype: Original, Elastic Jelly, Magnetic — inline + full-width, experimenting with card looks', date: '2026-02-22T16:00:00' },
          { kind: 'prototype', title: 'Animation Showcase', route: '/dev/start-stop', description: 'Original + 10 animation styles (Shockwave, Elastic, Glitch, Aurora, Particles, Neon, Magnetic, Heartbeat, Liquid, Gravity) — inline + full-width', date: '2026-02-22T15:30:00' },
          { kind: 'exploration', title: 'start-stop-d8f4', file: 'desktop/start-stop-d8f4.html', description: 'Timer Style Collection — 6 styles × 6 themes, interactive ripple animation. Ghost Glass, Frosted Bar, Solid Pill, Neon Wire, Soft Slab, Mono Edge with default theme pairings', date: '2026-02-22T15:12:00' },
          { kind: 'exploration', title: 'start-stop-c5d2', file: 'desktop/start-stop-c5d2.html', description: 'Animation exploration — A2 Frosted + B2 Frosted Bar with 6 animations each (Snap, Bounce, Glow Burst, Ripple, Jelly, Slide Swap). Interactive click-to-toggle', date: '2026-02-22T15:04:00' },
          { kind: 'exploration', title: 'start-stop-b3e9', file: 'desktop/start-stop-b3e9.html', description: 'Glassiness exploration — 3 families (Ghost Glass, Flush Bar, Minimal Text) × 4 glass levels each. 12 total variants', date: '2026-02-22T14:57:00' },
          { kind: 'exploration', title: 'start-stop-a1f7', file: 'desktop/start-stop-a1f7.html', description: '10 visual variants + current button recreation. Ghost Glass, Pill Morph, Neon Wire, Gradient Flow, Circle Icon, Glass Slab, Ring Pulse, Flush Bar, Split Tone, Minimal Text', date: '2026-02-22T14:46:00' },
        ],
      },
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
          { kind: 'prototype', title: 'Switch Confirm Interactive', route: '/dev/switch-confirm', description: 'Interactive prototype: V1 Ripple (fullscreen overlay + pulsing ring), V3 Gravity Drop (two cards drop from top), V9 Split Horizon (dramatic full-screen split with live timers)', date: '2026-02-23T23:00:00' },
          { kind: 'exploration', title: 'switch-confirm-f4a9 — 10 Fresh Variants', file: 'desktop/switch-confirm-f4a9.html', description: '10 fresh confirmation variants: V1 Ripple, V2 Morph Bar, V3 Gravity Drop, V4 Slide Rail, V5 Stack Peek, V6 Crossfade, V7 Flip Card, V8 Ribbon, V9 Split Horizon, V10 Halo', date: '2026-02-23T22:30:00' },
          { kind: 'exploration', title: 'switch-confirm-b3e1 — Desktop Switch Confirmation', file: 'desktop/switch-confirm-b3e1.html', description: '5 desktop variants for 340px tray popup: D1 Overlay, D2 Slide-Up Sheet, D3 Inline Expansion, D4 Full Replacement, D5 Toast Banner', date: '2026-02-23T21:00:00' },
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
