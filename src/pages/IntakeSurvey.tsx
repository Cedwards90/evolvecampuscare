import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Home, Target, Sparkles, ChevronRight, ChevronLeft, SkipForward, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIntakeSurvey } from '@/hooks/useIntakeSurvey';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logFunnelEvent } from '@/lib/funnelEvents';

const STEPS = [
  { key: 'about_you', title: 'About You', icon: Home, description: 'Let us get to know you a little better.' },
  { key: 'daily_needs', title: 'Day-to-Day Needs', icon: Sparkles, description: 'Help us understand what your day-to-day looks like.' },
  { key: 'wellbeing', title: 'Your Wellbeing', icon: Heart, description: 'We want to make sure you feel supported.' },
  { key: 'work_income', title: 'Work & Income', icon: Briefcase, description: 'A snapshot of your current work — used to measure impact over time.' },
  { key: 'goals', title: 'Your Goals', icon: Target, description: "Let's talk about what success looks like for you." },
];

export default function IntakeSurvey() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { saveSection, completeIntake } = useIntakeSurvey();
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [livingSituation, setLivingSituation] = useState('');
  const [workStatus, setWorkStatus] = useState('');
  const [supportNetwork, setSupportNetwork] = useState('');

  // Step 2 state
  const [basicNeedsComfort, setBasicNeedsComfort] = useState([3]);
  const [dailyChallenges, setDailyChallenges] = useState<string[]>([]);
  const [focusChallenges, setFocusChallenges] = useState('');

  // Step 3 state
  const [stressLevel, setStressLevel] = useState([3]);
  const [talkSupport, setTalkSupport] = useState('');
  const [interestedResources, setInterestedResources] = useState<string[]>([]);

  // Step 4 state (Work & Income)
  const [currentlyEmployed, setCurrentlyEmployed] = useState('');
  const [baselineHourlyWage, setBaselineHourlyWage] = useState<string>('');
  const [baselineWeeklyHours, setBaselineWeeklyHours] = useState<string>('');
  const [baselineEmployer, setBaselineEmployer] = useState('');

  // Step 5 state (Goals)
  const [mainReason, setMainReason] = useState('');
  const [successVision, setSuccessVision] = useState('');
  const [anythingElse, setAnythingElse] = useState('');

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const toggleChallenge = (value: string) => {
    setDailyChallenges(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const toggleResource = (value: string) => {
    setInterestedResources(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const getSectionData = (stepIndex: number): Record<string, any> => {
    switch (stepIndex) {
      case 0:
        return { living_situation: livingSituation, work_status: workStatus, support_network: supportNetwork };
      case 1:
        return { basic_needs_comfort: basicNeedsComfort[0], daily_challenges: dailyChallenges, focus_challenges: focusChallenges };
      case 2:
        return { stress_level: stressLevel[0], talk_support: talkSupport, interested_resources: interestedResources };
      case 3:
        return {
          currently_employed: currentlyEmployed,
          baseline_hourly_wage: baselineHourlyWage ? Number(baselineHourlyWage) : null,
          baseline_weekly_hours: baselineWeeklyHours ? Number(baselineWeeklyHours) : null,
          baseline_employer: baselineEmployer,
        };
      case 4:
        return { main_reason: mainReason, success_vision: successVision, anything_else: anythingElse };
      default:
        return {};
    }
  };

  const seedParticipantOutcomes = async () => {
    if (!user?.id) return;
    const baseline = baselineHourlyWage ? Number(baselineHourlyWage) : null;
    const weekly = baselineWeeklyHours ? Number(baselineWeeklyHours) : null;
    if (!baseline && !weekly && !baselineEmployer && !currentlyEmployed) return;
    try {
      const { data: existing } = await supabase
        .from('participant_outcomes')
        .select('id')
        .eq('student_id', user.id)
        .maybeSingle();
      const row: Record<string, any> = {
        student_id: user.id,
        baseline_wage: baseline,
        weekly_hours: weekly,
        employer: baselineEmployer || null,
        employment_status:
          currentlyEmployed === 'Yes — full-time'
            ? 'employed_full_time'
            : currentlyEmployed === 'Yes — part-time'
            ? 'employed_part_time'
            : currentlyEmployed === 'No'
            ? 'unemployed'
            : null,
      };
      if (existing) {
        await supabase.from('participant_outcomes').update(row).eq('id', existing.id);
      } else {
        await supabase.from('participant_outcomes').insert(row);
      }
    } catch (e) {
      console.warn('Could not seed participant_outcomes', e);
    }
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      await saveSection.mutateAsync({
        section: STEPS[currentStep].key,
        responses: getSectionData(currentStep),
      });

      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        await completeIntake.mutateAsync();
        toast({ title: 'Thank you!', description: 'Your responses have been saved. We are here for you.' });
        navigate('/dashboard');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => navigate('/dashboard');

  const needsLabels = ['Very comfortable', 'Comfortable', 'Getting by', 'Difficult', 'Struggling'];
  const stressLabels = ['Very low', 'Low', 'Moderate', 'High', 'Very high'];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <step.icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Step {currentStep + 1} of {STEPS.length}</p>
            <CardTitle className="text-2xl">{step.title}</CardTitle>
            <CardDescription className="mt-2">{step.description}</CardDescription>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground italic">
            This helps us understand how to best support you. All responses are confidential and you can skip any question.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: About You */}
          {currentStep === 0 && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">What best describes your current living situation?</Label>
                <RadioGroup value={livingSituation} onValueChange={setLivingSituation} className="grid gap-2">
                  {['On campus', 'Off campus with family', 'Off campus independently', 'Transitional/temporary', 'Prefer not to say'].map(opt => (
                    <div key={opt} className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={opt} id={`living-${opt}`} />
                      <Label htmlFor={`living-${opt}`} className="flex-1 cursor-pointer text-sm">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Are you currently working?</Label>
                <RadioGroup value={workStatus} onValueChange={setWorkStatus} className="grid gap-2">
                  {['Not working', 'Part-time', 'Full-time', 'Prefer not to say'].map(opt => (
                    <div key={opt} className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={opt} id={`work-${opt}`} />
                      <Label htmlFor={`work-${opt}`} className="flex-1 cursor-pointer text-sm">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">How would you describe your support network?</Label>
                <RadioGroup value={supportNetwork} onValueChange={setSupportNetwork} className="grid gap-2">
                  {['Strong — I have people I can count on', 'Some support — a few people I trust', 'Limited — I often feel on my own', 'Prefer not to say'].map(opt => (
                    <div key={opt} className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={opt} id={`support-${opt}`} />
                      <Label htmlFor={`support-${opt}`} className="flex-1 cursor-pointer text-sm">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </>
          )}

          {/* Step 2: Day-to-Day Needs */}
          {currentStep === 1 && (
            <>
              <div className="space-y-4">
                <Label className="text-sm font-medium">How comfortable do you feel meeting your basic needs right now?</Label>
                <div className="px-2">
                  <Slider value={basicNeedsComfort} onValueChange={setBasicNeedsComfort} min={1} max={5} step={1} />
                  <div className="flex justify-between mt-2">
                    {needsLabels.map((label, i) => (
                      <span key={i} className={`text-xs ${basicNeedsComfort[0] === i + 1 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Check any that apply to you right now:</Label>
                <div className="grid gap-2">
                  {['Food security concerns', 'Transportation challenges', 'Childcare needs', 'Technology/internet access', 'None of these'].map(item => (
                    <div key={item} className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={`challenge-${item}`}
                        checked={dailyChallenges.includes(item)}
                        onCheckedChange={() => toggleChallenge(item)}
                      />
                      <Label htmlFor={`challenge-${item}`} className="flex-1 cursor-pointer text-sm">{item}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Is there anything making it harder to focus on your studies?</Label>
                <Textarea
                  placeholder="Feel free to share, or leave blank..."
                  value={focusChallenges}
                  onChange={(e) => setFocusChallenges(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </>
          )}

          {/* Step 3: Your Wellbeing */}
          {currentStep === 2 && (
            <>
              <div className="space-y-4">
                <Label className="text-sm font-medium">Over the past few weeks, how would you rate your overall stress level?</Label>
                <div className="px-2">
                  <Slider value={stressLevel} onValueChange={setStressLevel} min={1} max={5} step={1} />
                  <div className="flex justify-between mt-2">
                    {stressLabels.map((label, i) => (
                      <span key={i} className={`text-xs ${stressLevel[0] === i + 1 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">How often do you feel you have someone to talk to when things get tough?</Label>
                <RadioGroup value={talkSupport} onValueChange={setTalkSupport} className="grid gap-2">
                  {['Always', 'Sometimes', 'Rarely', 'Prefer not to say'].map(opt => (
                    <div key={opt} className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={opt} id={`talk-${opt}`} />
                      <Label htmlFor={`talk-${opt}`} className="flex-1 cursor-pointer text-sm">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Would you be interested in connecting with any of these resources?</Label>
                <div className="grid gap-2">
                  {['Counseling services', 'Peer mentoring', 'Wellness workshops', 'Crisis support', 'Not right now'].map(item => (
                    <div key={item} className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={`resource-${item}`}
                        checked={interestedResources.includes(item)}
                        onCheckedChange={() => toggleResource(item)}
                      />
                      <Label htmlFor={`resource-${item}`} className="flex-1 cursor-pointer text-sm">{item}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 4: Your Goals */}
          {currentStep === 3 && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">What's the main reason you're reaching out for support?</Label>
                <RadioGroup value={mainReason} onValueChange={setMainReason} className="grid gap-2">
                  {['Academic challenges', 'Financial hardship', 'Personal/emotional wellbeing', 'Housing concerns', 'Just exploring resources', 'Other'].map(opt => (
                    <div key={opt} className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={opt} id={`reason-${opt}`} />
                      <Label htmlFor={`reason-${opt}`} className="flex-1 cursor-pointer text-sm">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">What does a successful semester look like for you?</Label>
                <Textarea
                  placeholder="Share your vision — big or small..."
                  value={successVision}
                  onChange={(e) => setSuccessVision(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Anything else you'd like us to know?</Label>
                <Textarea
                  placeholder="Totally optional..."
                  value={anythingElse}
                  onChange={(e) => setAnythingElse(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep(currentStep - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSkip}>
                <SkipForward className="mr-1 h-4 w-4" /> Skip for Now
              </Button>
              <Button size="sm" onClick={handleNext} disabled={saving}>
                {saving ? 'Saving...' : currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
                {currentStep < STEPS.length - 1 && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
