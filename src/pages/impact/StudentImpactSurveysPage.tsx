import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyImpactSurveys } from "@/hooks/useImpactSurveys";
import { DemographicsConsentDialog } from "@/components/impact/DemographicsConsentDialog";
import { useState } from "react";
import { useMyDemographics } from "@/hooks/useParticipantOutcomes";

export default function StudentImpactSurveysPage() {
  const { data: items = [], isLoading } = useMyImpactSurveys();
  const { data: demo } = useMyDemographics();
  const [open, setOpen] = useState(false);

  return (
    <SidebarLayout>
      <PageHeader title="Impact Surveys" description="Short, periodic check-ins that help us understand and improve our impact." />
      <Card className="mb-4">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-medium">Optional demographics</p>
            <p className="text-sm text-muted-foreground">
              {demo?.consent_at ? "Thanks — you have shared optional demographic info. You can update it anytime." : "Help us measure program reach. Fully optional and anonymized."}
            </p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
            {demo?.consent_at ? "Update" : "Share"}
          </Button>
        </CardContent>
      </Card>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="space-y-3">
        {items.map(({ template, is_due, last_completed_at }) => (
          <Card key={template.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{template.title}</p>
                  {is_due ? <Badge>Due</Badge> : <Badge variant="secondary">Up to date</Badge>}
                </div>
                {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
                <p className="text-xs text-muted-foreground">
                  Cadence: every {template.cadence_days} days{last_completed_at ? ` • last: ${new Date(last_completed_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <Link to={`/surveys/impact/${template.slug}`}>
                <Button className="rounded-full">{is_due ? "Start" : "Retake"}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
        {!isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">No surveys assigned yet.</p>}
      </div>
      <DemographicsConsentDialog open={open} onOpenChange={setOpen} />
    </SidebarLayout>
  );
}
