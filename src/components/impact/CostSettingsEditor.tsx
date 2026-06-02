import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import {
  useUpsertCostSetting,
  useDeleteCostSetting,
  type CostSettingInput,
} from '@/hooks/useImpactInputs';

interface Props {
  costs: any[];
  orgOptions: { value: string; label: string }[];
  isAdmin: boolean;
}

const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CostSettingsEditor({ costs, orgOptions, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const upsert = useUpsertCostSetting();
  const remove = useDeleteCostSetting();

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Program Cost Inputs
          </CardTitle>
          <CardDescription>
            Enter program cost periods, public benefit offsets, and currency. These drive the SROI calculation.
          </CardDescription>
        </div>
        <Button onClick={openNew} size="sm" className="rounded-full">
          <Plus className="h-4 w-4 mr-1" /> Add cost period
        </Button>
      </CardHeader>
      <CardContent>
        {costs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
            No cost periods entered yet. Add one to compute SROI.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Period</th>
                  <th className="text-right py-2 px-3 font-medium">Annual Cost</th>
                  <th className="text-right py-2 px-3 font-medium">Cost/Participant</th>
                  <th className="text-right py-2 px-3 font-medium">Public Benefit Offset</th>
                  <th className="text-left py-2 px-3 font-medium">Notes</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 tabular-nums">
                      {c.period_start} → {c.period_end}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {CURRENCY.format(Number(c.annual_program_cost || 0))}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {c.cost_per_participant_override != null
                        ? CURRENCY.format(Number(c.cost_per_participant_override))
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {c.avg_public_benefit_offset != null
                        ? CURRENCY.format(Number(c.avg_public_benefit_offset))
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[240px] truncate">
                      {c.notes || '—'}
                    </td>
                    <td className="py-2 pl-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Remove this cost period?')) remove.mutate(c.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit cost period' : 'Add cost period'}</DialogTitle>
            <DialogDescription>
              Numbers feed the SROI formula. Cost is divided across the period.
            </DialogDescription>
          </DialogHeader>
          <CostForm
            initial={editing}
            orgOptions={orgOptions}
            isAdmin={isAdmin}
            onCancel={() => setOpen(false)}
            onSubmit={(values) => {
              upsert.mutate(
                { id: editing?.id, ...values },
                { onSuccess: () => setOpen(false) },
              );
            }}
            saving={upsert.isPending}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CostForm({
  initial,
  orgOptions,
  isAdmin,
  onSubmit,
  onCancel,
  saving,
}: {
  initial: any | null;
  orgOptions: { value: string; label: string }[];
  isAdmin: boolean;
  onSubmit: (v: CostSettingInput) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CostSettingInput>({
    organization_id: initial?.organization_id || null,
    period_start: initial?.period_start || new Date().toISOString().slice(0, 10),
    period_end: initial?.period_end || new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10),
    annual_program_cost: Number(initial?.annual_program_cost || 0),
    cost_per_participant_override: initial?.cost_per_participant_override ?? null,
    avg_public_benefit_offset: initial?.avg_public_benefit_offset ?? null,
    currency: initial?.currency || 'USD',
    notes: initial?.notes ?? '',
  });

  const setField = <K extends keyof CostSettingInput>(k: K, v: CostSettingInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const numOrNull = (s: string) => (s === '' ? null : Number(s));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.period_start || !form.period_end || !(form.annual_program_cost > 0)) return;
        onSubmit(form);
      }}
      className="space-y-4"
    >
      {isAdmin && orgOptions.length > 0 && (
        <div className="space-y-1">
          <Label>Organization</Label>
          <Select
            value={form.organization_id || 'all'}
            onValueChange={(v) => setField('organization_id', v === 'all' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (platform-wide)</SelectItem>
              {orgOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Period start</Label>
          <Input
            type="date"
            value={form.period_start}
            onChange={(e) => setField('period_start', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Period end</Label>
          <Input
            type="date"
            value={form.period_end}
            onChange={(e) => setField('period_end', e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Annual program cost ($)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={form.annual_program_cost}
          onChange={(e) => setField('annual_program_cost', Number(e.target.value))}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Cost/participant override ($)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.cost_per_participant_override ?? ''}
            onChange={(e) => setField('cost_per_participant_override', numOrNull(e.target.value))}
            placeholder="Auto-calculated if blank"
          />
        </div>
        <div className="space-y-1">
          <Label>Avg public benefit offset ($)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.avg_public_benefit_offset ?? ''}
            onChange={(e) => setField('avg_public_benefit_offset', numOrNull(e.target.value))}
            placeholder="Per participant"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea
          value={form.notes || ''}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}
