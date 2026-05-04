import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import {
  useAllCheckIns,
  useAllPostGradPlans,
  usePendingCheckIns,
  usePendingPostGradPlans,
  type PendingStudent,
} from '@/hooks/useSurveyResponses';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Search, ChevronDown, ChevronRight, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { SurveyPreviewDialog } from '@/components/admin/SurveyPreviewDialog';
import { SendSurveyDialog } from '@/components/admin/SendSurveyDialog';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

function MoodBadge({ rating }: { rating: number }) {
  const colors = rating >= 4 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : rating >= 3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  return <Badge className={colors}>{rating}/5</Badge>;
}

type CheckSortKey = 'student' | 'date' | 'organization';
type PlanSortKey = 'student' | 'date' | 'organization';

function cmp(a: string | null | undefined, b: string | null | undefined) {
  return (a || '').localeCompare(b || '');
}

export default function SurveyResponses() {
  const [search, setSearch] = useState('');
  const [previewType, setPreviewType] = useState<'checkin' | 'post_grad' | null>(null);
  const [checkView, setCheckView] = useState<'completed' | 'pending'>('completed');
  const [planView, setPlanView] = useState<'completed' | 'pending'>('completed');
  const { data: checkIns, isLoading: loadingCheckIns } = useAllCheckIns();
  const { data: plans, isLoading: loadingPlans } = useAllPostGradPlans();
  const { data: pendingCheckIns, isLoading: loadingPendingCheck } = usePendingCheckIns();
  const { data: pendingPlans, isLoading: loadingPendingPlan } = usePendingPostGradPlans();
  const { filters } = useGlobalFilters();

  const [checkSort, setCheckSort] = useState<{ key: CheckSortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [planSort, setPlanSort] = useState<{ key: PlanSortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });

  const orgFilter = filters.organizationId;

  const filterPending = (list: PendingStudent[] | undefined) =>
    (list || []).filter((s) => {
      if (!(s.student_name || s.student_email).toLowerCase().includes(search.toLowerCase())) return false;
      if (orgFilter.length && (!s.organization_id || !orgFilter.includes(s.organization_id))) return false;
      return true;
    });
  const filteredPendingCheck = useMemo(() => filterPending(pendingCheckIns), [pendingCheckIns, search, orgFilter]);
  const filteredPendingPlans = useMemo(() => filterPending(pendingPlans), [pendingPlans, search, orgFilter]);


  const filteredCheckIns = useMemo(() => {
    const list = (checkIns || []).filter(c => {
      if (!(c.student_name || c.student_email).toLowerCase().includes(search.toLowerCase())) return false;
      if (orgFilter.length && (!c.organization_id || !orgFilter.includes(c.organization_id))) return false;
      return true;
    });
    const sorted = [...list].sort((a, b) => {
      let r = 0;
      if (checkSort.key === 'student') r = cmp(a.student_name || a.student_email, b.student_name || b.student_email);
      else if (checkSort.key === 'organization') r = cmp(a.organization_name, b.organization_name);
      else r = a.created_at.localeCompare(b.created_at);
      return checkSort.dir === 'asc' ? r : -r;
    });
    return sorted;
  }, [checkIns, search, orgFilter, checkSort]);

  const filteredPlans = useMemo(() => {
    const list = (plans || []).filter(p => {
      if (!(p.student_name || p.student_email).toLowerCase().includes(search.toLowerCase())) return false;
      if (orgFilter.length && (!p.organization_id || !orgFilter.includes(p.organization_id))) return false;
      return true;
    });
    const sorted = [...list].sort((a, b) => {
      let r = 0;
      if (planSort.key === 'student') r = cmp(a.student_name || a.student_email, b.student_name || b.student_email);
      else if (planSort.key === 'organization') r = cmp(a.organization_name, b.organization_name);
      else r = a.created_at.localeCompare(b.created_at);
      return planSort.dir === 'asc' ? r : -r;
    });
    return sorted;
  }, [plans, search, orgFilter, planSort]);

  const toggleCheckSort = (key: CheckSortKey) => {
    setCheckSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' ? 'desc' : 'asc' });
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) =>
    !active ? <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" /> :
    dir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />;

  return (
    <SidebarLayout>
      <PageHeader title="Survey Responses" description="View all student check-ins and post-graduation plans" />

      <GlobalFilterBar visible={['cohort', 'yearOfStudy', 'organizationId']} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by student name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewType('checkin')}>
            <Eye className="mr-2 h-4 w-4" /> Preview Check-In
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreviewType('post_grad')}>
            <Eye className="mr-2 h-4 w-4" /> Preview Post-Grad Plan
          </Button>
        </div>
      </div>

      <SurveyPreviewDialog
        open={previewType !== null}
        onOpenChange={(open) => !open && setPreviewType(null)}
        surveyType={previewType || 'checkin'}
      />

      <Tabs defaultValue="checkins">
        <TabsList>
          <TabsTrigger value="checkins">Check-Ins ({filteredCheckIns.length} · {filteredPendingCheck.length} pending)</TabsTrigger>
          <TabsTrigger value="plans">Post-Graduation Plans ({filteredPlans.length} · {filteredPendingPlans.length} pending)</TabsTrigger>
        </TabsList>

        <TabsContent value="checkins">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <Select value={`${checkSort.key}-${checkSort.dir}`} onValueChange={(v) => {
              const [key, dir] = v.split('-') as [CheckSortKey, 'asc' | 'desc'];
              setCheckSort({ key, dir });
            }}>
              <SelectTrigger className="w-[220px] rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date (newest)</SelectItem>
                <SelectItem value="date-asc">Date (oldest)</SelectItem>
                <SelectItem value="student-asc">Student A–Z</SelectItem>
                <SelectItem value="student-desc">Student Z–A</SelectItem>
                <SelectItem value="organization-asc">Organization A–Z</SelectItem>
                <SelectItem value="organization-desc">Organization Z–A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loadingCheckIns ? <LoadingSpinner /> : filteredCheckIns.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No check-ins found.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className={`inline-flex items-center cursor-pointer hover:text-primary ${checkSort.key === 'student' ? 'font-semibold text-foreground' : ''}`} onClick={() => toggleCheckSort('student')}>
                        Student <SortIcon active={checkSort.key === 'student'} dir={checkSort.dir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={`inline-flex items-center cursor-pointer hover:text-primary ${checkSort.key === 'organization' ? 'font-semibold text-foreground' : ''}`} onClick={() => toggleCheckSort('organization')}>
                        Organization <SortIcon active={checkSort.key === 'organization'} dir={checkSort.dir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={`inline-flex items-center cursor-pointer hover:text-primary ${checkSort.key === 'date' ? 'font-semibold text-foreground' : ''}`} onClick={() => toggleCheckSort('date')}>
                        Date <SortIcon active={checkSort.key === 'date'} dir={checkSort.dir} />
                      </button>
                    </TableHead>
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
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <Select value={`${planSort.key}-${planSort.dir}`} onValueChange={(v) => {
              const [key, dir] = v.split('-') as [PlanSortKey, 'asc' | 'desc'];
              setPlanSort({ key, dir });
            }}>
              <SelectTrigger className="w-[200px] rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date (newest)</SelectItem>
                <SelectItem value="date-asc">Date (oldest)</SelectItem>
                <SelectItem value="student-asc">Student A–Z</SelectItem>
                <SelectItem value="student-desc">Student Z–A</SelectItem>
                <SelectItem value="organization-asc">Organization A–Z</SelectItem>
                <SelectItem value="organization-desc">Organization Z–A</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        <TableCell className="text-sm text-muted-foreground">
          {checkIn.organization_name || '—'}
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
          <TableCell colSpan={6} className="bg-muted/30 px-6 py-4">
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
                    {plan.organization_name && <><span className="font-medium">{plan.organization_name}</span> · </>}
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
