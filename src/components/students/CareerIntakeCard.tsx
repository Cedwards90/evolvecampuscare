import { useEffect, useState } from 'react';
import { ClipboardList, Pencil, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/EmptyState';
import { useCareerIntake, type CareerIntake } from '@/hooks/useCareerIntake';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const STUDENT_STATUSES = ['Prospective', 'Continuing', 'Alumni', 'New', 'Returning', 'Other'];
const ASSISTANCE_AREAS = [
  'Choosing my major/career path',
  'Confirming my choice of major/career path',
  'Changing my major/career path',
  'Researching specific majors/career paths',
  'Other',
];
const EDUCATIONAL_GOALS = ['Certificate', 'Associate Degree', 'Transfer to four-year', 'Unsure'];
const REFERRAL_SOURCES = ['Counselor/Advisor', 'Friend/Fellow Student', 'Staff Member', 'Alumni', 'Instructor', 'Family Member', 'Website', 'Other'];
const OBSTACLES = ['Indecisiveness', 'Lack of major or career information', 'Too many interests', 'Lack of interests', 'Academic issues', 'Low motivation', 'Low confidence', 'Pressure from others', 'Disability', 'Health issue (physical/mental)', 'Other'];
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

interface Props {
  studentId: string;
  canEdit: boolean;
}

export function CareerIntakeCard({ studentId, canEdit }: Props) {
  const { intake, isLoading, upsert } = useCareerIntake(studentId);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Career Intake Form
          </CardTitle>
          <CardDescription>
            {intake?.completed_at
              ? `Completed ${format(new Date(intake.completed_at), 'PPP')}`
              : intake
              ? 'In progress'
              : 'Not started'}
          </CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {intake ? 'Edit' : 'Start'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? null : !intake ? (
          <EmptyState
            icon={ClipboardList}
            title="No intake form yet"
            description={canEdit ? 'Complete the career intake form with the student.' : 'Your case manager has not added this yet.'}
          />
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Status" value={intake.student_status} />
              <Field label="Educational Goal" value={intake.educational_goal} />
              <Field label="Dream Career" value={intake.dream_career} />
              <Field label="Computer Access" value={intake.has_computer_access == null ? null : intake.has_computer_access ? 'Yes' : 'No'} />
            </div>
            {intake.assistance_areas.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assistance areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {intake.assistance_areas.map((a) => <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>)}
                </div>
              </div>
            )}
            {intake.obstacles.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Obstacles</p>
                <div className="flex flex-wrap gap-1.5">
                  {intake.obstacles.map((a) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}
                </div>
              </div>
            )}
            {intake.strengths_skills && <Field label="Strengths & skills" value={intake.strengths_skills} multiline />}
            {intake.work_experience && <Field label="Work experience" value={intake.work_experience} multiline />}
            {intake.completed_at && (
              <div className="inline-flex items-center gap-1 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
              </div>
            )}
          </div>
        )}
      </CardContent>

      {canEdit && (
        <CareerIntakeDialog
          open={open}
          onOpenChange={setOpen}
          existing={intake}
          onSave={async (input) => { await upsert.mutateAsync(input); }}
        />
      )}
    </Card>
  );
}

function Field({ label, value, multiline }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={multiline ? 'whitespace-pre-wrap' : ''}>{value}</p>
    </div>
  );
}

