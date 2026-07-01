import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import {
  useLifeSkillsTemplate,
  useSubmitLifeSkillsResponse,
  useMyLifeSkillsResponses,
} from '@/hooks/useLifeSkillsSurveys';
import { moduleFromSlug } from '@/lib/lifeskillsTemplates';
import { cn } from '@/lib/utils';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { DraftIndicator } from '@/components/forms/DraftIndicator';

type AnswerMap = Record<string, string | number>;

export default function LifeSkillsSurvey() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: template, isLoading } = useLifeSkillsTemplate(slug);
  const { data: myResponses = [] } = useMyLifeSkillsResponses();
  const submit = useSubmitLifeSkillsResponse();
  const [answers, setAnswers] = useState<AnswerMap>({});

  const persistKey = slug ? `lifeskills:${slug}` : 'lifeskills:unknown';
  const { clear: clearDraft, savedAt, hasDraft } = useFormPersistence<AnswerMap>(
    persistKey,
    answers,
    (v) => setAnswers(v ?? {}),
    {
      enabled: !!slug,
      label: template?.title,
      shouldPersist: (v) => v && Object.keys(v).length > 0,
    },
  );


  const meta = useMemo(() => (slug ? moduleFromSlug(slug) : { kind: 'unknown' as const }), [slug]);

  const alreadyCompleted = useMemo(
    () => myResponses.some((r: any) => r.impact_survey_templates?.slug === slug),
    [myResponses, slug],
  );

  // Hard-block post-module if matching pre-module not completed
  const blockedReason = useMemo(() => {
    if (meta.kind !== 'post' || !meta.module) return null;
    const preSlug = `lifeskills-${meta.module.id}-pre`;
    const preDone = myResponses.some((r: any) => r.impact_survey_templates?.slug === preSlug);
    if (!preDone) return `Please complete the pre-module survey for ${meta.module.title} first.`;
    return null;
  }, [meta, myResponses]);

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </SidebarLayout>
    );
  }

  if (!template) {
    return (
      <SidebarLayout>
        <PageHeader title="Survey not found" />
        <Button variant="outline" onClick={() => navigate('/surveys')}>Back to surveys</Button>
      </SidebarLayout>
    );
  }

  const questions: any[] = Array.isArray(template.questions) ? template.questions : [];

  const onChange = (id: string, value: string | number) => setAnswers((p) => ({ ...p, [id]: value }));

  const validate = (): string | null => {
    for (const q of questions) {
      const v = answers[q.id];
      if (q.type === 'open') {
        if (!v || String(v).trim().length === 0) return `Please answer: "${q.label}"`;
        const max = q.maxLength ?? 800;
        if (String(v).length > max) return `Answer too long for: "${q.label}"`;
      } else if (q.type === 'scale_1_5') {
        if (typeof v !== 'number' || v < 1 || v > 5) return `Please select 1–5 for: "${q.label}"`;
      } else if (q.type === 'choice_5') {
        if (!v) return `Please pick an option for: "${q.label}"`;
      } else if (q.type === 'nps') {
        if (typeof v !== 'number' || v < 0 || v > 10) return `Please pick 0–10 for: "${q.label}"`;
      }
    }
    return null;
  };

  const buildScoreSummary = (): Record<string, any> => {
    const summary: Record<string, any> = {};
    if (meta.kind === 'pre') {
      summary.confidence = answers.confidence ?? null;
      summary.current_habit = answers.current_habit ?? null;
    } else if (meta.kind === 'post') {
      summary.confidence = answers.confidence ?? null;
      summary.resource_likelihood = answers.resource_likelihood ?? null;
    } else if (meta.kind === 'final') {
      summary.self_efficacy = {
        m01: answers.eff_m01, m02: answers.eff_m02, m03: answers.eff_m03,
        m04: answers.eff_m04, m05: answers.eff_m05, m06: answers.eff_m06,
        m07: answers.eff_m07,
      };
      summary.future_outlook = answers.future_outlook;
      summary.nps = answers.nps;
    }
    return summary;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) { toast({ title: 'Missing answer', description: err, variant: 'destructive' }); return; }
    try {
      await submit.mutateAsync({
        template_id: template.id,
        template_slug: template.slug,
        responses: answers,
        score_summary: buildScoreSummary(),
      });
      clearDraft();
      toast({ title: 'Thank you!', description: 'Your response has been recorded.' });
      navigate('/surveys');

    } catch (e: any) {
      toast({ title: 'Could not submit', description: e?.message || 'Try again', variant: 'destructive' });
    }
  };

  return (
    <SidebarLayout>
      <PageHeader title={template.title} description={template.description ?? undefined} />

      {alreadyCompleted && (
        <Card className="border-accent/40 bg-accent/10 mb-4">
          <CardContent className="p-4 text-sm">
            You've already submitted this survey. Thanks!
          </CardContent>
        </Card>
      )}

      {blockedReason && (
        <Card className="border-destructive/50 bg-destructive/10 mb-4">
          <CardContent className="p-4 text-sm">{blockedReason}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your responses</CardTitle>
          <CardDescription>All questions required. Your answers are visible only to your support team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm font-medium">{q.label}</Label>

              {q.type === 'scale_1_5' && (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChange(q.id, n)}
                      className={cn(
                        'h-10 w-10 rounded-full border text-sm font-semibold transition-colors',
                        answers[q.id] === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted',
                      )}
                    >{n}</button>
                  ))}
                  <span className="text-xs text-muted-foreground self-center ml-2">1 = Not at all · 5 = Very much</span>
                </div>
              )}

              {q.type === 'open' && (
                <Textarea
                  value={(answers[q.id] as string) || ''}
                  onChange={(e) => onChange(q.id, e.target.value)}
                  maxLength={q.maxLength ?? 800}
                  placeholder="Type your answer..."
                  rows={3}
                />
              )}

              {q.type === 'choice_5' && (
                <div className="flex flex-col gap-2">
                  {(q.options as string[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChange(q.id, opt)}
                      className={cn(
                        'text-left rounded-md border px-3 py-2 text-sm transition-colors',
                        answers[q.id] === opt ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                      )}
                    >{opt}</button>
                  ))}
                </div>
              )}

              {q.type === 'nps' && (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChange(q.id, n)}
                      className={cn(
                        'h-10 w-10 rounded-md border text-sm font-semibold transition-colors',
                        answers[q.id] === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted',
                      )}
                    >{n}</button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button onClick={onSubmit} disabled={submit.isPending || !!blockedReason}>
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/surveys')}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </SidebarLayout>
  );
}
