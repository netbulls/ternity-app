import {
  Timer,
  List,
  BarChart3,
  Calendar,
  Palmtree,
  Settings,
  Users,
  FolderKanban,
  Download,
  Settings2,
  Palette,
  Link2,
} from 'lucide-react';

// ── Nav item definition ─────────────────────────────────────────────

export interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  /** Only visible to admins */
  admin?: boolean;
  /** Grouped under a parent (e.g. Settings > Profile) */
  parent?: string;
  /** Searchable keywords beyond the label */
  keywords?: string[];
  /** Hide from palette (e.g. placeholder pages not yet built) */
  hidden?: boolean;
}

// ── Main sidebar navigation (product pages only) ────────────────────

export const trackingNav: NavItem[] = [
  { to: '/', label: 'My Day', icon: Timer, keywords: ['home', 'timer', 'today'] },
  { to: '/entries', label: 'Entries', icon: List, keywords: ['time', 'history', 'log'] },
  { to: '/calendar', label: 'Calendar', icon: Calendar, keywords: ['schedule', 'dates'] },
  { to: '/leave', label: 'Leave', icon: Palmtree, keywords: ['holiday', 'vacation', 'absence'] },
  {
    to: '/reports',
    label: 'Reports',
    icon: BarChart3,
    keywords: ['dashboard', 'analytics', 'stats'],
  },
];

// ── Admin pages (shown in user menu, not sidebar) ───────────────────

export const adminNav: NavItem[] = [
  {
    to: '/users',
    label: 'People',
    icon: Users,
    admin: true,
    keywords: ['team', 'members', 'users'],
  },
  { to: '/projects', label: 'Projects', icon: FolderKanban, admin: true, keywords: ['clients'] },
];

// ── Settings sub-navigation ─────────────────────────────────────────

export const settingsNav: NavItem[] = [
  {
    to: '/settings/general',
    label: 'General',
    icon: Settings2,
    parent: 'Settings',
    keywords: ['account', 'profile', 'project', 'timer'],
  },
  {
    to: '/settings/appearance',
    label: 'Appearance',
    icon: Palette,
    parent: 'Settings',
    keywords: ['theme', 'scale', 'dark', 'light'],
  },
  {
    to: '/settings/integrations',
    label: 'Integrations',
    icon: Link2,
    parent: 'Settings',
    keywords: ['jira', 'connect'],
  },
  {
    to: '/settings/downloads',
    label: 'Downloads',
    icon: Download,
    parent: 'Settings',
    keywords: ['desktop', 'app', 'install'],
  },
];

// ── Top-level pages for palette (not in sidebar) ────────────────────

export const settingsTopNav: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings, keywords: ['preferences', 'config'] },
];

// ── All items (for palette) ─────────────────────────────────────────

export function getAllNavItems(isAdmin: boolean): NavItem[] {
  return [...trackingNav, ...(isAdmin ? adminNav : []), ...settingsTopNav, ...settingsNav].filter(
    (item) => !item.hidden,
  );
}
