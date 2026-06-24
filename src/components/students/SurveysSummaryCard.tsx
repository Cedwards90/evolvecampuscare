import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Heart, GraduationCap, ClipboardList, Sparkles, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useStudentCheckIns } from '@/hooks/useStudentCheckIns';
import { useStudentPlans } from '@/hooks/usePostGraduationPlan';
import { useStudentImpactResponses } from '@/hooks/useMyImpactResponses';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  studentId: string;
}

function useIntakeCount(studentId: string) {
  return useQuery({
    queryKey: ['intake-responses-summary', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intake_responses')
        .select('id, created_at, updated_at')
        .eq('student_id', studentId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });
}

export function SurveysSummaryCard({ studentId }: Props) {
  const { role } = useAuth();
  const { data: checkIns = [], isLoading: l1 } = useStudentCheckIns(studentId);
  const { data: plans = [], isLoading: l2 } = useStudentPlans(studentId);
  const { data: intake = [], isLoading: l3 } = useIntakeCount(studentId);
  const { data: impact = [], isLoading: l4 } = useStudentImpactResponses(studentId);

  const loading = l1 || l2 || l3 || l4;

  const basePath = role === 'admin'
    ? `/admin/students/${studentId}/submissions`
    : `/students/${studentId}/submissions`;

  const latest = (d?: string | null) => (d ? format(new Date(d), 'PPP') : null);
  const lastCheckIn = latest(checkIns[0]?.created_at);
  const lastPlan = latest(plans[0]?.updated_at || plans[0]?.created_at);
  const lastIntake = latest(intake[0]?.updated_at || intake[0]?.created_at);
  const lastImpact = latest(impact[0]?.submitted_at);

  const rows = [
    {
      key: 'checkins',
      icon: Heart,
      label: 'Wellbeing check-ins',
      count: checkIns.length,
      last: lastCheckIn,
      empty: 'None yet',
    },
    {
      key: 'plan',
      icon: GraduationCap,
      label: 'Post-graduation plan',
      count: plans.length,
      last: lastPlan,
      empty: 'Not submitted',
    },
    {
      key: 'intake',
      icon: ClipboardList,
      label: 'Intake survey',
      count: intake.length,
      last: lastIntake,
      empty: 'Not started',
    },
    {
      key: 'impact',
      icon: Sparkles,
      label: 'Life Skills / Impact surveys',
      count: impact.length,
      last: lastImpact,
      empty: 'None yet',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Surveys & Submissions</CardTitle>
            <CardDescription>Everything this student has shared, in one place.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to={basePath}>
              View all <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-full bg-muted p-2 shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.count > 0 && r.last ? `Last: ${r.last}` : r.empty}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={r.count > 0 ? 'secondary' : 'outline'}>{r.count}</Badge>
                    <Button asChild size="sm" variant="ghost" className="rounded-full h-8">
                      <Link to={`${basePath}?tab=${r.key}`}>View</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
