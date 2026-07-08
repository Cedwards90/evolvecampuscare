import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, ListChecks, ChevronRight, GraduationCap, ClipboardList, Sparkles, Briefcase, Send, Users, BarChart3, FileBarChart } from 'lucide-react';
import { SurveyPreviewDialog, type PreviewSurveyType } from '@/components/admin/SurveyPreviewDialog';
import { SurveyCompletionsDialog } from '@/components/admin/SurveyCompletionsDialog';
import { SendSurveyDialog } from '@/components/admin/SendSurveyDialog';
import { SendLifeSkillsDialog } from '@/components/admin/SendLifeSkillsDialog';
import type { CompletionSource } from '@/hooks/useSurveyCompletions';
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
  /** Invitation-style survey type ('checkin' | 'post_graduation_plan' | 'intake' | 'career_intake'). */
  invitationType?: string;
  /** Life Skills template slug for bulk send dialog. */
  lifeskillsSlug?: string;
  /** Label for the primary Life Skills send button (defaults to 'Send'). */
  lifeskillsLabel?: string;
  /** Optional second Life Skills template slug (post-module send). */
  lifeskillsSlugSecondary?: string;
  lifeskillsLabelSecondary?: string;
  /** Overrides the impact-report URL derived from `preview`. */
  impactSource?: string;
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

