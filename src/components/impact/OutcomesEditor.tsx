import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, Pencil, Search } from 'lucide-react';
import {
  useStudentsForOutcomes,
  useUpsertOutcome,
  type OutcomeInput,
} from '@/hooks/useImpactInputs';

interface Props {
  studentIds: string[];
}

const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function OutcomesEditor({ studentIds }: Props) {
  const { data: students = [], isLoading } = useStudentsForOutcomes(studentIds);
  const [editing, setEditing] = useState<any | null>(null);
  const [query, setQuery] = useState('');
  const upsert = useUpsertOutcome();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.full_name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q),
    );
  }, [students, query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Participant Outcomes Entry
        </CardTitle>
        <CardDescription>
          Enter placement, wage, completion, and retention data per student. Fills out wage lift, placement rate, completion rate, and SROI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students…"
            className="pl-9"
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
            No students in scope.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b sticky top-0 bg-card z-10">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Student</th>
                  <th className="text-left py-2 px-3 font-medium">Placement</th>
                  <th className="text-right py-2 px-3 font-medium">Wage</th>
                  <th className="text-right py-2 px-3 font-medium">Baseline</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const o = s.outcome;
                  return (
                    <tr key={s.student_id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{s.full_name || s.email}</div>
                        {s.full_name && (
                          <div className="text-xs text-muted-foreground">{s.email}</div>
                        )}
                      </td>
                      <td className="py-2 px-3">{o?.placement_date || '—'}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {o?.hourly_wage ? CURRENCY.format(Number(o.hourly_wage)) + '/hr' : '—'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {o?.baseline_wage ? CURRENCY.format(Number(o.baseline_wage)) + '/hr' : '—'}
                      </td>
                      <td className="py-2 px-3">
                        {o?.program_completed ? (
                          <Badge variant="secondary" className="rounded-full">Completed</Badge>
                        ) : o ? (
                          <Badge variant="outline" className="rounded-full">In progress</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No record</span>
                        )}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          {o ? 'Edit' : 'Add'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.full_name || editing.email}</DialogTitle>
                <DialogDescription>
                  Update placement, wage, and retention milestones.
                </DialogDescription>
              </DialogHeader>
              <OutcomeForm
                studentId={editing.student_id}
                initial={editing.outcome}
                saving={upsert.isPending}
                onCancel={() => setEditing(null)}
                onSubmit={(values) =>
                  upsert.mutate(values, { onSuccess: () => setEditing(null) })
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OutcomeForm({
  studentId,
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  studentId: string;
  initial: any | null;
  onSubmit: (v: OutcomeInput) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<OutcomeInput>({
    student_id: studentId,
    employment_status: initial?.employment_status || '',
    job_title: initial?.job_title || '',
    employer: initial?.employer || '',
    placement_date: initial?.placement_date || '',
    hourly_wage: initial?.hourly_wage ?? null,
    weekly_hours: initial?.weekly_hours ?? null,
    baseline_wage: initial?.baseline_wage ?? null,
    program_completed: !!initial?.program_completed,
    program_completion_date: initial?.program_completion_date || '',
    completion_reason: initial?.completion_reason || '',
    retention_30_met: !!initial?.retention_30_met,
    retention_60_met: !!initial?.retention_60_met,
    retention_90_met: !!initial?.retention_90_met,
    retention_180_met: !!initial?.retention_180_met,
    retention_365_met: !!initial?.retention_365_met,
  });

  const set = <K extends keyof OutcomeInput>(k: K, v: OutcomeInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const numOrNull = (s: string) => (s === '' ? null : Number(s));
  const strOrNull = (s: string) => (s === '' ? null : s);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          placement_date: strOrNull(form.placement_date || '') as any,
          program_completion_date: strOrNull(form.program_completion_date || '') as any,
          employment_status: strOrNull(form.employment_status || '') as any,
          job_title: strOrNull(form.job_title || '') as any,
          employer: strOrNull(form.employer || '') as any,
          completion_reason: strOrNull(form.completion_reason || '') as any,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Employment status</Label>
          <Select
            value={form.employment_status || 'none'}
            onValueChange={(v) => set('employment_status', v === 'none' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="employed_ft">Employed full-time</SelectItem>
              <SelectItem value="employed_pt">Employed part-time</SelectItem>
              <SelectItem value="self_employed">Self-employed</SelectItem>
              <SelectItem value="seeking">Seeking employment</SelectItem>
              <SelectItem value="not_seeking">Not in workforce</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Placement date</Label>
          <Input
            type="date"
            value={form.placement_date || ''}
            onChange={(e) => set('placement_date', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Employer</Label>
          <Input
            value={form.employer || ''}
            onChange={(e) => set('employer', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Job title</Label>
          <Input
            value={form.job_title || ''}
            onChange={(e) => set('job_title', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Hourly wage ($)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.hourly_wage ?? ''}
            onChange={(e) => set('hourly_wage', numOrNull(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label>Baseline wage ($)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.baseline_wage ?? ''}
            onChange={(e) => set('baseline_wage', numOrNull(e.target.value))}
            placeholder="Pre-program wage"
          />
        </div>
        <div className="space-y-1">
          <Label>Weekly hours</Label>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={form.weekly_hours ?? ''}
            onChange={(e) => set('weekly_hours', numOrNull(e.target.value))}
          />
        </div>
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="completed"
            checked={form.program_completed}
            onCheckedChange={(v) => set('program_completed', !!v)}
          />
          <Label htmlFor="completed" className="cursor-pointer">Program completed</Label>
        </div>
        {form.program_completed && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Completion date</Label>
              <Input
                type="date"
                value={form.program_completion_date || ''}
                onChange={(e) => set('program_completion_date', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Completion reason</Label>
              <Input
                value={form.completion_reason || ''}
                onChange={(e) => set('completion_reason', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t pt-3">
        <Label className="mb-2 block">Retention milestones met</Label>
        <div className="grid grid-cols-5 gap-2">
          {(['30', '60', '90', '180', '365'] as const).map((m) => {
            const key = `retention_${m}_met` as keyof OutcomeInput;
            return (
              <label key={m} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!form[key]}
                  onCheckedChange={(v) => set(key, !!v as any)}
                />
                {m}d
              </label>
            );
          })}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save outcome'}</Button>
      </DialogFooter>
    </form>
  );
}
