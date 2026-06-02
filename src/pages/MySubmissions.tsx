import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { PageNav } from '@/components/navigation/PageNav';
import { useAuth } from '@/contexts/AuthContext';
import { SubmissionsTabs } from '@/components/submissions/SubmissionsTabs';

export default function MySubmissions() {
  const { role } = useAuth();

  if (role && role !== 'student') {
    return (
      <SidebarLayout>
        <PageHeader title="My Submissions" description="Only students can view this page." />
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageNav fallback="/dashboard" />
        <PageHeader
          title="My Submissions"
          description="Review and update everything you've shared — check-ins, plans, and surveys."
        />
        <SubmissionsTabs />
      </div>
    </SidebarLayout>
  );
}
