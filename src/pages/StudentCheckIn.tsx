import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useSubmitCheckIn } from '@/hooks/useStudentCheckIns';
import { useMarkSurveyComplete } from '@/hooks/useSurveyInvitations';
import { toast } from 'sonner';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const moodLabels = ['😔 Struggling', '😕 Not Great', '😐 Okay', '🙂 Good', '😊 Great'];
const progressLabels = ['Struggling', 'Behind', 'On Track', 'Progressing Well', 'Thriving'];

export default function StudentCheckIn() {
  const navigate = useNavigate();
  const submitCheckIn = useSubmitCheckIn();
  const markComplete = useMarkSurveyComplete();
  const [moodRating, setMoodRating] = useState(3);
  const [progressRating, setProgressRating] = useState(3);
  const [wins, setWins] = useState('');
  const [blockers, setBlockers] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    try {
      await submitCheckIn.mutateAsync({
        mood_rating: moodRating,
        progress_rating: progressRating,
        wins: wins.trim() || undefined,
        blockers: blockers.trim() || undefined,
        additional_notes: additionalNotes.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Check-in submitted! Thank you for sharing.');
      // Mark any pending survey invitation as complete
      markComplete.mutate('checkin');
    } catch {
      toast.error('Failed to submit check-in. Please try again.');
    }
  };

  if (submitted) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full text-center border border-border/50">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="font-display text-xl font-bold">Thank You!</h2>
              <p className="text-muted-foreground">
                Your check-in has been recorded. Your case manager will be able to review your progress.
              </p>
              <Button onClick={() => navigate('/dashboard')} className="mt-4">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <PageHeader
          title="3-Week Check-In"
          description="Let us know how you're doing — this only takes a minute."
        />

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">How are you feeling?</CardTitle>
            <CardDescription>Rate your overall mood and progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Mood Rating */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">
                Mood: <span className="text-primary font-semibold">{moodLabels[moodRating - 1]}</span>
              </Label>
              <Slider
                value={[moodRating]}
                onValueChange={([v]) => setMoodRating(v)}
                min={1}
                max={5}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>😔</span>
                <span>😕</span>
                <span>😐</span>
                <span>🙂</span>
                <span>😊</span>
              </div>
            </div>

            {/* Progress Rating */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">
                Progress: <span className="text-primary font-semibold">{progressLabels[progressRating - 1]}</span>
              </Label>
              <Slider
                value={[progressRating]}
                onValueChange={([v]) => setProgressRating(v)}
                min={1}
                max={5}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Struggling</span>
                <span>Behind</span>
                <span>On Track</span>
                <span>Good</span>
                <span>Thriving</span>
              </div>
            </div>

            {/* Wins */}
            <div className="space-y-2">
              <Label htmlFor="wins">What's going well? 🎉</Label>
              <Textarea
                id="wins"
                placeholder="Share any wins or positive moments..."
                value={wins}
                onChange={(e) => setWins(e.target.value)}
                rows={3}
              />
            </div>

            {/* Blockers */}
            <div className="space-y-2">
              <Label htmlFor="blockers">Any blockers or challenges? 🚧</Label>
              <Textarea
                id="blockers"
                placeholder="Anything holding you back or causing stress..."
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                rows={3}
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Anything else you'd like to share? (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any other thoughts..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitCheckIn.isPending}
              className="w-full"
              size="lg"
            >
              {submitCheckIn.isPending ? 'Submitting...' : 'Submit Check-In'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
