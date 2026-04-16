import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAllCheckIns, useAllPostGradPlans } from '@/hooks/useSurveyResponses';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Search, ChevronDown, ChevronRight, ExternalLink, Smile, TrendingUp, Eye } from 'lucide-react';
import { SurveyPreviewDialog } from '@/components/admin/SurveyPreviewDialog';

function MoodBadge({ rating }: { rating: number }) {
  const colors = rating >= 4 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : rating >= 3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  return <Badge className={colors}>{rating}/5</Badge>;
}

export default function SurveyResponses() {
  const [search, setSearch] = useState('');
  const { data: checkIns, isLoading: loadingCheckIns } = useAllCheckIns();
  const { data: plans, isLoading: loadingPlans } = useAllPostGradPlans();

  const filteredCheckIns = checkIns?.filter(c =>
    (c.student_name || c.student_email).toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredPlans = plans?.filter(p =>
    (p.student_name || p.student_email).toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <SidebarLayout>
      <PageHeader title="Survey Responses" description="View all student check-ins and post-graduation plans" />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by student name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="checkins">
        <TabsList>
          <TabsTrigger value="checkins">Check-Ins ({filteredCheckIns.length})</TabsTrigger>
          <TabsTrigger value="plans">Post-Graduation Plans ({filteredPlans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="checkins">
          {loadingCheckIns ? <LoadingSpinner /> : filteredCheckIns.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No check-ins found.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Mood</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCheckIns.map(c => (
                    <CheckInRow key={c.id} checkIn={c} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plans">
          {loadingPlans ? <LoadingSpinner /> : filteredPlans.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No plans found.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredPlans.map(p => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}

function CheckInRow({ checkIn }: { checkIn: ReturnType<typeof useAllCheckIns>['data'] extends (infer T)[] | undefined ? T : never }) {
  const [open, setOpen] = useState(false);
  const hasDetails = checkIn.wins || checkIn.blockers || checkIn.additional_notes;

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => hasDetails && setOpen(!open)}>
        <TableCell>
          <Link to={`/students/${checkIn.student_id}`} className="font-medium text-primary hover:underline" onClick={e => e.stopPropagation()}>
            {checkIn.student_name || checkIn.student_email}
          </Link>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {new Date(checkIn.created_at).toLocaleDateString()}
        </TableCell>
        <TableCell><MoodBadge rating={checkIn.mood_rating} /></TableCell>
        <TableCell><MoodBadge rating={checkIn.progress_rating} /></TableCell>
        <TableCell>
          {hasDetails && (open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
        </TableCell>
      </TableRow>
      {open && hasDetails && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 px-6 py-4">
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              {checkIn.wins && (
                <div>
                  <span className="font-medium text-green-700 dark:text-green-400">Wins:</span>
                  <p className="mt-1 text-muted-foreground">{checkIn.wins}</p>
                </div>
              )}
              {checkIn.blockers && (
                <div>
                  <span className="font-medium text-red-700 dark:text-red-400">Blockers:</span>
                  <p className="mt-1 text-muted-foreground">{checkIn.blockers}</p>
                </div>
              )}
              {checkIn.additional_notes && (
                <div>
                  <span className="font-medium">Notes:</span>
                  <p className="mt-1 text-muted-foreground">{checkIn.additional_notes}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PlanCard({ plan }: { plan: ReturnType<typeof useAllPostGradPlans>['data'] extends (infer T)[] | undefined ? T : never }) {
  const [open, setOpen] = useState(false);

  const sections = [
    { label: 'Career Goals', value: plan.career_goals },
    { label: 'Education Goals', value: plan.education_goals },
    { label: 'Housing Plan', value: plan.housing_plan },
    { label: 'Financial Plan', value: plan.financial_plan },
    { label: 'Health & Wellness', value: plan.health_wellness },
    { label: 'Support Needed', value: plan.support_needed },
    { label: 'Months 1-3', value: plan.month_1_3_actions },
    { label: 'Months 4-6', value: plan.month_4_6_actions },
    { label: 'Months 7-9', value: plan.month_7_9_actions },
    { label: 'Months 10-12', value: plan.month_10_12_actions },
  ].filter(s => s.value);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div>
                  <CardTitle className="text-base">
                    <Link to={`/students/${plan.student_id}`} className="text-primary hover:underline" onClick={e => e.stopPropagation()}>
                      {plan.student_name || plan.student_email}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Submitted {new Date(plan.created_at).toLocaleDateString()}
                    {plan.graduation_date && ` · Graduation: ${new Date(plan.graduation_date).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{sections.length} sections</Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map(s => (
                <div key={s.label} className="rounded-lg border border-border/40 p-3">
                  <h4 className="text-sm font-medium mb-1">{s.label}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{s.value}</p>
                </div>
              ))}
            </div>
            {plan.additional_notes && (
              <div className="mt-4 rounded-lg bg-muted/30 p-3">
                <h4 className="text-sm font-medium mb-1">Additional Notes</h4>
                <p className="text-sm text-muted-foreground">{plan.additional_notes}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
