import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { CohortsIndex } from '@/components/admin/CohortsIndex';

/** One place to create classes and put students and case managers in them. */
export default function ClassesPage() {
  return (
    <SidebarLayout>
      <PageHeader
        title="Classes"
        description="Create a class, then add students — new arrivals and students who were never placed in one."
      />
      <div className="mt-4">
        <CohortsIndex />
      </div>
    </SidebarLayout>
  );
}