function MultiCheck({ options, value, onChange }: { options: string[]; value: string[] | null | undefined; onChange: (v: string[]) => void }) {
  const safe = value ?? [];
  return _MultiCheckImpl({ options, value: safe, onChange });
}
function _MultiCheckImpl({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {options.map((opt) => {
        const checked = value.includes(opt);
        return (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => {
                if (c) onChange([...value, opt]);
                else onChange(value.filter((v) => v !== opt));
              }}
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function CareerIntakeDialog({
  open,
  onOpenChange,
  existing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: CareerIntake | null | undefined;
  onSave: (input: any) => Promise<void>;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [markComplete, setMarkComplete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      student_status: existing?.student_status ?? '',
      educational_goal: existing?.educational_goal ?? '',
      referral_sources: existing?.referral_sources ?? [],
      assistance_areas: existing?.assistance_areas ?? [],
      obstacles: existing?.obstacles ?? [],
      current_major: existing?.current_major ?? '',
      accomplishment_goal: existing?.accomplishment_goal ?? '',
      career_influences: existing?.career_influences ?? '',
      dream_career: existing?.dream_career ?? '',
      considered_majors: existing?.considered_majors ?? '',
      favorite_subjects: existing?.favorite_subjects ?? '',
      least_favorite_subjects: existing?.least_favorite_subjects ?? '',
      strengths_skills: existing?.strengths_skills ?? '',
      work_experience: existing?.work_experience ?? '',
      prior_assessments: existing?.prior_assessments ?? '',
      has_computer_access: existing?.has_computer_access,
      internet_skill_level: existing?.internet_skill_level ?? '',
    });
    setMarkComplete(!!existing?.completed_at);
  }, [open, existing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...form,
        completed_at: markComplete ? (existing?.completed_at || new Date().toISOString()) : null,
      });
      toast({ title: 'Career intake saved' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Career Intake Form</DialogTitle>
          <DialogDescription>Modeled after the AVC Career Center intake.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="text-xs">Student Status</Label>
            <RadioGroup
              value={form.student_status}
              onValueChange={(v) => setForm({ ...form, student_status: v })}
              className="flex flex-wrap gap-3 mt-1"
            >
              {STUDENT_STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <RadioGroupItem value={s} /> {s}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs mb-1 block">How did you hear about the Career Center?</Label>
            <MultiCheck options={REFERRAL_SOURCES} value={form.referral_sources} onChange={(v) => setForm({ ...form, referral_sources: v })} />
          </div>

          <div>
            <Label className="text-xs mb-1 block">Assistance areas</Label>
            <MultiCheck options={ASSISTANCE_AREAS} value={form.assistance_areas} onChange={(v) => setForm({ ...form, assistance_areas: v })} />
            {(form.assistance_areas ?? []).includes('Changing my major/career path') && (
              <div className="mt-2">
                <Label className="text-xs">Current major</Label>
                <Input value={form.current_major} onChange={(e) => setForm({ ...form, current_major: e.target.value })} />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Educational Goal</Label>
            <RadioGroup
              value={form.educational_goal}
              onValueChange={(v) => setForm({ ...form, educational_goal: v })}
              className="flex flex-wrap gap-3 mt-1"
            >
              {EDUCATIONAL_GOALS.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <RadioGroupItem value={s} /> {s}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Obstacles / challenges</Label>
            <MultiCheck options={OBSTACLES} value={form.obstacles} onChange={(v) => setForm({ ...form, obstacles: v })} />
          </div>

          <Separator />

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Have you taken any career assessments?</Label>
              <Input value={form.prior_assessments} onChange={(e) => setForm({ ...form, prior_assessments: e.target.value })} placeholder="None / specify" />
            </div>
            <div>
              <Label className="text-xs">Computer w/ internet access</Label>
              <RadioGroup
                value={form.has_computer_access == null ? '' : form.has_computer_access ? 'yes' : 'no'}
                onValueChange={(v) => setForm({ ...form, has_computer_access: v === 'yes' })}
                className="flex gap-4 mt-2"
              >
                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value="yes" /> Yes</label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value="no" /> No</label>
              </RadioGroup>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Internet research skill level</Label>
              <RadioGroup
                value={form.internet_skill_level}
                onValueChange={(v) => setForm({ ...form, internet_skill_level: v })}
                className="flex gap-4 mt-1"
              >
                {SKILL_LEVELS.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value={s} /> {s}</label>
                ))}
              </RadioGroup>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            {[
              ['accomplishment_goal', 'Most important thing to accomplish through working with the Career Center'],
              ['career_influences', 'Biggest influences on your career interests and why'],
              ['dream_career', 'If you could do anything as your career, what would it be?'],
              ['considered_majors', 'Majors and careers you have considered so far'],
              ['favorite_subjects', 'Favorite school subjects and why'],
              ['least_favorite_subjects', 'Least favorite school subjects and why'],
              ['strengths_skills', 'Strengths, skills, and/or talents'],
              ['work_experience', 'Jobs/internships/volunteer experiences you have liked and/or disliked'],
            ].map(([k, lbl]) => (
              <div key={k}>
                <Label className="text-xs">{lbl}</Label>
                <Textarea
                  value={form[k] || ''}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="min-h-[60px]"
                  maxLength={2000}
                />
              </div>
            ))}
          </div>

          <Separator />

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={markComplete} onCheckedChange={(c) => setMarkComplete(!!c)} />
            <span className="text-sm">Mark intake as complete</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
