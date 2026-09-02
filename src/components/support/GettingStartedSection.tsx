import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Compass, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProductTour } from '@/hooks/useProductTour';

type ChecklistItem = { label: string; href?: string };

const checklistByRole: Record<string, ChecklistItem[]> = {
  student: [
    { label: 'Complete your profile and intake survey', href: '/intake-survey' },
    { label: 'Meet your assigned case manager', href: '/dashboard' },
    { label: 'Submit your first support request', href: '/requests/new' },
    { label: 'Send a message to your case manager', href: '/messages' },
    { label: 'Complete your first weekly check-in', href: '/check-in' },
  ],
  case_manager: [
    { label: 'Enable two-factor authentication (required)', href: '/settings' },
    { label: 'Review your assigned students', href: '/students' },
    { label: 'Open the request queue', href: '/requests/queue' },
    { label: 'Send a Life Skills survey to a student', href: '/admin/lifeskills' },
    { label: 'Log your first time entry', href: '/time-tracking' },
  ],
  admin: [
    { label: 'Enable two-factor authentication (required)', href: '/settings' },
    { label: 'Invite case managers and students', href: '/admin/users' },
    { label: 'Set up organizations and cohorts', href: '/admin/organizations' },
    { label: 'Create your first QR code', href: '/admin/qr-codes' },
    { label: 'Review impact analytics', href: '/admin/impact' },
  ],
  org_admin: [
    { label: 'Enable two-factor authentication (required)', href: '/settings' },
    { label: 'Review your organization\'s case managers', href: '/admin/case-managers' },
    { label: 'Monitor unassigned requests', href: '/admin' },
    { label: 'Send a survey to your students', href: '/admin/surveys' },
    { label: 'View impact reports', href: '/admin/impact' },
  ],
};

const roleLabel: Record<string, string> = {
  student: 'Student',
  case_manager: 'Case Manager',
  admin: 'Administrator',
  org_admin: 'Org Administrator',
};

export function GettingStartedSection() {
  const { role } = useAuth();
  const { startTour, hasCompletedTour } = useProductTour();
  const checklist = (role && checklistByRole[role]) || checklistByRole.student;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Compass className="h-5 w-5" />
          Getting Started
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          New to Evolve? Start here — a quick tour and your first-5-minutes checklist.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Guided tour card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <PlayCircle className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base">Take the 60-second tour</CardTitle>
            <CardDescription>
              A guided walkthrough of the {role ? roleLabel[role] || 'platform' : 'platform'} experience.
              {hasCompletedTour() && ' You\'ve seen this before — feel free to replay it.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={startTour} className="gap-2">
              <PlayCircle className="h-4 w-4" />
              {hasCompletedTour() ? 'Replay walkthrough' : 'Start walkthrough'}
            </Button>
          </CardContent>
        </Card>

        {/* First-5-minutes checklist */}
        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base">Your first 5 minutes</CardTitle>
            <CardDescription>
              A quick checklist to get up and running.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  {item.href ? (
                    <Link to={item.href} className="hover:text-primary transition-colors flex items-center gap-1 group">
                      {item.label}
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
