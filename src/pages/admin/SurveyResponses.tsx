import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { ArrowLeft } from 'lucide-react';
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
import { Search, ChevronDown, ChevronRight, Eye, ArrowUp, ArrowDown, ArrowUpDown, Trash2 } from 'lucide-react';
import { SurveyPreviewDialog } from '@/components/admin/SurveyPreviewDialog';
import { SendSurveyDialog } from '@/components/admin/SendSurveyDialog';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDeleteCheckIn } from '@/hooks/useStudentCheckIns';
import { useDeletePlan } from '@/hooks/usePostGraduationPlan';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const cohortFilter = filters.cohort;
  const yearFilter = filters.yearOfStudy;

  const matchesGlobal = (row: { organization_id: string | null; cohort_id?: string | null; year_of_study?: string | null }) => {
    if (orgFilter.length && (!row.organization_id || !orgFilter.includes(row.organization_id))) return false;
    if (cohortFilter.length && (!row.cohort_id || !cohortFilter.includes(row.cohort_id))) return false;
    if (yearFilter.length && (!row.year_of_study || !yearFilter.includes(row.year_of_study))) return false;
    return true;
  };

  const filterPending = (list: PendingStudent[] | undefined) =>
    (list || []).filter((s) => {
      if (!(s.student_name || s.student_email).toLowerCase().includes(search.toLowerCase())) return false;
      return matchesGlobal(s);
    });
  const filteredPendingCheck = useMemo(() => filterPending(pendingCheckIns), [pendingCheckIns, search, orgFilter, cohortFilter, yearFilter]);
  const filteredPendingPlans = useMemo(() => filterPending(pendingPlans), [pendingPlans, search, orgFilter, cohortFilter, yearFilter]);


  const filteredCheckIns = useMemo(() => {
    const list = (checkIns || []).filter(c => {
      if (!(c.student_name || c.student_email).toLowerCase().includes(search.toLowerCase())) return false;
      return matchesGlobal(c);
    });
    const sorted = [...list].sort((a, b) => {
      let r = 0;
      if (checkSort.key === 'student') r = cmp(a.student_name || a.student_email, b.student_name || b.student_email);
      else if (checkSort.key === 'organization') r = cmp(a.organization_name, b.organization_name);
      else r = a.created_at.localeCompare(b.created_at);
      return checkSort.dir === 'asc' ? r : -r;
    });
    return sorted;
  }, [checkIns, search, orgFilter, cohortFilter, yearFilter, checkSort]);

  const filteredPlans = useMemo(() => {
    const list = (plans || []).filter(p => {
      if (!(p.student_name || p.student_email).toLowerCase().includes(search.toLowerCase())) return false;
      return matchesGlobal(p);
    });
    const sorted = [...list].sort((a, b) => {
      let r = 0;
      if (planSort.key === 'student') r = cmp(a.student_name || a.student_email, b.student_name || b.student_email);
      else if (planSort.key === 'organization') r = cmp(a.organization_name, b.organization_name);
      else r = a.created_at.localeCompare(b.created_at);
      return planSort.dir === 'asc' ? r : -r;
    });
    return sorted;
  }, [plans, search, orgFilter, cohortFilter, yearFilter, planSort]);

  const toggleCheckSort = (key: CheckSortKey) => {
    setCheckSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' ? 'desc' : 'asc' });
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) =>
    !active ? <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" /> :
    dir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />;

  return (
    <SidebarLayout>
      <PageHeader title="Surveys" description="View all student check-ins and post-graduation plans" />
      <SurveyViewSwitcher />

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
          <ViewToggle value={checkView} onChange={setCheckView} pendingCount={filteredPendingCheck.length} completedCount={filteredCheckIns.length} />
          {checkView === 'pending' ? (
            <PendingTable
              loading={loadingPendingCheck}
              rows={filteredPendingCheck}
              surveyType="checkin"
              showLastSubmitted
              overdueAfterDays={21}
              emptyText="Everyone is up to date on check-ins."
            />
          ) : (
            <>
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
            </>
          )}
        </TabsContent>

        <TabsContent value="plans">
          <ViewToggle value={planView} onChange={setPlanView} pendingCount={filteredPendingPlans.length} completedCount={filteredPlans.length} />
          {planView === 'pending' ? (
            <PendingTable
              loading={loadingPendingPlan}
              rows={filteredPendingPlans}
              surveyType="post_graduation_plan"
              showLastSubmitted={false}
              emptyText="All students have submitted a post-graduation plan."
            />
          ) : (
            <>
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
            </>
          )}
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}

