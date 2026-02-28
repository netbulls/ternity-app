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
  User,
  Briefcase,
  Link2,
  Bell,
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

// ── Main navigation ─────────────────────────────────────────────────

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

export const adminNav: NavItem[] = [
  {
    to: '/users',
    label: 'Users',
    icon: Users,
    admin: true,
    keywords: ['team', 'members', 'people'],
  },
  { to: '/projects', label: 'Projects', icon: FolderKanban, admin: true, keywords: ['clients'] },
];

export const bottomNav: NavItem[] = [
  { to: '/downloads', label: 'Downloads', icon: Download, keywords: ['desktop', 'app'] },
  { to: '/settings', label: 'Settings', icon: Settings, keywords: ['preferences', 'config'] },
];

// ── Settings sub-navigation ─────────────────────────────────────────

export const settingsNav: NavItem[] = [
  {
    to: '/settings/general',
    label: 'General',
    icon: Settings2,
    parent: 'Settings',
    keywords: ['theme', 'scale', 'appearance'],
  },
  {
    to: '/settings/profile',
    label: 'Profile',
    icon: User,
    parent: 'Settings',
    keywords: ['name', 'account'],
  },
  {
    to: '/settings/work',
    label: 'Work',
    icon: Briefcase,
    parent: 'Settings',
    keywords: ['hours', 'schedule'],
    hidden: true,
  },
  {
    to: '/settings/integrations',
    label: 'Integrations',
    icon: Link2,
    parent: 'Settings',
    keywords: ['jira', 'connect'],
  },
  {
    to: '/settings/notifications',
    label: 'Notifications',
    icon: Bell,
    parent: 'Settings',
    keywords: ['alerts'],
    hidden: true,
  },
];

// ── All items (for palette) ─────────────────────────────────────────

export function getAllNavItems(isAdmin: boolean): NavItem[] {
  return [...trackingNav, ...(isAdmin ? adminNav : []), ...bottomNav, ...settingsNav].filter(
    (item) => !item.hidden,
  );
}
