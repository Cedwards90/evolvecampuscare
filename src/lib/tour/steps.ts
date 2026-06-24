import type { AppRole } from '@/types/database';

export interface TourStep {
  title: string;
  description: string;
  /** Optional CSS selector for an element to highlight. If omitted, step renders as a centered modal. */
  element?: string;
  /** Optional path to navigate to before showing this step. */
  navigateTo?: string;
}

const welcomeStep = (name: string): TourStep => ({
  title: `Welcome to Evolve, ${name}! 👋`,
  description:
    "Let's take a 60-second tour of the platform so you know where everything lives. You can skip anytime, and replay it later from the Help Center.",
});

const helpStep: TourStep = {
  title: '❓ Need help later?',
  description:
    "Click the Help icon in the top bar (or 'Help Center' in the sidebar) anytime to read FAQs, contact support, or replay this walkthrough.",
};

const studentSteps = (name: string): TourStep[] => [
  welcomeStep(name),
  {
    title: '🏠 Your Dashboard',
    description:
      'This is your home base. You can see your case manager, pending surveys, weekly check-in reminders, and the status of your requests at a glance.',
    navigateTo: '/dashboard',
  },
  {
    title: '📝 Submit a Support Request',
    description:
      'Need help with academics, finances, housing, or mental health? Submit a request and your assigned case manager will respond. Mark it as Emergency for crisis situations.',
    navigateTo: '/dashboard',
  },
  {
    title: '⏱ Track Your Requests',
    description:
      'See the status of every request you\'ve submitted, schedule meetings with your case manager, and get real-time updates.',
  },
  {
    title: '💬 Messages',
    description:
      'You have a private, secure 1-on-1 chat with your assigned case manager. Use it for quick questions or follow-ups.',
  },
  {
    title: '📋 Weekly Check-Ins & Surveys',
    description:
      'Every few weeks we ask how you\'re doing — your wins, blockers, and mood. These help your case manager support you better. You\'ll also be invited to short Life Skills surveys.',
  },
  {
    title: '🔒 Your Privacy',
    description:
      'Only your assigned case manager and admins can see your information. All data is encrypted and handled under FERPA/GDPR standards.',
  },
  helpStep,
];

const caseManagerSteps = (name: string): TourStep[] => [
  welcomeStep(name),
  {
    title: '🏠 Your Dashboard',
    description:
      'See your assigned students, active requests, recent activity, and AI insights at a glance. Emergency cases are pinned to the top.',
    navigateTo: '/dashboard',
  },
  {
    title: '📂 Manage Requests',
    description:
      'Review, respond to, and resolve student support requests. Use filters to focus on priority, category, or status.',
  },
  {
    title: '👥 Student Folders',
    description:
      'Each student has a full case file: profile, intake, check-ins, certifications, case notes, and submitted plans. You can also generate an AI-powered folder summary.',
  },
  {
    title: '💬 Messages',
    description:
      'Private 1-to-1 messaging with each of your students. Use it to coordinate without waiting for an email.',
  },
  {
    title: '📊 Reports & Surveys',
    description:
      'Generate student progress reports, send check-in or Life Skills surveys, and view aggregated impact metrics.',
  },
  {
    title: '⏱ Time Tracking',
    description:
      'Log the hours you spend supporting students. Entries are reviewed by an admin and exportable to CSV.',
  },
  {
    title: '🔐 Security: MFA Required',
    description:
      'Two-factor authentication is required for all staff. If you haven\'t set it up yet, go to Settings → Security.',
  },
  helpStep,
];

const adminSteps = (name: string, isOrgAdmin: boolean): TourStep[] => [
  welcomeStep(name),
  {
    title: '🏠 Admin Dashboard',
    description: isOrgAdmin
      ? 'Monitor requests, case managers, and students within your organization. Unassigned requests are flagged at the top.'
      : 'Monitor every request across the platform, identify unassigned cases, and reassign work between case managers.',
    navigateTo: '/dashboard',
  },
  {
    title: '👥 People Management',
    description: isOrgAdmin
      ? 'Manage case managers in your organization and view student rosters. Only data for your org(s) is visible.'
      : 'Invite new users, assign roles, manage organizations, and reassign students between case managers.',
  },
  {
    title: '📋 Surveys & Engagement',
    description:
      'Send Life Skills surveys, check-ins, and post-graduation plans. View aggregated responses and per-module impact reports.',
  },
  {
    title: '📱 QR Codes',
    description:
      'Generate organization-wide QR codes so students can scan to submit a request or schedule a meeting — perfect for posters and orientations.',
  },
  {
    title: '📊 Impact Analytics',
    description:
      'Track program ROI: cost-per-participant, outcomes by org, request resolution times, and longitudinal student growth.',
  },
  {
    title: '⏱ Time Tracking & Approvals',
    description:
      'Review and approve case manager time entries, then export to CSV for payroll or grant reporting.',
  },
  {
    title: '🔐 Security & Compliance',
    description:
      'MFA is mandatory for all staff. NDA acceptance is required at first login. Audit logs track every sensitive action.',
  },
  helpStep,
];

export function getTourSteps(role: AppRole | null, displayName: string): TourStep[] {
  const name = displayName?.split(' ')[0] || 'there';
  switch (role) {
    case 'student':
      return studentSteps(name);
    case 'case_manager':
      return caseManagerSteps(name);
    case 'org_admin':
      return adminSteps(name, true);
    case 'admin':
      return adminSteps(name, false);
    default:
      return [welcomeStep(name), helpStep];
  }
}
