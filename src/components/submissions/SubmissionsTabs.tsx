import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Pencil, Save, X, ClipboardList, Heart, GraduationCap, Sparkles, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { toast } from 'sonner';
import {
  useMyCheckIns,
  useStudentCheckIns,
  useUpdateCheckIn,
  useDeleteCheckIn,
  type StudentCheckIn,
} from '@/hooks/useStudentCheckIns';
import { useMyPlans, useStudentPlans, useUpdatePlan, useDeletePlan } from '@/hooks/usePostGraduationPlan';
import { useIntakeSurvey } from '@/hooks/useIntakeSurvey';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  useMyImpactResponses,
  useStudentImpactResponses,
  useUpdateImpactResponse,
  useDeleteImpactResponse,
  type ImpactResponseRow,
} from '@/hooks/useMyImpactResponses';

const moodLabels = ['😔 Struggling', '😕 Not Great', '😐 Okay', '🙂 Good', '😊 Great'];
const progressLabels = ['Struggling', 'Behind', 'On Track', 'Progressing Well', 'Thriving'];

type Props = {
  /** When provided, view this specific student's submissions (admin mode). Otherwise viewer's own. */
  studentId?: string;
  /** Show delete buttons. Admin only. */
  allowDelete?: boolean;
};

function DeleteConfirm({ onConfirm, label = 'this submission' }: { onConfirm: () => void; label?: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full text-destructive hover:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Check-ins ----------
function CheckInEditor({ checkIn, onClose }: { checkIn: StudentCheckIn; onClose: () => void }) {
  const update = useUpdateCheckIn();
  const [mood, setMood] = useState(checkIn.mood_rating);
  const [progress, setProgress] = useState(checkIn.progress_rating);
  const [wins, setWins] = useState(checkIn.wins || '');
  const [blockers, setBlockers] = useState(checkIn.blockers || '');
  const [notes, setNotes] = useState(checkIn.additional_notes || '');

  const save = async () => {
    try {
      await update.mutateAsync({
        id: checkIn.id,
        patch: {
          mood_rating: mood,
          progress_rating: progress,
          wins: wins.trim() || null,
          blockers: blockers.trim() || null,
          additional_notes: notes.trim() || null,
        },
      });
      toast.success('Check-in updated');
      onClose();
    } catch {
      toast.error('Could not save changes');
    }
  };

  return (
    <div className="space-y-5 border-t pt-4 mt-3">
      <div className="space-y-2">
        <Label>Mood: <span className="text-primary font-semibold">{moodLabels[mood - 1]}</span></Label>
        <Slider value={[mood]} onValueChange={([v]) => setMood(v)} min={1} max={5} step={1} />
      </div>
      <div className="space-y-2">
        <Label>Progress: <span className="text-primary font-semibold">{progressLabels[progress - 1]}</span></Label>
        <Slider value={[progress]} onValueChange={([v]) => setProgress(v)} min={1} max={5} step={1} />
      </div>
      <div className="space-y-2">
        <Label>What's going well?</Label>
        <Textarea value={wins} onChange={(e) => setWins(e.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Any blockers?</Label>
        <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Additional notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={update.isPending} className="rounded-full">
          <X className="mr-2 h-4 w-4" />Cancel
        </Button>
        <Button onClick={save} disabled={update.isPending} className="rounded-full">
          <Save className="mr-2 h-4 w-4" />{update.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

function CheckInsTab({ studentId, allowDelete }: Props) {
  const my = useMyCheckIns();
  const other = useStudentCheckIns(studentId);
  const { data: checkIns = [], isLoading } = studentId ? other : my;
  const [editingId, setEditingId] = useState<string | null>(null);
  const del = useDeleteCheckIn();

  const handleDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success('Check-in deleted');
    } catch {
      toast.error('Could not delete');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (checkIns.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No check-ins yet"
        description={studentId ? 'This student has not submitted any check-ins.' : 'Submit your first wellbeing check-in.'}
        action={!studentId ? <Button asChild className="rounded-full"><Link to="/check-in"><Plus className="mr-2 h-4 w-4" />Start a check-in</Link></Button> : undefined}
      />
    );
  }
  return (
    <div className="space-y-4">
      {!studentId && (
        <div className="flex justify-end">
          <Button asChild size="sm" className="rounded-full"><Link to="/check-in"><Plus className="mr-2 h-4 w-4" />New check-in</Link></Button>
        </div>
      )}
      {checkIns.map((c) => (
        <Card key={c.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{format(new Date(c.created_at), 'PPP')}</CardTitle>
                <CardDescription>
                  Mood: <strong>{moodLabels[c.mood_rating - 1]}</strong> · Progress: <strong>{progressLabels[c.progress_rating - 1]}</strong>
                  {c.updated_at && c.updated_at !== c.created_at && (
                    <span className="ml-2 text-xs italic">(edited {format(new Date(c.updated_at), 'PPp')})</span>
                  )}
                </CardDescription>
              </div>
              {editingId !== c.id && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditingId(c.id)}>
                    <Pencil className="mr-2 h-4 w-4" />Edit
                  </Button>
                  {allowDelete && <DeleteConfirm label="this check-in" onConfirm={() => handleDelete(c.id)} />}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingId === c.id ? (
              <CheckInEditor checkIn={c} onClose={() => setEditingId(null)} />
            ) : (
              <div className="space-y-2 text-sm">
                {c.wins && <p><strong>Wins:</strong> {c.wins}</p>}
                {c.blockers && <p><strong>Blockers:</strong> {c.blockers}</p>}
                {c.additional_notes && <p><strong>Notes:</strong> {c.additional_notes}</p>}
                {!c.wins && !c.blockers && !c.additional_notes && (
                  <p className="text-muted-foreground italic">No written notes</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Plans ----------
function PlanEditor({ plan, onClose }: { plan: any; onClose: () => void }) {
  const update = useUpdatePlan();
  const [form, setForm] = useState({
    graduation_date: plan.graduation_date || '',
    career_goals: plan.career_goals || '',
    education_goals: plan.education_goals || '',
    housing_plan: plan.housing_plan || '',
    financial_plan: plan.financial_plan || '',
    health_wellness: plan.health_wellness || '',
    support_needed: plan.support_needed || '',
    month_1_3_actions: plan.month_1_3_actions || '',
    month_4_6_actions: plan.month_4_6_actions || '',
    month_7_9_actions: plan.month_7_9_actions || '',
    month_10_12_actions: plan.month_10_12_actions || '',
    additional_notes: plan.additional_notes || '',
  });
  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    try {
      await update.mutateAsync({
        id: plan.id,
        patch: { ...form, graduation_date: form.graduation_date || null },
      });
      toast.success('Plan updated');
      onClose();
    } catch {
      toast.error('Could not save changes');
    }
  };

  const fields: Array<[keyof typeof form, string, 'textarea' | 'date']> = [
    ['graduation_date', 'Expected Graduation Date', 'date'],
    ['career_goals', 'Career Goals', 'textarea'],
    ['education_goals', 'Education Goals', 'textarea'],
    ['housing_plan', 'Housing Plan', 'textarea'],
    ['financial_plan', 'Financial Plan', 'textarea'],
    ['month_1_3_actions', 'Months 1–3', 'textarea'],
    ['month_4_6_actions', 'Months 4–6', 'textarea'],
    ['month_7_9_actions', 'Months 7–9', 'textarea'],
    ['month_10_12_actions', 'Months 10–12', 'textarea'],
    ['health_wellness', 'Health & Wellness', 'textarea'],
    ['support_needed', 'Support Needed', 'textarea'],
    ['additional_notes', 'Additional Notes', 'textarea'],
  ];

  return (
    <div className="space-y-4 border-t pt-4">
      {fields.map(([key, label, type]) => (
        <div key={key} className="space-y-2">
          <Label>{label}</Label>
          {type === 'date' ? (
            <Input type="date" value={form[key]} onChange={set(key)} />
          ) : (
            <Textarea value={form[key]} onChange={set(key)} rows={3} />
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={update.isPending} className="rounded-full">
          <X className="mr-2 h-4 w-4" />Cancel
        </Button>
        <Button onClick={save} disabled={update.isPending} className="rounded-full">
          <Save className="mr-2 h-4 w-4" />{update.isPending ? 'Saving...' : 'Save plan'}
        </Button>
      </div>
    </div>
  );
}

function PostGradTab({ studentId, allowDelete }: Props) {
  const my = useMyPlans();
  const other = useStudentPlans(studentId);
  const { data: plans = [], isLoading } = studentId ? other : my;
  const [editingId, setEditingId] = useState<string | null>(null);
  const del = useDeletePlan();

  const handleDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success('Plan deleted');
    } catch {
      toast.error('Could not delete');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No post-graduation plan yet"
        description={studentId ? 'This student has not submitted a plan.' : 'Map out your first year after graduation.'}
        action={!studentId ? <Button asChild className="rounded-full"><Link to="/post-graduation-plan"><Plus className="mr-2 h-4 w-4" />Create plan</Link></Button> : undefined}
      />
    );
  }
  return (
    <div className="space-y-4">
      {plans.map((p: any) => (
        <Card key={p.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">12-Month Plan</CardTitle>
                <CardDescription>
                  Submitted {format(new Date(p.created_at), 'PPP')}
                  {p.updated_at && p.updated_at !== p.created_at && (
                    <span className="ml-2 text-xs italic">· edited {format(new Date(p.updated_at), 'PPp')}</span>
                  )}
                </CardDescription>
              </div>
              {editingId !== p.id && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditingId(p.id)}>
                    <Pencil className="mr-2 h-4 w-4" />Edit
                  </Button>
                  {allowDelete && <DeleteConfirm label="this plan" onConfirm={() => handleDelete(p.id)} />}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingId === p.id ? (
              <PlanEditor plan={p} onClose={() => setEditingId(null)} />
            ) : (
              <div className="space-y-3 text-sm">
                {p.graduation_date && <p><strong>Graduation:</strong> {format(new Date(p.graduation_date), 'PPP')}</p>}
                {p.career_goals && <p><strong>Career:</strong> {p.career_goals}</p>}
                {p.education_goals && <p><strong>Education:</strong> {p.education_goals}</p>}
                {p.housing_plan && <p><strong>Housing:</strong> {p.housing_plan}</p>}
                {p.financial_plan && <p><strong>Finances:</strong> {p.financial_plan}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Intake ----------
function useStudentIntake(studentId?: string) {
  return useQuery({
    queryKey: ['intake-responses', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intake_responses')
        .select('*')
        .eq('student_id', studentId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });
}

function IntakeSectionEditor({ row, onClose }: { row: any; onClose: () => void }) {
  const { updateSection } = useIntakeSurvey();
  const queryClient = useQueryClient();
  const [data, setData] = useState<Record<string, any>>(row.responses || {});

  const save = async () => {
    try {
      await updateSection.mutateAsync({ id: row.id, responses: data });
      queryClient.invalidateQueries({ queryKey: ['intake-responses'] });
      toast.success('Intake section updated');
      onClose();
    } catch {
      toast.error('Could not save changes');
    }
  };

  const keys = Object.keys(data);
  return (
    <div className="space-y-4 border-t pt-4">
      {keys.length === 0 && <p className="text-sm text-muted-foreground italic">No editable fields in this section.</p>}
      {keys.map((k) => {
        const v = data[k];
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        if (Array.isArray(v)) {
          return (
            <div key={k} className="space-y-2">
              <Label>{label} (comma-separated)</Label>
              <Input
                value={v.join(', ')}
                onChange={(e) => setData({ ...data, [k]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          );
        }
        if (typeof v === 'number') {
          return (
            <div key={k} className="space-y-2">
              <Label>{label}</Label>
              <Input type="number" value={v} onChange={(e) => setData({ ...data, [k]: Number(e.target.value) })} />
            </div>
          );
        }
        if (typeof v === 'boolean') {
          return (
            <div key={k} className="flex items-center gap-2">
              <input type="checkbox" id={`f-${k}`} checked={v} onChange={(e) => setData({ ...data, [k]: e.target.checked })} />
              <Label htmlFor={`f-${k}`}>{label}</Label>
            </div>
          );
        }
        return (
          <div key={k} className="space-y-2">
            <Label>{label}</Label>
            <Textarea value={v ?? ''} onChange={(e) => setData({ ...data, [k]: e.target.value })} rows={2} />
          </div>
        );
      })}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={updateSection.isPending} className="rounded-full">
          <X className="mr-2 h-4 w-4" />Cancel
        </Button>
        <Button onClick={save} disabled={updateSection.isPending} className="rounded-full">
          <Save className="mr-2 h-4 w-4" />{updateSection.isPending ? 'Saving...' : 'Save section'}
        </Button>
      </div>
    </div>
  );
}

function IntakeTab({ studentId, allowDelete }: Props) {
  const self = useIntakeSurvey();
  const other = useStudentIntake(studentId);
  const responses = (studentId ? other.data : self.responses) || [];
  const isLoading = studentId ? other.isLoading : self.isLoading;
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('intake_responses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['intake-responses'] }),
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      toast.success('Intake response deleted');
    } catch {
      toast.error('Could not delete');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!responses || responses.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No intake submitted"
        description={studentId ? 'This student has not completed intake.' : 'Complete the intake survey to share context with your case manager.'}
        action={!studentId ? <Button asChild className="rounded-full"><Link to="/intake-survey">Start intake</Link></Button> : undefined}
      />
    );
  }
  return (
    <div className="space-y-4">
      {responses.map((r: any) => (
        <Card key={r.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base capitalize">{String(r.section).replace(/_/g, ' ')}</CardTitle>
                <CardDescription>
                  Submitted {format(new Date(r.created_at), 'PPP')}
                  {r.updated_at && r.updated_at !== r.created_at && (
                    <span className="ml-2 text-xs italic">· edited {format(new Date(r.updated_at), 'PPp')}</span>
                  )}
                </CardDescription>
              </div>
              {editingId !== r.id && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditingId(r.id)}>
                    <Pencil className="mr-2 h-4 w-4" />Edit
                  </Button>
                  {allowDelete && <DeleteConfirm label="this intake section" onConfirm={() => handleDelete(r.id)} />}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingId === r.id ? (
              <IntakeSectionEditor row={r} onClose={() => setEditingId(null)} />
            ) : (
              <dl className="grid gap-2 text-sm">
                {Object.entries(r.responses || {}).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[180px_1fr] gap-2">
                    <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
                    <dd>{Array.isArray(v) ? v.join(', ') : String(v ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Impact ----------
function ImpactEditor({ row, onClose }: { row: ImpactResponseRow; onClose: () => void }) {
  const update = useUpdateImpactResponse();
  const [data, setData] = useState<Record<string, any>>(row.responses || {});
  const questions = (row.template?.questions || []) as any[];

  const save = async () => {
    try {
      await update.mutateAsync({ id: row.id, responses: data });
      toast.success('Response updated');
      onClose();
    } catch {
      toast.error('Could not save changes');
    }
  };

  const renderQ = (q: any, idx: number) => {
    const key = q.id || q.key || `q_${idx}`;
    const v = data[key];
    const label = q.label || q.question || q.title || key;
    const type = q.type || 'text';
    if (type === 'scale' || type === 'number') {
      return (
        <div key={key} className="space-y-2">
          <Label>{label}</Label>
          <Input type="number" value={v ?? ''} onChange={(e) => setData({ ...data, [key]: Number(e.target.value) })} />
        </div>
      );
    }
    if (type === 'single_choice' || type === 'radio') {
      const options: string[] = q.options || [];
      return (
        <div key={key} className="space-y-2">
          <Label>{label}</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={v ?? ''}
            onChange={(e) => setData({ ...data, [key]: e.target.value })}
          >
            <option value="">Select…</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }
    return (
      <div key={key} className="space-y-2">
        <Label>{label}</Label>
        <Textarea value={v ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} rows={2} />
      </div>
    );
  };

  return (
    <div className="space-y-4 border-t pt-4">
      {questions.length > 0
        ? questions.map(renderQ)
        : Object.entries(data).map(([k, v]) => (
            <div key={k} className="space-y-2">
              <Label className="capitalize">{k.replace(/_/g, ' ')}</Label>
              <Textarea value={String(v ?? '')} onChange={(e) => setData({ ...data, [k]: e.target.value })} rows={2} />
            </div>
          ))}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={update.isPending} className="rounded-full">
          <X className="mr-2 h-4 w-4" />Cancel
        </Button>
        <Button onClick={save} disabled={update.isPending} className="rounded-full">
          <Save className="mr-2 h-4 w-4" />{update.isPending ? 'Saving...' : 'Save response'}
        </Button>
      </div>
    </div>
  );
}

function ImpactTab({ studentId, allowDelete }: Props) {
  const my = useMyImpactResponses();
  const other = useStudentImpactResponses(studentId);
  const { data: responses = [], isLoading } = studentId ? other : my;
  const [editingId, setEditingId] = useState<string | null>(null);
  const del = useDeleteImpactResponse();

  const handleDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success('Response deleted');
    } catch {
      toast.error('Could not delete');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (responses.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No impact surveys submitted"
        description={studentId ? 'This student has not completed any impact surveys.' : 'When your program sends you an impact survey, your responses will appear here.'}
      />
    );
  }
  return (
    <div className="space-y-4">
      {responses.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{r.template?.title || 'Impact Survey'}</CardTitle>
                <CardDescription>Last submitted {format(new Date(r.submitted_at), 'PPP')}</CardDescription>
              </div>
              {editingId !== r.id && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditingId(r.id)}>
                    <Pencil className="mr-2 h-4 w-4" />Edit
                  </Button>
                  {allowDelete && <DeleteConfirm label="this response" onConfirm={() => handleDelete(r.id)} />}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingId === r.id ? (
              <ImpactEditor row={r} onClose={() => setEditingId(null)} />
            ) : (
              <dl className="grid gap-2 text-sm">
                {Object.entries(r.responses || {}).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[180px_1fr] gap-2">
                    <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
                    <dd>{Array.isArray(v) ? v.join(', ') : String(v ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SubmissionsTabs({ studentId, allowDelete }: Props) {
  // counts for tab badges
  const myCheckIns = useMyCheckIns();
  const otherCheckIns = useStudentCheckIns(studentId);
  const myPlans = useMyPlans();
  const otherPlans = useStudentPlans(studentId);
  const intakeSelf = useIntakeSurvey();
  const intakeOther = useStudentIntake(studentId);
  const myImpact = useMyImpactResponses();
  const otherImpact = useStudentImpactResponses(studentId);

  const counts = {
    checkins: ((studentId ? otherCheckIns.data : myCheckIns.data) || []).length,
    plans: ((studentId ? otherPlans.data : myPlans.data) || []).length,
    intake: ((studentId ? intakeOther.data : intakeSelf.responses) || []).length,
    impact: ((studentId ? otherImpact.data : myImpact.data) || []).length,
  };

  return (
    <Tabs defaultValue="checkins" className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 rounded-full p-1">
        <TabsTrigger value="checkins" className="rounded-full">
          Check-ins <Badge variant="secondary" className="ml-2">{counts.checkins}</Badge>
        </TabsTrigger>
        <TabsTrigger value="plan" className="rounded-full">
          Plan <Badge variant="secondary" className="ml-2">{counts.plans}</Badge>
        </TabsTrigger>
        <TabsTrigger value="intake" className="rounded-full">
          Intake <Badge variant="secondary" className="ml-2">{counts.intake}</Badge>
        </TabsTrigger>
        <TabsTrigger value="impact" className="rounded-full">
          Impact <Badge variant="secondary" className="ml-2">{counts.impact}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="checkins" className="mt-6"><CheckInsTab studentId={studentId} allowDelete={allowDelete} /></TabsContent>
      <TabsContent value="plan" className="mt-6"><PostGradTab studentId={studentId} allowDelete={allowDelete} /></TabsContent>
      <TabsContent value="intake" className="mt-6"><IntakeTab studentId={studentId} allowDelete={allowDelete} /></TabsContent>
      <TabsContent value="impact" className="mt-6"><ImpactTab studentId={studentId} allowDelete={allowDelete} /></TabsContent>
    </Tabs>
  );
}
