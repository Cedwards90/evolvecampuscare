import {
  LayoutDashboard,
  FileText,
  Clock,
  WifiOff,
  Users,
  BarChart3,
  Settings,
  Globe,
  HelpCircle,
  Shield,
  MessageSquare,
  FolderOpen,
  Building2,
  ClipboardList,
  UserCog,
  FileBarChart,
  QrCode,
  Sparkles,
  ClipboardCheck,
  Timer,
  Heart,
  NotebookPen,
  CalendarDays,
  HeartHandshake,
  MoreHorizontal,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

/**
 * Canonical, workflow-based routes.
 * Legacy literal URLs are redirected to these (see LEGACY_REDIRECTS).
 */
export const ROUTES = {
  dashboard: '/dashboard',
  messages: '/messages',
  settings: '/settings',
  support: '/support',
  resources: '/resources',

  // Requests workflow
  requests: '/requests',
  requestNew: '/requests/new',
  requestsMine: '/requests/mine',
  requestsDrafts: '/requests/drafts',
  requestsQueue: '/requests/queue',

  // Students workflow
  students: '/students',

  // Staff / admin
  admin: '/admin',
  appointments: '/appointments',
  reports: '/reports',
  reportsStudent: '/reports/student',
  reportsOrganization: '/reports/organization',
} as const;

/** Old literal paths -> new canonical paths. Kept forever so bookmarks/QR/emails work. */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/student-submitting-a-support-request': ROUTES.requestNew,
  '/student/support-request': ROUTES.requestNew,
  '/student-tracking-request-status-scheduling-meeting': ROUTES.requestsMine,
  '/student-creating-offline-draft-request': ROUTES.requestsDrafts,
  '/case-manager-managing-student-requests': ROUTES.requestsQueue,
  '/admin-monitoring-reassigning-requests': ROUTES.admin,
  '/student-folders': ROUTES.students,
};

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
  badge?: number;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const ALL: AppRole[] = ['student', 'case_manager', 'admin', 'org_admin'];
const STAFF: AppRole[] = ['case_manager', 'admin', 'org_admin'];

