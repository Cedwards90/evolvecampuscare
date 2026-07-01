import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { useStudentPersonality } from '@/hooks/useStudentPersonality';
import { useToast } from '@/hooks/use-toast';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { DraftIndicator } from '@/components/forms/DraftIndicator';
import {
  QUIZ_QUESTIONS,
  LIKERT_OPTIONS,
  scoreQuiz,
  type LikertValue,
  type QuizScore,
} from '@/lib/personalityQuiz';

export default function PersonalityQuizOnboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { upsert } = useStudentPersonality(user?.id);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LikertValue>>({});
  const [result, setResult] = useState<QuizScore | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = QUIZ_QUESTIONS.length;
  const current = QUIZ_QUESTIONS[index];
  const progress = useMemo(() => Math.round(((index) / total) * 100), [index, total]);
  const draftValues = useMemo(() => ({ index, answers }), [index, answers]);
  const { clear: clearDraft, savedAt, hasDraft } = useFormPersistence(
    'personality-quiz-onboarding',
    draftValues,
    (v) => {
      setIndex(typeof v.index === 'number' && v.index >= 0 && v.index < total ? v.index : 0);
      setAnswers((v.answers ?? {}) as Record<string, LikertValue>);
    },
    {
      enabled: !result,
      label: 'the Personality Quiz',
      shouldPersist: (v) => Object.keys(v.answers ?? {}).length > 0,
    },
  );

  const answer = async (v: LikertValue) => {
    const next = { ...answers, [current.id]: v };
    setAnswers(next);
    if (index + 1 < total) {
      setIndex(index + 1);
    } else {
      const score = scoreQuiz(next);
      setSubmitting(true);
      try {
        await upsert.mutateAsync({
          type_code: score.type_code,
          type_name: score.type_name,
          energy_pct: score.energy_pct,
          energy_label: score.energy_label,
          mind_pct: score.mind_pct,
          mind_label: score.mind_label,
          nature_pct: score.nature_pct,
          nature_label: score.nature_label,
          tactics_pct: score.tactics_pct,
          tactics_label: score.tactics_label,
          identity_pct: score.identity_pct,
          identity_label: score.identity_label,
          strengths: score.strengths,
          weaknesses: score.weaknesses,
          summary: score.summary,
          assessment_source: 'self_quiz',
          assessed_on: new Date().toISOString().slice(0, 10),
        });
        await supabase
          .from('profiles')
          .update({ onboarding_completed_at: new Date().toISOString() } as any)
          .eq('user_id', user!.id);
        await refreshProfile();
        await qc.invalidateQueries({ queryKey: ['onboarding-status'] });
        clearDraft();
        setResult(score);
      } catch (e: any) {
        toast({ title: 'Could not save quiz', description: e.message, variant: 'destructive' });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const back = () => {
    if (index > 0) setIndex(index - 1);
  };

  if (result) {
    return (
      <OnboardingShell step={5} title={`You are ${result.type_code} — ${result.type_name}`} description={result.summary}>
        <div className="space-y-3">
          {[
            { label: 'Energy', pct: result.energy_pct, right: result.energy_label, leftLabel: 'Introverted', rightLabel: 'Extraverted' },
            { label: 'Mind', pct: result.mind_pct, right: result.mind_label, leftLabel: 'Intuitive', rightLabel: 'Observant' },
            { label: 'Nature', pct: result.nature_pct, right: result.nature_label, leftLabel: 'Thinking', rightLabel: 'Feeling' },
            { label: 'Tactics', pct: result.tactics_pct, right: result.tactics_label, leftLabel: 'Judging', rightLabel: 'Prospecting' },
            { label: 'Identity', pct: result.identity_pct, right: result.identity_label, leftLabel: 'Assertive', rightLabel: 'Turbulent' },
          ].map((t) => (
            <div key={t.label}>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t.leftLabel}</span>
                <span className="font-medium text-foreground">{t.right} ({t.pct}%)</span>
                <span>{t.rightLabel}</span>
              </div>
              <Progress value={t.pct} className="h-2" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="font-medium mb-2">Strengths</h3>
            <div className="flex flex-wrap gap-2">
              {result.strengths.map((s) => (
                <Badge key={s} variant="secondary" className="rounded-full">{s}</Badge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Growth areas</h3>
            <div className="flex flex-wrap gap-2">
              {result.weaknesses.map((w) => (
                <Badge key={w} variant="outline" className="rounded-full">{w}</Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => navigate('/dashboard')} className="rounded-full">Continue to dashboard</Button>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={5}
      title="Personality Quiz"
      description="32 quick questions. Pick the answer that fits you best — go with your gut."
    >
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Question {index + 1} of {total}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <p className="text-lg font-medium leading-snug">{current.text}</p>

      <div className="grid gap-2">
        {LIKERT_OPTIONS.map((o) => (
          <Button
            key={o.value}
            variant={answers[current.id] === o.value ? 'default' : 'outline'}
            className="justify-start rounded-full"
            disabled={submitting}
            onClick={() => answer(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={back} disabled={index === 0 || submitting}>Back</Button>
        {submitting && <span className="text-sm text-muted-foreground">Saving your results…</span>}
      </div>
      <DraftIndicator savedAt={savedAt} hasDraft={hasDraft} onDiscard={() => { clearDraft(); setIndex(0); setAnswers({}); }} />
    </OnboardingShell>
  );
}
