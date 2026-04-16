import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GraduationCap, Home, Target, Heart, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
            <Label className="text-sm font-medium">
              Mood: <span className="text-primary font-semibold">{moodLabels[2]}</span>
            </Label>
            <Slider value={[3]} min={1} max={5} step={1} disabled />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>😔</span><span>😕</span><span>😐</span><span>🙂</span><span>😊</span>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium">
              Progress: <span className="text-primary font-semibold">{progressLabels[2]}</span>
            </Label>
            <Slider value={[3]} min={1} max={5} step={1} disabled />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Struggling</span><span>Behind</span><span>On Track</span><span>Good</span><span>Thriving</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>What's going well? 🎉</Label>
            <Textarea placeholder="Share any wins or positive moments..." disabled rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Any blockers or challenges? 🚧</Label>
            <Textarea placeholder="Anything holding you back or causing stress..." disabled rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Anything else you'd like to share? (optional)</Label>
            <Textarea placeholder="Any other thoughts..." disabled rows={2} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
        <p className="text-xs text-muted-foreground text-right mt-1">Step 1 of 4</p>
      </div>

      {POST_GRAD_STEPS.map((step, idx) => (
        <Card key={step.key}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Step {idx + 1}: {step.title}</CardTitle>
                <CardDescription className="text-xs">{step.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {idx === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Expected Graduation Date</Label>
                  <Input type="date" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Career Goals</Label>
                  <Textarea placeholder="What type of job or career path are you aiming for? What steps will you take?" disabled rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Education Goals</Label>
                  <Textarea placeholder="Are you planning further education, certifications, or training?" disabled rows={3} />
                </div>
              </>
            )}
            {idx === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Housing Plan</Label>
                  <Textarea placeholder="Where do you plan to live? What steps do you need to take to secure housing?" disabled rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Financial Plan</Label>
                  <Textarea placeholder="How will you manage your finances? Savings goals, budgeting, income sources?" disabled rows={3} />
                </div>
              </>
            )}
            {idx === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Months 1–3: Actions & Milestones</Label>
                  <Textarea placeholder="What will you focus on in the first 3 months after graduation?" disabled rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Months 4–6: Actions & Milestones</Label>
                  <Textarea placeholder="What do you want to achieve by the 6-month mark?" disabled rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Months 7–9: Actions & Milestones</Label>
                  <Textarea placeholder="What progress do you expect by 9 months?" disabled rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Months 10–12: Actions & Milestones</Label>
                  <Textarea placeholder="Where do you want to be at the 1-year mark?" disabled rows={2} />
                </div>
              </>
            )}
            {idx === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Health & Wellness</Label>
                  <Textarea placeholder="How will you maintain your physical and mental health?" disabled rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Support Needed</Label>
                  <Textarea placeholder="What kind of support will you need? Mentoring, financial, emotional, professional?" disabled rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea placeholder="Anything else you'd like to share about your post-graduation plan?" disabled rows={2} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface SurveyPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyType: 'checkin' | 'post_grad';
}

export function SurveyPreviewDialog({ open, onOpenChange, surveyType }: SurveyPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <DialogTitle>
              {surveyType === 'checkin' ? '3-Week Check-In' : '12-Month Post-Graduation Plan'}
            </DialogTitle>
          </div>
          <DialogDescription>
            <Badge variant="outline" className="mt-1">Preview — this is what students see</Badge>
          </DialogDescription>
        </DialogHeader>
        {surveyType === 'checkin' ? <CheckInPreview /> : <PostGradPlanPreview />}
      </DialogContent>
    </Dialog>
  );
}
