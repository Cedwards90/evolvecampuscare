import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpsertFundingGoal, type FundingGoal } from "@/hooks/useFundingGoals";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  goal?: FundingGoal | null;
  organizationId?: string | null;
}

const METRIC_OPTIONS = [
  { value: "job_placements", label: "Job placements" },
  { value: "certifications", label: "Certifications earned" },
  { value: "completions", label: "Program completions" },
  { value: "requests_resolved", label: "Support requests resolved" },
];

export function FundingGoalDialog({ open, onOpenChange, goal, organizationId = null }: Props) {
  const [form, setForm] = useState({
    title: goal?.title || "",
    description: goal?.description || "",
    metric_key: goal?.metric_key || "job_placements",
    target_value: goal?.target_value?.toString() || "",
    period_start: goal?.period_start || new Date().toISOString().slice(0, 10),
    period_end: goal?.period_end || new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10),
  });
  const mutation = useUpsertFundingGoal();

  const save = async () => {
    const target = Number(form.target_value);
    if (!form.title || !target || target <= 0) {
      toast({ title: "Title and a positive target are required", variant: "destructive" });
      return;
    }
    try {
      await mutation.mutateAsync({
        id: goal?.id,
        organization_id: organizationId,
        ...form,
        target_value: target,
      } as any);
      toast({ title: goal ? "Goal updated" : "Goal created" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e.message || "Failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Edit funding goal" : "New funding goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
          </div>
          <div>
            <Label>Metric</Label>
            <Select value={form.metric_key} onValueChange={(v) => setForm({ ...form, metric_key: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Target</Label>
              <Input type="number" min="1" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={save} disabled={mutation.isPending} className="rounded-full">
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
