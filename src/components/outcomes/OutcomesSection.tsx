import { useEffect, useState } from 'react';
import { format, addDays } from 'date-fns';
import { Briefcase, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  useParticipantOutcomes,
  useUpsertParticipantOutcome,
  type OutcomeUpsert,
} from '@/hooks/useParticipantOutcomes';

interface OutcomesSectionProps {
  studentId: string;
  organizationId?: string | null;
  canEdit?: boolean;
}

const EMPLOYMENT_STATUSES = [
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'employed_part_time', label: 'Employed — Part-time' },
  { value: 'employed_full_time', label: 'Employed — Full-time' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'further_education', label: 'In further education' },
  { value: 'other', label: 'Other' },
];

const RETENTION_CHECKPOINTS: Array<{
  days: number;
  metKey: keyof OutcomeUpsert;
  dateKey: keyof OutcomeUpsert;
  label: string;
}> = [
  { days: 30, metKey: 'retention_30_met', dateKey: 'retention_30_date', label: '30 days' },
  { days: 60, metKey: 'retention_60_met', dateKey: 'retention_60_date', label: '60 days' },
  { days: 90, metKey: 'retention_90_met', dateKey: 'retention_90_date', label: '90 days' },
  { days: 180, metKey: 'retention_180_met', dateKey: 'retention_180_date', label: '180 days' },
  { days: 365, metKey: 'retention_365_met', dateKey: 'retention_365_date', label: '365 days' },
];

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

export function OutcomesSection({ studentId, organizationId, canEdit = true }: OutcomesSectionProps) {
  const { data, isLoading } = useParticipantOutcomes(studentId);
  const upsert = useUpsertParticipantOutcome();

  const [form, setForm] = useState<OutcomeUpsert>({ student_id: studentId });

  useEffect(() => {
    if (data) {
      setForm({
        student_id: studentId,
        employment_status: data.employment_status,
        employer: data.employer,
        job_title: data.job_title,
        placement_date: data.placement_date,
        hourly_wage: data.hourly_wage,
        weekly_hours: data.weekly_hours,
        baseline_wage: data.baseline_wage,
        program_completed: data.program_completed,
        program_completion_date: data.program_completion_date,
        completion_reason: data.completion_reason,
        retention_30_met: data.retention_30_met,
        retention_30_date: data.retention_30_date,
        retention_60_met: data.retention_60_met,
        retention_60_date: data.retention_60_date,
        retention_90_met: data.retention_90_met,
        retention_90_date: data.retention_90_date,
        retention_180_met: data.retention_180_met,
        retention_180_date: data.retention_180_date,
        retention_365_met: data.retention_365_met,
        retention_365_date: data.retention_365_date,
      });
    } else {
      setForm({ student_id: studentId });
    }
  }, [data, studentId]);

  const set = <K extends keyof OutcomeUpsert>(key: K, value: OutcomeUpsert[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    upsert.mutate({ ...form, organizationId: organizationId ?? null });
  };

  const wageLiftPct = (() => {
    const base = Number(form.baseline_wage);
    const cur = Number(form.hourly_wage);
    if (!base || !cur) return null;
    return Math.round(((cur - base) / base) * 100);
  })();

  if (isLoading) return <LoadingSpinner />;

  const placementDateForCalc = form.placement_date ? new Date(form.placement_date) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Employment & Wages
          </CardTitle>
          <CardDescription>
            Captures baseline + post-program wage and placement details used for impact metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Employment status</Label>
              <Select
                value={(form.employment_status as string) || ''}
                onValueChange={(v) => set('employment_status', v)}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Placement date</Label>
              <Input
                type="date"
                value={toDateInput(form.placement_date as string)}
                onChange={(e) => set('placement_date', e.target.value || null)}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Employer</Label>
              <Input
                value={(form.employer as string) || ''}
                onChange={(e) => set('employer', e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Job title</Label>
              <Input
                value={(form.job_title as string) || ''}
                onChange={(e) => set('job_title', e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Baseline hourly wage (at intake)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={(form.baseline_wage as number) ?? ''}
                onChange={(e) =>
                  set('baseline_wage', e.target.value === '' ? null : Number(e.target.value))
                }
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Current hourly wage</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={(form.hourly_wage as number) ?? ''}
                onChange={(e) =>
                  set('hourly_wage', e.target.value === '' ? null : Number(e.target.value))
                }
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Weekly hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={(form.weekly_hours as number) ?? ''}
                onChange={(e) =>
                  set('weekly_hours', e.target.value === '' ? null : Number(e.target.value))
                }
                disabled={!canEdit}
              />
            </div>

            {wageLiftPct !== null && (
              <div className="space-y-1">
                <Label className="text-xs">Wage lift</Label>
                <p className={`text-sm font-medium ${wageLiftPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {wageLiftPct >= 0 ? '+' : ''}{wageLiftPct}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Retention checkpoints</CardTitle>
          <CardDescription>
            {placementDateForCalc
              ? `Suggested dates calculated from placement on ${format(placementDateForCalc, 'PPP')}.`
              : 'Set a placement date above to auto-fill suggested checkpoint dates.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {RETENTION_CHECKPOINTS.map((cp) => {
            const suggested = placementDateForCalc
              ? format(addDays(placementDateForCalc, cp.days), 'yyyy-MM-dd')
              : '';
            const dateVal = toDateInput(form[cp.dateKey] as string) || suggested;
            return (
              <div
                key={cp.label}
                className="flex items-center gap-3 rounded-lg border border-border/60 p-3 flex-wrap"
              >
                <Checkbox
                  checked={!!form[cp.metKey]}
                  onCheckedChange={(c) => set(cp.metKey, c === true as any)}
                  disabled={!canEdit}
                />
                <Label className="text-sm font-medium min-w-[80px]">{cp.label}</Label>
                <Input
                  type="date"
                  value={dateVal}
                  onChange={(e) => set(cp.dateKey, (e.target.value || null) as any)}
                  className="max-w-[200px]"
                  disabled={!canEdit}
                />
                {suggested && !form[cp.dateKey] && (
                  <span className="text-xs text-muted-foreground">Suggested: {suggested}</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Program completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={!!form.program_completed}
              onCheckedChange={(c) => set('program_completed', c === true as any)}
              disabled={!canEdit}
            />
            <Label className="text-sm">Program completed</Label>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Completion date</Label>
              <Input
                type="date"
                value={toDateInput(form.program_completion_date as string)}
                onChange={(e) => set('program_completion_date', e.target.value || null)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Completion reason / notes</Label>
              <Textarea
                value={(form.completion_reason as string) || ''}
                onChange={(e) => set('completion_reason', e.target.value)}
                className="min-h-[80px]"
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={upsert.isPending} className="rounded-full">
            <Save className="mr-2 h-4 w-4" />
            {upsert.isPending ? 'Saving...' : 'Save outcomes'}
          </Button>
        </div>
      )}
    </div>
  );
}
