import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, GraduationCap, Home, DollarSign, Heart, Target, ChevronRight, ChevronLeft, CheckCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useSubmitPlan } from '@/hooks/usePostGraduationPlan';
import { useMarkSurveyComplete } from '@/hooks/useSurveyInvitations';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageNav } from '@/components/navigation/PageNav';
import { downloadPlanPdf } from '@/lib/wellbeingExport';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgName } from '@/hooks/useOrgName';

const STEPS = [
  { key: 'goals', title: 'Career & Education', icon: GraduationCap, description: 'Your career and education goals for the first year after graduation.' },
  { key: 'living', title: 'Housing & Finances', icon: Home, description: 'Plan for your living situation and financial stability.' },
  { key: 'milestones', title: 'Quarterly Milestones', icon: Target, description: 'Break your year into quarterly action items.' },
  { key: 'support', title: 'Wellness & Support', icon: Heart, description: "Your health plan and the support you'll need." },
];

export default function PostGraduationPlan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const submitPlan = useSubmitPlan();
  const markComplete = useMarkSurveyComplete();
  const { profile } = useAuth();
  const orgName = useOrgName((profile as any)?.organization_id);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // Form state
  const [graduationDate, setGraduationDate] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  const [educationGoals, setEducationGoals] = useState('');
  const [housingPlan, setHousingPlan] = useState('');
  const [financialPlan, setFinancialPlan] = useState('');
  const [healthWellness, setHealthWellness] = useState('');
  const [supportNeeded, setSupportNeeded] = useState('');
  const [month13, setMonth13] = useState('');
  const [month46, setMonth46] = useState('');
  const [month79, setMonth79] = useState('');
  const [month1012, setMonth1012] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      await submitPlan.mutateAsync({
        graduation_date: graduationDate || null,
        career_goals: careerGoals,
        education_goals: educationGoals,
        housing_plan: housingPlan,
        financial_plan: financialPlan,
        health_wellness: healthWellness,
        support_needed: supportNeeded,
        month_1_3_actions: month13,
        month_4_6_actions: month46,
        month_7_9_actions: month79,
        month_10_12_actions: month1012,
        additional_notes: additionalNotes,
      });
      setSubmittedAt(new Date().toISOString());
      setSubmitted(true);
      toast({ title: 'Plan submitted!', description: 'Your 12-month post-graduation plan has been saved.' });
      markComplete.mutate('post_graduation_plan');
    } catch {
      toast({ title: 'Error', description: 'Failed to submit your plan. Please try again.', variant: 'destructive' });
    }
  };

  if (submitted) {
    return (
      <SidebarLayout>
        <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-h2 font-bold">Plan Submitted!</h1>
          <p className="text-muted-foreground">Your 12-month post-graduation plan has been saved. Your case manager can now view it.</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                downloadPlanPdf(
                  {
                    id: 'local',
                    created_at: submittedAt || new Date().toISOString(),
                    graduation_date: graduationDate || null,
                    career_goals: careerGoals,
                    education_goals: educationGoals,
                    housing_plan: housingPlan,
                    financial_plan: financialPlan,
                    health_wellness: healthWellness,
                    support_needed: supportNeeded,
                    month_1_3_actions: month13,
                    month_4_6_actions: month46,
                    month_7_9_actions: month79,
                    month_10_12_actions: month1012,
                    additional_notes: additionalNotes || null,
                  },
                  profile?.full_name,
                )
              }
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <PageNav fallback="/dashboard" />
        <div>
          <h1 className="font-display text-h2 font-bold">12-Month Post-Graduation Plan</h1>
          <p className="text-muted-foreground">Plan your first year after graduation across career, housing, finances, and more.</p>
        </div>

        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-right">Step {currentStep + 1} of {STEPS.length}</p>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {currentStep === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Expected Graduation Date</Label>
                  <Input type="date" value={graduationDate} onChange={e => setGraduationDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Career Goals</Label>
                  <Textarea
                    placeholder="What type of job or career path are you aiming for? What steps will you take?"
                    value={careerGoals}
                    onChange={e => setCareerGoals(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Education Goals</Label>
                  <Textarea
                    placeholder="Are you planning further education, certifications, or training?"
                    value={educationGoals}
                    onChange={e => setEducationGoals(e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Housing Plan</Label>
                  <Textarea
                    placeholder="Where do you plan to live? What steps do you need to take to secure housing?"
                    value={housingPlan}
                    onChange={e => setHousingPlan(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Financial Plan</Label>
                  <Textarea
                    placeholder="How will you manage your finances? Savings goals, budgeting, income sources?"
                    value={financialPlan}
                    onChange={e => setFinancialPlan(e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Months 1–3: Actions & Milestones</Label>
                  <Textarea
                    placeholder="What will you focus on in the first 3 months after graduation?"
                    value={month13}
                    onChange={e => setMonth13(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Months 4–6: Actions & Milestones</Label>
                  <Textarea
                    placeholder="What do you want to achieve by the 6-month mark?"
                    value={month46}
                    onChange={e => setMonth46(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Months 7–9: Actions & Milestones</Label>
                  <Textarea
                    placeholder="What progress do you expect by 9 months?"
                    value={month79}
                    onChange={e => setMonth79(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Months 10–12: Actions & Milestones</Label>
                  <Textarea
                    placeholder="Where do you want to be at the 1-year mark?"
                    value={month1012}
                    onChange={e => setMonth1012(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Health & Wellness</Label>
                  <Textarea
                    placeholder="How will you maintain your physical and mental health?"
                    value={healthWellness}
                    onChange={e => setHealthWellness(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support Needed</Label>
                  <Textarea
                    placeholder="What kind of support will you need? Mentoring, financial, emotional, professional?"
                    value={supportNeeded}
                    onChange={e => setSupportNeeded(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea
                    placeholder="Anything else you'd like to share about your post-graduation plan?"
                    value={additionalNotes}
                    onChange={e => setAdditionalNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext}>
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitPlan.isPending}>
              {submitPlan.isPending ? 'Submitting...' : 'Submit Plan'}
            </Button>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
