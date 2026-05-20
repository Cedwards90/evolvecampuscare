import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useImpactSurveyTemplates, useUpsertSurveyTemplate } from "@/hooks/useImpactSurveys";
import { toast } from "@/hooks/use-toast";

export default function SurveyTemplatesPage() {
  const { data: tpls = [], isLoading } = useImpactSurveyTemplates();
  const upsert = useUpsertSurveyTemplate();

  return (
    <SidebarLayout>
      <PageHeader title="Impact Survey Templates" description="Manage which periodic impact surveys are active." />
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="space-y-3">
        {tpls.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{t.title}</p>
                  {t.is_builtin && <Badge variant="secondary">Built-in</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">slug: {t.slug} • cadence: every {t.cadence_days} days • {(t.questions as any[])?.length || 0} questions</p>
                {t.description && <p className="mt-1 text-sm">{t.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t.is_active ? "Active" : "Inactive"}</span>
                <Switch
                  checked={t.is_active}
                  onCheckedChange={async (v) => {
                    try {
                      await upsert.mutateAsync({ id: t.id, slug: t.slug, title: t.title, is_active: v } as any);
                      toast({ title: v ? "Activated" : "Deactivated" });
                    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </SidebarLayout>
  );
}
