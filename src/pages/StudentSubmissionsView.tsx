import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { SubmissionsTabs } from '@/components/submissions/SubmissionsTabs';
import { useStudentDetail } from '@/hooks/useStudentDetail';

const VALID_TABS = ['checkins', 'plan', 'intake', 'impact'] as const;
type Tab = typeof VALID_TABS[number];

function normalizeTab(value: string | null): Tab | undefined {
  if (!value) return undefined;
  // accept "plans" alias used in the summary card
  if (value === 'plans') return 'plan';
  return (VALID_TABS as readonly string[]).includes(value) ? (value as Tab) : undefined;
}

export default function StudentSubmissionsView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const { data: student } = useStudentDetail(id);

  if (role !== 'case_manager' && role !== 'org_admin' && role !== 'admin') {
    return (
      <SidebarLayout>
        <PageHeader title="Submissions" description="You do not have access to this page." />
      </SidebarLayout>
    );
  }

  const name = student?.profile?.full_name || 'Student';
  const tab = normalizeTab(searchParams.get('tab'));

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link to={`/students/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to student
          </Link>
        </Button>
        <PageHeader
          title={`Submissions — ${name}`}
          description="Review every check-in, plan, intake response, and Life Skills survey this student has shared."
        />
        {id && <SubmissionsTabs studentId={id} readOnly defaultTab={tab} />}
      </div>
    </SidebarLayout>
  );
}
