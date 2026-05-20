import { useState } from "react";
import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useImpactMetrics } from "@/hooks/useImpactMetrics";
import { downloadDonorReportPdf } from "@/lib/impactReportPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ALL_SECTIONS = [
  { id: "cover", label: "Cover page" },
  { id: "executive", label: "Executive summary" },
  { id: "kpi", label: "Key performance indicators" },
  { id: "funding", label: "Funding goal progress" },
  { id: "social", label: "Social impact indicators" },
  { id: "demographics", label: "Demographic breakdown" },
  { id: "trends", label: "Trends" },
  { id: "methodology", label: "Methodology" },
];

export default function DonorReportsPage() {
  const today = new Date();
  const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(lastYear.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [title, setTitle] = useState("Annual Impact Report");
  const [sections, setSections] = useState<string[]>(ALL_SECTIONS.map((s) => s.id));
  const { data: metrics, isFetching, refetch } = useImpactMetrics({ date_from: dateFrom, date_to: dateTo });

  const toggle = (id: string) =>
    setSections((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const generate = async () => {
    if (!metrics) return;
    downloadDonorReportPdf({ metrics, templateTitle: title, sections, scopeLabel: `${dateFrom} → ${dateTo}` });
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("impact_report_audit").insert({
        actor_id: u.user.id,
        scope: { date_from: dateFrom, date_to: dateTo } as any,
        format: "pdf",
      });
    }
    toast({ title: "Report downloaded" });
  };

  return (
    <SidebarLayout>
      <PageHeader title="Donor & Grant Reports" description="Build branded PDF reports from the live impact dashboard." />
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <Label>Report title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:max-w-md">
            <div>
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Sections</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {ALL_SECTIONS.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Checkbox id={s.id} checked={sections.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                  <Label htmlFor={s.id} className="font-normal">{s.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => refetch()} disabled={isFetching}>
              Refresh data
            </Button>
            <Button className="rounded-full" onClick={generate} disabled={!metrics}>
              Generate PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </SidebarLayout>
  );
}
