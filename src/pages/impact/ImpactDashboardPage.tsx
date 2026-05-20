import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import { PageHeader } from "@/components/PageHeader";
import { ImpactDashboard } from "@/components/impact/ImpactDashboard";
import { useAuth } from "@/contexts/AuthContext";

export default function ImpactDashboardPage() {
  const { profile, userRole } = useAuth() as any;
  const userId = profile?.user_id;
  const fixedScope =
    userRole === "case_manager" ? { case_manager_id: userId } : {};
  return (
    <SidebarLayout>
      <PageHeader title="Impact Analytics" description="Outcomes across participants, social impact indicators, and funding goals." />
      <ImpactDashboard fixedScope={fixedScope} />
    </SidebarLayout>
  );
}