function CheckInRow({ checkIn }: { checkIn: ReturnType<typeof useAllCheckIns>['data'] extends (infer T)[] | undefined ? T : never }) {
  const [open, setOpen] = useState(false);
  const { role } = useAuth();
  const del = useDeleteCheckIn();
  const hasDetails = checkIn.wins || checkIn.blockers || checkIn.additional_notes;
  const isAdmin = role === 'admin';

  const handleDelete = async () => {
    try {
      await del.mutateAsync(checkIn.id);
      toast.success('Check-in deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete check-in');
    }
  };

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
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Delete check-in"
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this check-in?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the submission from{' '}
                      <span className="font-medium">{checkIn.student_name || checkIn.student_email}</span>{' '}
                      on {new Date(checkIn.created_at).toLocaleDateString()}. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {hasDetails && (open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
          </div>
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
  const { role } = useAuth();
  const del = useDeletePlan();
  const isAdmin = role === 'admin';

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

  const handleDelete = async () => {
    try {
      await del.mutateAsync(plan.id);
      toast.success('Post-graduation plan deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete plan');
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <div className="min-w-0">
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
              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                <Badge variant="outline">{sections.length} sections</Badge>
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Delete plan"
                        disabled={del.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this post-graduation plan?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes the plan from{' '}
                          <span className="font-medium">{plan.student_name || plan.student_email}</span>{' '}
                          submitted {new Date(plan.created_at).toLocaleDateString()}. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
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

function ViewToggle({
  value,
  onChange,
  pendingCount,
  completedCount,
}: {
  value: 'completed' | 'pending';
  onChange: (v: 'completed' | 'pending') => void;
  pendingCount: number;
  completedCount: number;
}) {
  return (
    <div className="mb-4">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as 'completed' | 'pending')}
        className="rounded-full border bg-muted p-1"
      >
        <ToggleGroupItem value="completed" className="rounded-full px-4 text-sm data-[state=on]:bg-background data-[state=on]:shadow-sm">
          Completed ({completedCount})
        </ToggleGroupItem>
        <ToggleGroupItem value="pending" className="rounded-full px-4 text-sm data-[state=on]:bg-background data-[state=on]:shadow-sm">
          Not completed ({pendingCount})
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function PendingTable({
  loading,
  rows,
  surveyType,
  showLastSubmitted,
  overdueAfterDays,
  emptyText,
}: {
  loading: boolean;
  rows: PendingStudent[];
  surveyType: 'checkin' | 'post_graduation_plan';
  showLastSubmitted: boolean;
  overdueAfterDays?: number;
  emptyText: string;
}) {
  if (loading) return <LoadingSpinner />;
  if (rows.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">{emptyText}</CardContent></Card>;
  }
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Organization</TableHead>
            {showLastSubmitted && <TableHead>Last submitted</TableHead>}
            {showLastSubmitted && <TableHead>Days overdue</TableHead>}
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const overdueBy =
              showLastSubmitted && overdueAfterDays != null && s.days_since != null
                ? Math.max(0, s.days_since - overdueAfterDays)
                : null;
            return (
              <TableRow key={s.student_id}>
                <TableCell>
                  <Link to={`/students/${s.student_id}`} className="font-medium text-primary hover:underline">
                    {s.student_name || s.student_email}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.organization_name || '—'}</TableCell>
                {showLastSubmitted && (
                  <TableCell className="text-sm text-muted-foreground">
                    {s.last_submitted_at
                      ? `${s.days_since} day${s.days_since === 1 ? '' : 's'} ago`
                      : 'Never'}
                  </TableCell>
                )}
                {showLastSubmitted && (
                  <TableCell>
                    {overdueBy != null && overdueBy > 0 ? (
                      <Badge variant="destructive">{overdueBy}d</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <SendSurveyDialog
                    studentId={s.student_id}
                    studentName={s.student_name || s.student_email}
                    trigger={
                      <Button variant="outline" size="sm" className="rounded-full">
                        Send reminder
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
