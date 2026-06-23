import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GraduationCap, Home, Target, Heart, Eye, Sparkles, Briefcase, BookOpen } from 'lucide-react';
import {
  LIFESKILLS_MODULES,
  buildPreTemplate,
  buildPostTemplate,
  FINAL_TEMPLATE,
  LIFESKILLS_FINAL_SLUG,
  preSlug,
  postSlug,
  type LifeSkillsTemplateBlueprint,
  type SurveyQuestion,
} from '@/lib/lifeskillsTemplates';

/* ---------------- Check-in ---------------- */
function CheckInPreview() {
  const moodLabels = ['😔 Struggling', '😕 Not Great', '😐 Okay', '🙂 Good', '😊 Great'];
  const progressLabels = ['Struggling', 'Behind', 'On Track', 'Progressing Well', 'Thriving'];

  return (
    <div className="space-y-6">
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">How are you feeling?</CardTitle>
          <CardDescription>Rate your overall mood and progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Mood: <span className="text-primary font-semibold">{moodLabels[2]}</span></Label>
            <Slider value={[3]} min={1} max={5} step={1} disabled />
          </div>
          <div className="space-y-4">
            <Label className="text-sm font-medium">Progress: <span className="text-primary font-semibold">{progressLabels[2]}</span></Label>
            <Slider value={[3]} min={1} max={5} step={1} disabled />
          </div>
          <div className="space-y-2"><Label>What's going well? 🎉</Label><Textarea placeholder="Share any wins or positive moments..." disabled rows={3} /></div>
          <div className="space-y-2"><Label>Any blockers or challenges? 🚧</Label><Textarea placeholder="Anything holding you back or causing stress..." disabled rows={3} /></div>
          <div className="space-y-2"><Label>Anything else you'd like to share?</Label><Textarea placeholder="Any other thoughts..." disabled rows={2} /></div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Post-grad ---------------- */
const POST_GRAD_STEPS = [
  { key: 'goals', title: 'Career & Education', icon: GraduationCap, description: 'Your career and education goals for the first year after graduation.' },
  { key: 'living', title: 'Housing & Finances', icon: Home, description: 'Plan for your living situation and financial stability.' },
  { key: 'milestones', title: 'Quarterly Milestones', icon: Target, description: 'Break your year into quarterly action items.' },
  { key: 'support', title: 'Wellness & Support', icon: Heart, description: "Your health plan and the support you'll need." },
];

function PostGradPlanPreview() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-base font-bold">12-Month Post-Graduation Plan</h3>
        <p className="text-sm text-muted-foreground">4-step wizard shown to students</p>
        <Progress value={25} className="h-2 mt-2" />
      </div>
      {POST_GRAD_STEPS.map((step, idx) => (
        <Card key={step.key}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><step.icon className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle className="text-base">Step {idx + 1}: {step.title}</CardTitle>
                <CardDescription className="text-xs">{step.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {idx === 0 && <>
              <div className="space-y-2"><Label>Expected Graduation Date</Label><Input type="date" disabled /></div>
              <div className="space-y-2"><Label>Career Goals</Label><Textarea disabled rows={3} /></div>
              <div className="space-y-2"><Label>Education Goals</Label><Textarea disabled rows={3} /></div>
            </>}
            {idx === 1 && <>
              <div className="space-y-2"><Label>Housing Plan</Label><Textarea disabled rows={3} /></div>
              <div className="space-y-2"><Label>Financial Plan</Label><Textarea disabled rows={3} /></div>
            </>}
            {idx === 2 && <>
              <div className="space-y-2"><Label>Months 1–3</Label><Textarea disabled rows={2} /></div>
              <div className="space-y-2"><Label>Months 4–6</Label><Textarea disabled rows={2} /></div>
              <div className="space-y-2"><Label>Months 7–9</Label><Textarea disabled rows={2} /></div>
              <div className="space-y-2"><Label>Months 10–12</Label><Textarea disabled rows={2} /></div>
            </>}
            {idx === 3 && <>
              <div className="space-y-2"><Label>Health & Wellness</Label><Textarea disabled rows={3} /></div>
              <div className="space-y-2"><Label>Support Needed</Label><Textarea disabled rows={3} /></div>
              <div className="space-y-2"><Label>Additional Notes</Label><Textarea disabled rows={2} /></div>
            </>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Sensitive Intake ---------------- */
const INTAKE_STEPS = [
  { title: 'About You', icon: Home, fields: ['Living situation', 'Work status', 'Support network'] },
  { title: 'Day-to-Day Needs', icon: Sparkles, fields: ['Basic needs comfort (1–5)', 'Daily challenges (multi-select)', 'Focus challenges'] },
  { title: 'Your Wellbeing', icon: Heart, fields: ['Stress level (1–5)', 'Who do you talk to?', 'Resources you\'re interested in'] },
  { title: 'Work & Income', icon: Briefcase, fields: ['Currently employed?', 'Baseline hourly wage', 'Baseline weekly hours', 'Baseline employer'] },
  { title: 'Your Goals', icon: Target, fields: ['Main reason you\'re here', 'Vision of success', 'Anything else to share'] },
];

function IntakePreview() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">5-step onboarding intake shown to every new student. Each section is optional and can be skipped.</p>
      {INTAKE_STEPS.map((s, i) => (
        <Card key={s.title}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><s.icon className="h-5 w-5 text-primary" /></div>
              <CardTitle className="text-base">Step {i + 1}: {s.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              {s.fields.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Career Intake ---------------- */
const CAREER_INTAKE_SECTIONS = [
  { title: 'Status & Goals', fields: ['Student status', 'Educational goal', 'Referral sources', 'Areas where you want assistance', 'Obstacles you face'] },
  { title: 'Academic Background', fields: ['Current major', 'Considered majors', 'Favorite subjects', 'Least favorite subjects'] },
  { title: 'Career Direction', fields: ['Dream career', 'Career influences', 'One accomplishment goal'] },
  { title: 'Skills & Experience', fields: ['Strengths & skills', 'Work experience', 'Prior career assessments'] },
  { title: 'Access & Availability', fields: ['Computer access', 'Internet skill level', 'Weekly availability grid'] },
];

function CareerIntakePreview() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Career discovery form shown during onboarding. Captures interests, strengths, and goals.</p>
      {CAREER_INTAKE_SECTIONS.map((s) => (
        <Card key={s.title}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              {s.fields.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Impact / Life Skills (template-driven) ---------------- */
function blueprintForSlug(slug: string): LifeSkillsTemplateBlueprint | null {
  if (slug === LIFESKILLS_FINAL_SLUG) return FINAL_TEMPLATE;
  const preMatch = LIFESKILLS_MODULES.find((m) => preSlug(m.id) === slug);
  if (preMatch) return buildPreTemplate(preMatch);
  const postMatch = LIFESKILLS_MODULES.find((m) => postSlug(m.id) === slug);
  if (postMatch) return buildPostTemplate(postMatch);
  return null;
}

function QuestionField({ q }: { q: SurveyQuestion }) {
  if (q.type === 'scale_1_5') {
    return (
      <div className="space-y-2">
        <Label className="text-sm">{q.label}</Label>
        <Slider value={[3]} min={1} max={5} step={1} disabled />
        <div className="flex justify-between text-xs text-muted-foreground"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
      </div>
    );
  }
  if (q.type === 'open') {
    return (
      <div className="space-y-2">
        <Label className="text-sm">{q.label}</Label>
        <Textarea disabled rows={3} placeholder={q.placeholder} />
      </div>
    );
  }
  if (q.type === 'choice_5') {
    return (
      <div className="space-y-2">
        <Label className="text-sm">{q.label}</Label>
        <RadioGroup disabled>
          {q.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem value={opt} id={`${q.id}-${opt}`} disabled />
              <Label htmlFor={`${q.id}-${opt}`} className="text-sm font-normal">{opt}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }
  // nps
  return (
    <div className="space-y-2">
      <Label className="text-sm">{q.label}</Label>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-8 w-8 rounded-md border text-xs flex items-center justify-center text-muted-foreground">{i}</div>
        ))}
      </div>
    </div>
  );
}

function ImpactPreview({ slug }: { slug: string }) {
  const bp = blueprintForSlug(slug);
  if (!bp) return <p className="text-sm text-muted-foreground">No preview available for this survey.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-base font-bold">{bp.title}</h3>
        {bp.description && <p className="text-sm text-muted-foreground">{bp.description}</p>}
      </div>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {bp.questions.map((q) => <QuestionField key={q.id} q={q} />)}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Dialog ---------------- */
export type PreviewSurveyType =
  | 'checkin'
  | 'post_grad'
  | 'intake'
  | 'career_intake'
  | `impact:${string}`;

interface SurveyPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyType: PreviewSurveyType;
}

const TITLES: Record<string, string> = {
  checkin: '3-Week Check-In',
  post_grad: '12-Month Post-Graduation Plan',
  intake: 'Student Intake Survey',
  career_intake: 'Career Intake Survey',
};

export function SurveyPreviewDialog({ open, onOpenChange, surveyType }: SurveyPreviewDialogProps) {
  const isImpact = surveyType.startsWith('impact:');
  const impactSlug = isImpact ? surveyType.slice('impact:'.length) : '';
  const title = isImpact
    ? blueprintForSlug(impactSlug)?.title || 'Life Skills Survey'
    : TITLES[surveyType] || 'Survey';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>
            <Badge variant="outline" className="mt-1">Preview — this is what students see</Badge>
          </DialogDescription>
        </DialogHeader>
        {surveyType === 'checkin' && <CheckInPreview />}
        {surveyType === 'post_grad' && <PostGradPlanPreview />}
        {surveyType === 'intake' && <IntakePreview />}
        {surveyType === 'career_intake' && <CareerIntakePreview />}
        {isImpact && <ImpactPreview slug={impactSlug} />}
      </DialogContent>
    </Dialog>
  );
}
