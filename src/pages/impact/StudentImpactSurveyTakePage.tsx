import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useImpactSurveyTemplate, useSubmitImpactSurvey } from "@/hooks/useImpactSurveys";
import { toast } from "@/hooks/use-toast";

const LIKERT = [
  { v: 1, l: "Strongly disagree" },
  { v: 2, l: "Disagree" },
  { v: 3, l: "Neutral" },
  { v: 4, l: "Agree" },
  { v: 5, l: "Strongly agree" },
];

export default function StudentImpactSurveyTakePage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { data: tpl, isLoading } = useImpactSurveyTemplate(slug);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const submit = useSubmitImpactSurvey();

  const setVal = (k: string, v: any) => setResponses((r) => ({ ...r, [k]: v }));

  const onSubmit = async () => {
    if (!tpl) return;
    try {
      await submit.mutateAsync({ templateId: tpl.id, responses });
      toast({ title: "Thank you — submitted." });
      nav("/surveys/impact");
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <SidebarLayout><p className="p-6 text-sm text-muted-foreground">Loading…</p></SidebarLayout>;
  if (!tpl) return <SidebarLayout><p className="p-6">Survey not found.</p></SidebarLayout>;

  return (
    <SidebarLayout>
      <PageHeader title={tpl.title} description={tpl.description || undefined} />
      <Card>
        <CardContent className="space-y-6 p-6">
          {(tpl.questions as any[]).map((q) => (
            <div key={q.key} className="space-y-2">
              <Label>{q.label}</Label>
              {q.type === "likert" || q.type === "likert_negative" ? (
                <div className="flex flex-wrap gap-2">
                  {LIKERT.map((opt) => (
                    <Button
                      key={opt.v}
                      type="button"
                      size="sm"
                      variant={responses[q.key] === opt.v ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setVal(q.key, opt.v)}
                    >
                      {opt.l}
                    </Button>
                  ))}
                </div>
              ) : q.type === "boolean" ? (
                <div className="flex gap-2">
                  {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map((opt) => (
                    <Button
                      key={String(opt.v)}
                      type="button"
                      size="sm"
                      variant={responses[q.key] === opt.v ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setVal(q.key, opt.v)}
                    >
                      {opt.l}
                    </Button>
                  ))}
                </div>
              ) : q.type === "number" ? (
                <Input type="number" min="0" value={responses[q.key] ?? ""} onChange={(e) => setVal(q.key, Number(e.target.value))} className="max-w-[180px]" />
              ) : (
                <Textarea value={responses[q.key] ?? ""} onChange={(e) => setVal(q.key, e.target.value)} maxLength={1000} />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => nav("/surveys/impact")}>Cancel</Button>
            <Button className="rounded-full" onClick={onSubmit} disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </SidebarLayout>
  );
}
