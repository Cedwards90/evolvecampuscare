import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMyLifeSkillsAssignments, useMyLifeSkillsResponses } from '@/hooks/useLifeSkillsSurveys';

export default function Surveys() {
  const { data: assignments = [], isLoading } = useMyLifeSkillsAssignments();
  const { data: responses = [] } = useMyLifeSkillsResponses();

  const completedSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const r of responses) s.add((r as any).impact_survey_templates?.slug);
    return s;
  }, [responses]);

  const pending = assignments.filter((a: any) => !a.last_completed_at);
  const completed = assignments.filter((a: any) => a.last_completed_at);

  return (
    <SidebarLayout>
      <PageHeader
        title="My Surveys"
        description="Pre/post-module and wrap-up surveys for the Life Skills curriculum."
      />

      <section className="space-y-3">
        <h3 className="text-sm font-medium uppercase text-muted-foreground tracking-wide">Pending</h3>
        {isLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : pending.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No pending surveys. You're all caught up!</CardContent></Card>
        ) : pending.map((a: any) => {
          const t = a.impact_survey_templates;
          const done = completedSlugs.has(t.slug);
          return (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-sm">{t.title}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {done && <Badge variant="secondary">Submitted</Badge>}
                  <Button size="sm" asChild>
                    <Link to={`/surveys/${t.slug}`}>{done ? 'View' : 'Start'}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {completed.length > 0 && (
        <section className="space-y-3 mt-8">
          <h3 className="text-sm font-medium uppercase text-muted-foreground tracking-wide">Completed</h3>
          {completed.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm">{a.impact_survey_templates.title}</p>
                  <p className="text-xs text-muted-foreground">Submitted {new Date(a.last_completed_at).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline">Done</Badge>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </SidebarLayout>
  );
}
