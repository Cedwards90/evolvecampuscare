import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, ListChecks, ChevronRight, GraduationCap, ClipboardList, Sparkles, Briefcase, Send } from 'lucide-react';
import { SurveyPreviewDialog, type PreviewSurveyType } from '@/components/admin/SurveyPreviewDialog';
import { useAllCheckIns, useAllPostGradPlans } from '@/hooks/useSurveyResponses';
import { useLifeSkillsCompletionStats } from '@/hooks/useLifeSkillsSurveys';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  LIFESKILLS_MODULES,
  preSlug,
  postSlug,
  LIFESKILLS_FINAL_SLUG,
  FINAL_TEMPLATE,
  buildPreTemplate,
  buildPostTemplate,
} from '@/lib/lifeskillsTemplates';

interface SurveyRow {
  title: string;
  description: string;
  preview: PreviewSurveyType;
  reviewHref?: string;
  reviewLabel?: string;
  count?: string;
  badge?: string;
  sendHref?: string;
}

function useIntakeCount() {
  return useQuery({
    queryKey: ['intake-responses-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('intake_responses')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
  });
}

function useCareerIntakeCount() {
  return useQuery({
    queryKey: ['career-intake-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('career_intake_responses')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
  });
}

function SurveyCard({ row, onPreview }: { row: SurveyRow; onPreview: (t: PreviewSurveyType) => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{row.title}</p>
            {row.badge && <Badge variant="secondary" className="text-xs">{row.badge}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
          {row.count && <p className="text-xs text-muted-foreground mt-1">{row.count}</p>}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => onPreview(row.preview)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
          </Button>
          {row.sendHref && (
            <Button size="sm" variant="outline" asChild>
              <Link to={row.sendHref}><Send className="mr-1.5 h-3.5 w-3.5" /> Send</Link>
            </Button>
          )}
          {row.reviewHref && (
            <Button size="sm" asChild>
              <Link to={row.reviewHref}>
                <ListChecks className="mr-1.5 h-3.5 w-3.5" /> {row.reviewLabel || 'Review answers'}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ icon: Icon, title, description, children }: { icon: any; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
        <div>
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function SurveysIndex() {
  const [preview, setPreview] = useState<PreviewSurveyType | null>(null);

  const { data: checkIns = [] } = useAllCheckIns();
  const { data: plans = [] } = useAllPostGradPlans();
  const { data: lsStats = [] } = useLifeSkillsCompletionStats();
  const { data: intakeCount } = useIntakeCount();
  const { data: careerCount } = useCareerIntakeCount();

  const statMap = useMemo(() => {
    const m = new Map<string, { assigned: number; completed: number }>();
    for (const s of lsStats) m.set(s.slug, { assigned: s.assigned, completed: s.completed });
    return m;
  }, [lsStats]);

  const statText = (slug: string) => {
    const s = statMap.get(slug);
    if (!s || s.assigned === 0) return 'Not yet sent';
    return `${s.completed}/${s.assigned} submitted`;
  };

  const core: SurveyRow[] = [
    {
      title: 'Weekly Check-In',
      description: 'Recurring mood, progress, wins, and blockers.',
      preview: 'checkin',
      reviewHref: '/admin/surveys/responses?type=checkins',
      count: `${checkIns.length} submissions`,
    },
    {
      title: '12-Month Post-Graduation Plan',
      description: '4-step wizard covering career, housing, milestones, and support.',
      preview: 'post_grad',
      reviewHref: '/admin/surveys/responses?type=plans',
      count: `${plans.length} submissions`,
    },
  ];

  const intake: SurveyRow[] = [
    {
      title: 'Student Intake Survey',
      description: 'Onboarding intake covering living situation, wellbeing, work, and goals.',
      preview: 'intake',
      reviewHref: '/admin/student-management',
      reviewLabel: 'Open student folders',
      count: typeof intakeCount === 'number' ? `${intakeCount} section responses` : undefined,
    },
    {
      title: 'Career Intake Survey',
      description: 'Career discovery — interests, strengths, dream career, availability.',
      preview: 'career_intake',
      reviewHref: '/admin/student-management',
      reviewLabel: 'Open student folders',
      count: typeof careerCount === 'number' ? `${careerCount} completed` : undefined,
    },
  ];

  const lifeskills: SurveyRow[] = [];
  for (const m of LIFESKILLS_MODULES) {
    const pre = buildPreTemplate(m);
    const post = buildPostTemplate(m);
    const preLabel = `Module ${String(m.number).padStart(2, '0')}: ${m.title} — Pre`;
    const postLabel = `Module ${String(m.number).padStart(2, '0')}: ${m.title} — Post`;
    lifeskills.push({
      title: preLabel,
      description: pre.description,
      preview: `impact:${pre.slug}` as PreviewSurveyType,
      reviewHref: '/admin/lifeskills',
      reviewLabel: 'Manage & send',
      count: statText(pre.slug),
    });
    lifeskills.push({
      title: postLabel,
      description: post.description,
      preview: `impact:${post.slug}` as PreviewSurveyType,
      reviewHref: '/admin/lifeskills',
      reviewLabel: 'Manage & send',
      count: statText(post.slug),
    });
  }
  lifeskills.push({
    title: FINAL_TEMPLATE.title,
    description: FINAL_TEMPLATE.description,
    preview: `impact:${LIFESKILLS_FINAL_SLUG}` as PreviewSurveyType,
    reviewHref: '/admin/lifeskills',
    reviewLabel: 'Manage & send',
    count: statText(LIFESKILLS_FINAL_SLUG),
    badge: 'Final',
  });

  return (
    <SidebarLayout>
      <PageHeader title="Surveys" description="Every survey running on the platform. Preview the questions students see, or review the answers they've submitted." />

      <div className="space-y-8">
        <Section
          icon={ClipboardList}
          title="Core student surveys"
          description="Recurring check-ins and the long-term plan every student fills out."
        >
          {core.map((r) => <SurveyCard key={r.title} row={r} onPreview={setPreview} />)}
        </Section>

        <Section
          icon={Sparkles}
          title="Onboarding intake"
          description="Surveys students complete when they join the platform."
        >
          {intake.map((r) => <SurveyCard key={r.title} row={r} onPreview={setPreview} />)}
        </Section>

        <Section
          icon={GraduationCap}
          title="Life Skills curriculum"
          description="Pre/post-module surveys and a final wrap-up — sent through the Life Skills manager."
        >
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/lifeskills">Open Life Skills manager <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          {lifeskills.map((r) => <SurveyCard key={r.title} row={r} onPreview={setPreview} />)}
        </Section>
      </div>

      <SurveyPreviewDialog
        open={preview !== null}
        onOpenChange={(o) => !o && setPreview(null)}
        surveyType={preview || 'checkin'}
      />
    </SidebarLayout>
  );
}
