import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { useCareerIntake } from '@/hooks/useCareerIntake';
import { useToast } from '@/hooks/use-toast';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { DraftIndicator } from '@/components/forms/DraftIndicator';

const STUDENT_STATUSES = ['Prospective', 'Continuing', 'Alumni', 'New', 'Returning', 'Other'];
const ASSISTANCE_AREAS = [
  'Choosing my major/career path',
  'Confirming my choice of major/career path',
  'Changing my major/career path',
  'Researching specific majors/career paths',
  'Other',
];
const EDUCATIONAL_GOALS = ['Certificate', 'Associate Degree', 'Transfer to four-year', 'Unsure'];
const OBSTACLES = ['Indecisiveness', 'Lack of major or career information', 'Too many interests', 'Lack of interests', 'Academic issues', 'Low motivation', 'Low confidence', 'Pressure from others', 'Disability', 'Health issue (physical/mental)', 'Other'];

export default function CareerIntakeOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { intake, upsert } = useCareerIntake(user?.id);
  const restoredDraftRef = useRef(false);

  const [studentStatus, setStudentStatus] = useState<string>('');
  const [educationalGoal, setEducationalGoal] = useState<string>('');
  const [currentMajor, setCurrentMajor] = useState('');
  const [dreamCareer, setDreamCareer] = useState('');
  const [careerInfluences, setCareerInfluences] = useState('');
  const [favoriteSubjects, setFavoriteSubjects] = useState('');
  const [strengthsSkills, setStrengthsSkills] = useState('');
  const [assistanceAreas, setAssistanceAreas] = useState<string[]>([]);
  const [obstacles, setObstacles] = useState<string[]>([]);

  const draftValues = useMemo(
    () => ({
      studentStatus,
      educationalGoal,
      currentMajor,
      dreamCareer,
      careerInfluences,
      favoriteSubjects,
      strengthsSkills,
      assistanceAreas,
      obstacles,
    }),
    [studentStatus, educationalGoal, currentMajor, dreamCareer, careerInfluences, favoriteSubjects, strengthsSkills, assistanceAreas, obstacles],
  );
  const { clear: clearDraft, savedAt, hasDraft } = useFormPersistence(
    'career-intake-onboarding',
    draftValues,
    (v) => {
      setStudentStatus(v.studentStatus ?? '');
      setEducationalGoal(v.educationalGoal ?? '');
      setCurrentMajor(v.currentMajor ?? '');
      setDreamCareer(v.dreamCareer ?? '');
      setCareerInfluences(v.careerInfluences ?? '');
      setFavoriteSubjects(v.favoriteSubjects ?? '');
      setStrengthsSkills(v.strengthsSkills ?? '');
      setAssistanceAreas(Array.isArray(v.assistanceAreas) ? v.assistanceAreas : []);
      setObstacles(Array.isArray(v.obstacles) ? v.obstacles : []);
    },
    {
      label: 'the Career Intake',
      onRestore: () => {
        restoredDraftRef.current = true;
      },
      shouldPersist: (v) =>
        !!(v.studentStatus || v.educationalGoal || v.currentMajor || v.dreamCareer || v.careerInfluences || v.favoriteSubjects || v.strengthsSkills || v.assistanceAreas?.length || v.obstacles?.length),
    },
  );

  useEffect(() => {
    if (!intake) return;
    if (restoredDraftRef.current) return;
    setStudentStatus(intake.student_status ?? '');
    setEducationalGoal(intake.educational_goal ?? '');
    setCurrentMajor(intake.current_major ?? '');
    setDreamCareer(intake.dream_career ?? '');
    setCareerInfluences(intake.career_influences ?? '');
    setFavoriteSubjects(intake.favorite_subjects ?? '');
    setStrengthsSkills(intake.strengths_skills ?? '');
    setAssistanceAreas(intake.assistance_areas ?? []);
    setObstacles(intake.obstacles ?? []);
  }, [intake]);

  const toggle = (list: string[], v: string, set: (l: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const handleSubmit = async () => {
    if (!studentStatus || !educationalGoal) {
      toast({ title: 'Please complete required fields', variant: 'destructive' });
      return;
    }
    try {
      await upsert.mutateAsync({
        student_status: studentStatus,
        educational_goal: educationalGoal,
        current_major: currentMajor || null,
        dream_career: dreamCareer || null,
        career_influences: careerInfluences || null,
        favorite_subjects: favoriteSubjects || null,
        strengths_skills: strengthsSkills || null,
        assistance_areas: assistanceAreas,
        obstacles,
        completed_at: new Date().toISOString(),
      });
      await qc.invalidateQueries({ queryKey: ['onboarding-status'] });
      clearDraft();
      navigate('/onboarding/cmf-basics');
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <OnboardingShell
      step={3}
      title="Career Intake"
      description="Tell us about your goals so your case manager can support you effectively."
    >
      <div className="space-y-2">
        <Label>Student status *</Label>
        <RadioGroup value={studentStatus} onValueChange={setStudentStatus} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STUDENT_STATUSES.map((s) => (
            <Label key={s} className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer">
              <RadioGroupItem value={s} /> {s}
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Educational goal *</Label>
        <RadioGroup value={educationalGoal} onValueChange={setEducationalGoal} className="grid grid-cols-2 gap-2">
          {EDUCATIONAL_GOALS.map((g) => (
            <Label key={g} className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer">
              <RadioGroupItem value={g} /> {g}
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="major">Current/intended major</Label>
          <Input id="major" value={currentMajor} onChange={(e) => setCurrentMajor(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dream">Dream career</Label>
          <Input id="dream" value={dreamCareer} onChange={(e) => setDreamCareer(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="inf">Who or what has influenced your career thinking?</Label>
        <Textarea id="inf" value={careerInfluences} onChange={(e) => setCareerInfluences(e.target.value)} rows={2} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fav">Favorite subjects</Label>
        <Input id="fav" value={favoriteSubjects} onChange={(e) => setFavoriteSubjects(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="str">Your strengths and skills</Label>
        <Textarea id="str" value={strengthsSkills} onChange={(e) => setStrengthsSkills(e.target.value)} rows={2} />
      </div>

      <div className="space-y-2">
        <Label>What kind of help are you seeking?</Label>
        <div className="space-y-2">
          {ASSISTANCE_AREAS.map((a) => (
            <Label key={a} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={assistanceAreas.includes(a)} onCheckedChange={() => toggle(assistanceAreas, a, setAssistanceAreas)} />
              {a}
            </Label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Obstacles you face</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {OBSTACLES.map((o) => (
            <Label key={o} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={obstacles.includes(o)} onCheckedChange={() => toggle(obstacles, o, setObstacles)} />
              {o}
            </Label>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSubmit} disabled={upsert.isPending} className="rounded-full">
          {upsert.isPending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
      <DraftIndicator savedAt={savedAt} hasDraft={hasDraft} onDiscard={() => { clearDraft(); setStudentStatus(''); setEducationalGoal(''); setCurrentMajor(''); setDreamCareer(''); setCareerInfluences(''); setFavoriteSubjects(''); setStrengthsSkills(''); setAssistanceAreas([]); setObstacles([]); }} className="justify-end" />
    </OnboardingShell>
  );
}