function SurveyCard({
  row,
  onPreview,
  onCompletions,
  onSendInvitation,
  onSendLifeSkills,
}: {
  row: SurveyRow;
  onPreview: (t: PreviewSurveyType) => void;
  onCompletions: (source: CompletionSource, title: string) => void;
  onSendInvitation: (invitationType: string, title: string) => void;
  onSendLifeSkills: (slug: string, title: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        {row.description && (
          <p className="text-xs text-muted-foreground">{row.description}</p>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-medium text-sm">{row.title}</p>
              {row.badge && <Badge variant="secondary" className="text-xs">{row.badge}</Badge>}
              {row.count && (
                <>
                  <span className="text-muted-foreground/60" aria-hidden>·</span>
                  <p className="text-xs text-muted-foreground">{row.count}</p>
                </>
              )}
            </div>
          </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => onPreview(row.preview)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCompletions(row.preview as CompletionSource, row.title)}>
            <Users className="mr-1.5 h-3.5 w-3.5" /> Completions
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/admin/surveys/reports?survey=${encodeURIComponent(row.impactSource || (row.preview as string))}`}>
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Impact report
            </Link>
          </Button>
          {row.invitationType && (
            <Button size="sm" variant="outline" onClick={() => onSendInvitation(row.invitationType!, row.title)}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Send to student
            </Button>
          )}
          {row.lifeskillsSlug && (
            <Button size="sm" variant="outline" onClick={() => onSendLifeSkills(row.lifeskillsSlug!, row.title)}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> {row.lifeskillsLabel || 'Send'}
            </Button>
          )}
          {row.lifeskillsSlugSecondary && (
            <Button size="sm" variant="outline" onClick={() => onSendLifeSkills(row.lifeskillsSlugSecondary!, row.title)}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> {row.lifeskillsLabelSecondary || 'Send'}
            </Button>
          )}
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
  const [completions, setCompletions] = useState<{ source: CompletionSource; title: string } | null>(null);
  const [invitationSend, setInvitationSend] = useState<{ type: string; title: string } | null>(null);
  const [lifeSkillsSend, setLifeSkillsSend] = useState<{ slug: string; title: string } | null>(null);

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
      invitationType: 'checkin',
    },
    {
      title: '12-Month Post-Graduation Plan',
      description: '4-step wizard covering career, housing, milestones, and support.',
      preview: 'post_grad',
      reviewHref: '/admin/surveys/responses?type=plans',
      count: `${plans.length} submissions`,
      invitationType: 'post_graduation_plan',
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
      invitationType: 'intake',
    },
    {
      title: 'Career Intake Survey',
      description: 'Career discovery — interests, strengths, dream career, availability.',
      preview: 'career_intake',
      reviewHref: '/admin/student-management',
      reviewLabel: 'Open student folders',
      count: typeof careerCount === 'number' ? `${careerCount} completed` : undefined,
      invitationType: 'career_intake',
    },
  ];

  const lifeskills: SurveyRow[] = [];
  for (const m of LIFESKILLS_MODULES) {
    const pre = buildPreTemplate(m);
    const post = buildPostTemplate(m);
    const preStat = statText(pre.slug);
    const postStat = statText(post.slug);
    lifeskills.push({
      title: `Module ${String(m.number).padStart(2, '0')}: ${m.title}`,
      description: `${m.topicPhrase} · Pre + Post surveys combined into one before/after report.`,
      preview: `impact:${pre.slug}` as PreviewSurveyType,
      impactSource: `impact:lifeskills-module:${m.id}`,
      reviewHref: '/admin/lifeskills',
      reviewLabel: 'Manage & send',
      count: `Pre: ${preStat} · Post: ${postStat}`,
      lifeskillsSlug: pre.slug,
      lifeskillsLabel: 'Send Pre-Survey',
      lifeskillsSlugSecondary: post.slug,
      lifeskillsLabelSecondary: 'Send Post-Survey',
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
    lifeskillsSlug: LIFESKILLS_FINAL_SLUG,
  });

  return (
    <SidebarLayout>
      <PageHeader title="Surveys" description="Every survey running on the platform. Preview the questions students see, or review the answers they've submitted." />

      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/surveys/reports"><FileBarChart className="mr-1.5 h-3.5 w-3.5" /> Open impact reports</Link>
        </Button>
      </div>

      <div className="space-y-8">
        <Section
          icon={ClipboardList}
          title="Core student surveys"
          description="Recurring check-ins and the long-term plan every student fills out."
        >
          {core.map((r) => (
            <SurveyCard
              key={r.title}
              row={r}
              onPreview={setPreview}
              onCompletions={(s, t) => setCompletions({ source: s, title: t })}
              onSendInvitation={(type, title) => setInvitationSend({ type, title })}
              onSendLifeSkills={(slug, title) => setLifeSkillsSend({ slug, title })}
            />
          ))}
        </Section>

        <Section
          icon={Sparkles}
          title="Onboarding intake"
          description="Surveys students complete when they join the platform."
        >
          {intake.map((r) => (
            <SurveyCard
              key={r.title}
              row={r}
              onPreview={setPreview}
              onCompletions={(s, t) => setCompletions({ source: s, title: t })}
              onSendInvitation={(type, title) => setInvitationSend({ type, title })}
              onSendLifeSkills={(slug, title) => setLifeSkillsSend({ slug, title })}
            />
          ))}
        </Section>

        <Section
          icon={GraduationCap}
          title="Life Skills curriculum"
          description="Pre/post-module surveys and a final wrap-up — sent through the Life Skills manager."
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/surveys/reports?survey=impact:lifeskills-all">
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Pre vs Post impact report
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/lifeskills">Open Life Skills manager <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>

          {lifeskills.map((r) => (
            <SurveyCard
              key={r.title}
              row={r}
              onPreview={setPreview}
              onCompletions={(s, t) => setCompletions({ source: s, title: t })}
              onSendInvitation={(type, title) => setInvitationSend({ type, title })}
              onSendLifeSkills={(slug, title) => setLifeSkillsSend({ slug, title })}
            />
          ))}
        </Section>
      </div>

      <SurveyPreviewDialog
        open={preview !== null}
        onOpenChange={(o) => !o && setPreview(null)}
        surveyType={preview || 'checkin'}
      />

      <SurveyCompletionsDialog
        open={completions !== null}
        onOpenChange={(o) => !o && setCompletions(null)}
        source={completions?.source ?? null}
        title={completions?.title ?? ''}
      />

      {invitationSend && (
        <SendSurveyDialog
          key={`inv-${invitationSend.type}`}
          open={!!invitationSend}
          onOpenChange={(o) => !o && setInvitationSend(null)}
          defaultSurveyType={invitationSend.type}
        />
      )}

      {lifeSkillsSend && (
        <SendLifeSkillsDialog
          key={`ls-${lifeSkillsSend.slug}`}
          open={!!lifeSkillsSend}
          onOpenChange={(o) => !o && setLifeSkillsSend(null)}
          templateSlug={lifeSkillsSend.slug}
          templateTitle={lifeSkillsSend.title}
        />
      )}
    </SidebarLayout>
  );
}
