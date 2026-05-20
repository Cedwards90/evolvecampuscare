import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUpsertMyDemographics, useMyDemographics } from "@/hooks/useParticipantOutcomes";
import { toast } from "@/hooks/use-toast";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const ETHNICITIES = ["Asian", "Black or African American", "Hispanic or Latino", "Native American", "Pacific Islander", "White", "Multiracial", "Other"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DemographicsConsentDialog({ open, onOpenChange }: Props) {
  const { data: existing } = useMyDemographics();
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState<any>({
    gender: existing?.gender || "",
    age_range: existing?.age_range || "",
    ethnicity: existing?.ethnicity || [],
    veteran_status: existing?.veteran_status ?? null,
    justice_involved: existing?.justice_involved ?? null,
    disability_status: existing?.disability_status ?? null,
  });
  const mutation = useUpsertMyDemographics();

  const toggleEthnicity = (e: string) => {
    setForm((f: any) => ({
      ...f,
      ethnicity: f.ethnicity.includes(e) ? f.ethnicity.filter((x: string) => x !== e) : [...f.ethnicity, e],
    }));
  };

  const save = async () => {
    if (!consent) {
      toast({ title: "Please confirm consent to continue", variant: "destructive" });
      return;
    }
    try {
      await mutation.mutateAsync(form);
      toast({ title: "Saved. Thank you." });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e.message || "Failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Optional demographic information</DialogTitle>
        </DialogHeader>
        <Alert>
          <AlertDescription>
            All fields are optional and self-reported. Your responses are used only for aggregated, anonymous program reporting (buckets smaller than 5 are suppressed). You can update or remove this information anytime in your profile.
          </AlertDescription>
        </Alert>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Gender</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={form.gender === g ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setForm({ ...form, gender: form.gender === g ? "" : g })}
                  type="button"
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Age range</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {AGE_RANGES.map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={form.age_range === a ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setForm({ ...form, age_range: form.age_range === a ? "" : a })}
                  type="button"
                >
                  {a}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Race / ethnicity (multi-select)</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {ETHNICITIES.map((e) => (
                <Button
                  key={e}
                  size="sm"
                  variant={form.ethnicity.includes(e) ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => toggleEthnicity(e)}
                  type="button"
                >
                  {e}
                </Button>
              ))}
            </div>
          </div>
          {(["veteran_status", "justice_involved", "disability_status"] as const).map((k) => (
            <div key={k} className="flex items-center gap-3">
              <Label className="capitalize">{k.replace(/_/g, " ")}</Label>
              <div className="flex gap-2">
                {[
                  { v: true, l: "Yes" },
                  { v: false, l: "No" },
                  { v: null, l: "Prefer not to say" },
                ].map((opt) => (
                  <Button
                    key={String(opt.v)}
                    size="sm"
                    variant={form[k] === opt.v ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setForm({ ...form, [k]: opt.v })}
                    type="button"
                  >
                    {opt.l}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2 rounded-md border border-border/60 p-3">
            <Checkbox id="consent" checked={consent} onCheckedChange={(c) => setConsent(!!c)} />
            <Label htmlFor="consent" className="text-sm font-normal leading-relaxed">
              I consent to Evolve Foundation using this self-reported information for aggregated, anonymized program impact reporting only. I understand it is optional and that I can update or remove it at any time.
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={save} disabled={mutation.isPending} className="rounded-full">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