/**
 * Intent-based navigation. One entry per destination — no duplicate labels.
 * Role filtering happens at render time.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    items: [
      { label: 'Home', href: ROUTES.dashboard, icon: LayoutDashboard, roles: ALL },
      { label: 'Messages', href: ROUTES.messages, icon: MessageSquare, roles: ALL },
    ],
  },
  {
    id: 'get-help',
    label: 'Get Help',
    items: [
      { label: 'Submit a request', href: ROUTES.requestNew, icon: FileText, roles: ['student'] },
      { label: 'My requests', href: ROUTES.requestsMine, icon: Clock, roles: ['student'] },
      { label: 'Drafts', href: ROUTES.requestsDrafts, icon: WifiOff, roles: ['student'] },
    ],
  },
  {
    id: 'my-progress',
    label: 'My Progress',
    items: [
      { label: 'Surveys', href: '/surveys', icon: ClipboardList, roles: ['student'] },
      { label: 'Weekly check-in', href: '/check-in', icon: HeartHandshake, roles: ['student'] },
      { label: 'My submissions', href: '/my-submissions', icon: ClipboardCheck, roles: ['student'] },
      { label: 'Resources', href: ROUTES.resources, icon: Heart, roles: ['student'] },
    ],
  },
  {
    id: 'caseload',
    label: 'Caseload',
    items: [
      { label: 'Request queue', href: ROUTES.requestsQueue, icon: Users, roles: ['case_manager', 'org_admin'] },
      { label: 'Students', href: ROUTES.students, icon: FolderOpen, roles: STAFF },
      { label: 'Appointments', href: ROUTES.appointments, icon: CalendarDays, roles: STAFF },
      { label: 'Resources', href: ROUTES.resources, icon: Heart, roles: STAFF },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { label: 'Admin overview', href: ROUTES.admin, icon: BarChart3, roles: ['admin', 'org_admin'] },
      { label: 'All requests', href: ROUTES.requests, icon: FileText, roles: ['admin', 'org_admin'] },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { label: 'Users', href: '/admin/users', icon: Shield, roles: ['admin'] },
      { label: 'Case managers', href: '/admin/case-managers', icon: UserCog, roles: ['admin', 'org_admin'] },
      { label: 'Organizations', href: '/admin/organizations', icon: Building2, roles: ['admin'] },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    items: [
      { label: 'Reports', href: ROUTES.reports, icon: FileBarChart, roles: STAFF },
      { label: 'Case notes', href: '/admin/case-notes', icon: NotebookPen, roles: STAFF },
      { label: 'Surveys', href: '/admin/surveys', icon: ClipboardList, roles: STAFF },
      { label: 'Request analytics', href: '/admin/request-analytics', icon: BarChart3, roles: ['admin', 'org_admin'] },
      { label: 'Impact', href: '/admin/impact', icon: Sparkles, roles: ['admin', 'org_admin'] },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    items: [
      { label: 'My hours', href: '/time-tracking', icon: Timer, roles: ['case_manager'] },
      { label: 'Time reports', href: '/admin/time-tracking', icon: Timer, roles: ['admin', 'org_admin'] },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { label: 'QR codes', href: '/admin/qr-codes', icon: QrCode, roles: ['admin', 'org_admin'] },
      { label: 'Manage resources', href: '/admin/resources', icon: Heart, roles: STAFF },
      { label: 'NDA', href: '/admin/nda', icon: FileText, roles: ['admin'] },
      { label: 'Login activity', href: '/admin/login-activity', icon: Clock, roles: ['admin', 'org_admin'] },
      { label: 'Data export', href: '/admin/data-export', icon: Download, roles: ['admin', 'org_admin'] },
    ],
  },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: 'Help Center', href: ROUTES.support, icon: HelpCircle, roles: ALL },
  { label: 'Settings', href: ROUTES.settings, icon: Settings, roles: ALL },
];

/** Minimum-safe nav shown when a role hasn't loaded yet. */
export const FALLBACK_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: ROUTES.dashboard, icon: LayoutDashboard, roles: [] },
  { label: 'Settings', href: ROUTES.settings, icon: Settings, roles: [] },
  { label: 'Help Center', href: ROUTES.support, icon: HelpCircle, roles: [] },
];

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...BOTTOM_NAV_ITEMS,
];

export function navGroupsForRole(role: AppRole | null): NavGroup[] {
  if (!role) return [];
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/** 4 primary destinations per role for the mobile tab bar; a 5th "More" tab is added by the UI. */
export interface TabItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const MORE_TAB: TabItem = { label: 'More', href: '#more', icon: MoreHorizontal };

export function mobileTabsForRole(role: AppRole | null): TabItem[] {
  switch (role) {
    case 'student':
      return [
        { label: 'Home', href: ROUTES.dashboard, icon: LayoutDashboard },
        { label: 'Get help', href: ROUTES.requestNew, icon: FileText },
        { label: 'Surveys', href: '/surveys', icon: ClipboardList },
        { label: 'Messages', href: ROUTES.messages, icon: MessageSquare },
      ];
    case 'case_manager':
      return [
        { label: 'Home', href: ROUTES.dashboard, icon: LayoutDashboard },
        { label: 'Queue', href: ROUTES.requestsQueue, icon: Users },
        { label: 'Students', href: ROUTES.students, icon: FolderOpen },
        { label: 'Reports', href: ROUTES.reports, icon: FileBarChart },
      ];
    case 'admin':
    case 'org_admin':
      return [
        { label: 'Home', href: ROUTES.dashboard, icon: LayoutDashboard },
        { label: 'Requests', href: ROUTES.requests, icon: FileText },
        { label: 'Students', href: ROUTES.students, icon: FolderOpen },
        { label: 'Reports', href: ROUTES.reports, icon: FileBarChart },
      ];
    default:
      return [
        { label: 'Home', href: ROUTES.dashboard, icon: LayoutDashboard },
        { label: 'Help', href: ROUTES.support, icon: HelpCircle },
        { label: 'Settings', href: ROUTES.settings, icon: Settings },
        { label: 'Language', href: ROUTES.settings, icon: Globe },
      ];
  }
}

export function labelForPath(pathname: string): string {
  const match = ALL_NAV_ITEMS.find((item) => item.href === pathname);
  return match?.label ?? 'Home';
}
