import { useMemo, useState } from 'react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SendLifeSkillsDialog } from '@/components/admin/SendLifeSkillsDialog';
import {
  useLifeSkillsTemplates,
  useLifeSkillsCompletionStats,
} from '@/hooks/useLifeSkillsSurveys';
import { LIFESKILLS_MODULES, preSlug, postSlug, LIFESKILLS_FINAL_SLUG } from '@/lib/lifeskillsTemplates';

export default function LifeSkillsSurveys() {
  const { data: templates = [], isLoading } = useLifeSkillsTemplates();
  const { data: stats = [] } = useLifeSkillsCompletionStats();
  const [sendOpen, setSendOpen] = useState<{ slug: string; title: string } | null>(null);

  const templateMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of templates) m.set(t.slug, t);
    return m;
  }, [templates]);
  const statMap = useMemo(() => {
    const m = new Map<string, { assigned: number; completed: number }>();
    for (const s of stats) m.set(s.slug, { assigned: s.assigned, completed: s.completed });
    return m;
  }, [stats]);

  const renderStat = (slug: string) => {
    const s = statMap.get(slug);
    if (!s || s.assigned === 0) return <span className="text-xs text-muted-foreground">Not yet sent</span>;
    return <Badge variant="secondary">{s.completed}/{s.assigned} submitted</Badge>;
  };

  const renderButtons = (preTitle: string, preSlugStr: string, postTitle: string, postSlugStr: string) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => setSendOpen({ slug: preSlugStr, title: preTitle })}>
        Send Pre-Survey
      </Button>
      <Button size="sm" onClick={() => setSendOpen({ slug: postSlugStr, title: postTitle })}>
        Send Post-Survey
      </Button>
    </div>
  );

  return (
    <SidebarLayout>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/surveys"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Surveys</Link>
        </Button>
      </div>
      <PageHeader
        title="Life Skills Surveys"
        description="Send pre and post-module Life Skills surveys to a class, cohort, or organization to measure impact."
      />




      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-4">
          {LIFESKILLS_MODULES.map((m) => {
            const pre = templateMap.get(preSlug(m.id));
            const post = templateMap.get(postSlug(m.id));
            return (
              <Card key={m.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">Module {String(m.number).padStart(2, '0')}: {m.title}</CardTitle>
                      <CardDescription>{m.topicPhrase}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Pre-Module</span>
                      {renderStat(preSlug(m.id))}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Post-Module</span>
                      {renderStat(postSlug(m.id))}
                    </div>
                  </div>
                  {pre && post && renderButtons(pre.title, pre.slug, post.title, post.slug)}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Final Course Wrap-Up</CardTitle>
              <CardDescription>Send after all 7 modules are complete.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Wrap-Up</span>
                {renderStat(LIFESKILLS_FINAL_SLUG)}
              </div>
              {templateMap.get(LIFESKILLS_FINAL_SLUG) && (
                <Button onClick={() => setSendOpen({ slug: LIFESKILLS_FINAL_SLUG, title: templateMap.get(LIFESKILLS_FINAL_SLUG).title })}>
                  Send Final Survey
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {sendOpen && (
        <SendLifeSkillsDialog
          open
          onOpenChange={(o) => !o && setSendOpen(null)}
          templateSlug={sendOpen.slug}
          templateTitle={sendOpen.title}
        />
      )}
    </SidebarLayout>
  );
}
