import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { SubmissionsTabs } from '@/components/submissions/SubmissionsTabs';
import { useStudentDetail } from '@/hooks/useStudentDetail';

export default function AdminStudentSubmissions() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const { data: student } = useStudentDetail(id);

  if (role !== 'admin') {
    return (
      <SidebarLayout>
        <PageHeader title="Submissions" description="Only admins can edit and delete student submissions." />
      </SidebarLayout>
    );
  }

  const name = student?.profile?.full_name || 'Student';

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
          description="View, edit, or delete any of this student's check-ins, plans, intake, and impact survey responses."
        />
        {id && <SubmissionsTabs studentId={id} allowDelete />}
      </div>
    </SidebarLayout>
  );
}
