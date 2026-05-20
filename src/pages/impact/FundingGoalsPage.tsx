import { useState } from "react";
import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useFundingGoals, useDeleteFundingGoal, type FundingGoal } from "@/hooks/useFundingGoals";
import { FundingGoalDialog } from "@/components/impact/FundingGoalDialog";
import { toast } from "@/hooks/use-toast";

export default function FundingGoalsPage() {
  const { data: goals = [], isLoading } = useFundingGoals();
  const del = useDeleteFundingGoal();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FundingGoal | null>(null);

  return (
    <SidebarLayout>
      <PageHeader
        title="Funding Goals"
        description="Targets that roll up into Impact dashboards."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full">
            <Plus className="mr-2 h-4 w-4" /> New goal
          </Button>
        }
      />
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {goals.map((g) => (
          <Card key={g.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{g.title}</p>
                <p className="text-xs text-muted-foreground">
                  {g.metric_key} • target {g.target_value} • {g.period_start} → {g.period_end}
                </p>
                {g.description && <p className="mt-1 text-sm">{g.description}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setEditing(g); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={async () => {
                    if (!confirm("Delete this goal?")) return;
                    try { await del.mutateAsync(g.id); toast({ title: "Deleted" }); } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && goals.length === 0 && <p className="text-sm text-muted-foreground">No funding goals yet.</p>}
      </div>
      {open && <FundingGoalDialog open={open} onOpenChange={setOpen} goal={editing} />}
    </SidebarLayout>
  );
}
