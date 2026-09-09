import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc,
  AlertCircle,
  TrendingUp,
  X
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { AIBadge } from '@/components/AIBadge';
import { TimeAgo } from '@/components/TimeAgo';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { RequestQuickActions } from '@/components/requests/RequestQuickActions';
import { MyStudentsSection } from '@/components/casemanager/MyStudentsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRequests } from '@/hooks/useRequests';
import { useMyStudents } from '@/hooks/useMyStudents';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { applyToRequests } from '@/lib/applyGlobalFilters';
import type { RequestStatus, RequestPriority } from '@/types/database';

type QueueView = 'active' | 'resolved' | 'all';

const ACTIVE_STATUSES: RequestStatus[] = ['submitted', 'in_progress', 'escalated'];
const RESOLVED_STATUSES: RequestStatus[] = ['resolved', 'cancelled'];

const statusLabels: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

const categoryLabels: Record<RequestCategory, string> = {
  academic: 'Training & Program',
  financial: 'Financial Assistance',
  mental_health: 'Wellbeing',
  housing: 'Housing Stability',
  other: 'Other',
};

export default function ManageRequests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  const statusParam = searchParams.get('status') as RequestStatus | null;
  const priorityParam = searchParams.get('priority') as RequestPriority | null;
  const categoryParam = searchParams.get('category') as RequestCategory | null;
  const emergencyParam = searchParams.get('is_emergency') === 'true';
  const viewParam = searchParams.get('view') as QueueView | null;

  const initialStatus =
    statusParam && Object.keys(statusLabels).includes(statusParam) ? statusParam : 'all';
  const initialView: QueueView =
    viewParam && ['active', 'resolved', 'all'].includes(viewParam)
      ? viewParam
      : initialStatus !== 'all'
        ? RESOLVED_STATUSES.includes(initialStatus)
          ? 'resolved'
          : 'all'
        : 'active';

  const [view, setView] = useState<QueueView>(initialView);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | 'all'>(
    priorityParam && ['emergency', 'high', 'medium', 'low'].includes(priorityParam)
      ? priorityParam
      : 'all',
  );
  const [categoryFilter, setCategoryFilter] = useState<RequestCategory | 'all'>(
    categoryParam && Object.keys(categoryLabels).includes(categoryParam) ? categoryParam : 'all',
  );
  const [emergencyOnly, setEmergencyOnly] = useState(emergencyParam);
  const [sortField, setSortField] = useState<'created_at' | 'priority'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();
  const { user } = useAuth();

  // Keep the URL in sync so a shared link reproduces exactly this list.
  useEffect(() => {
    const params = new URLSearchParams();
    if (view !== 'active') params.set('view', view);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (emergencyOnly) params.set('is_emergency', 'true');
    setSearchParams(params, { replace: true });
  }, [view, statusFilter, priorityFilter, categoryFilter, emergencyOnly, setSearchParams]);

  // Fetch real data from Supabase
  const { data: requests, isLoading: requestsLoading } = useRequests({
    assignedCaseManagerId: user?.id,
  });
  const { data: myStudents, isLoading: studentsLoading } = useMyStudents(user?.id);

  const { filters: globalFilters } = useGlobalFilters();

  const matchesView = (status: RequestStatus) => {
    if (view === 'active') return ACTIVE_STATUSES.includes(status);
    if (view === 'resolved') return RESOLVED_STATUSES.includes(status);
    return true;
  };

  // Filter and sort requests
  const filteredRequests = applyToRequests(requests || [], globalFilters)
    .filter((request) => {
      const matchesSearch =
        request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;
      const matchesCategory = categoryFilter === 'all' || request.category === categoryFilter;
      const matchesEmergency = !emergencyOnly || request.is_emergency;
      return (
        matchesSearch &&
        matchesView(request.status) &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory &&
        matchesEmergency
      );
    })
    .sort((a, b) => {
      if (sortField === 'priority') {
        const priorityOrder = { emergency: 4, high: 3, medium: 2, low: 1 };
        const diff = priorityOrder[b.priority] - priorityOrder[a.priority];
        return sortOrder === 'desc' ? diff : -diff;
      }
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === 'desc' ? diff : -diff;
    });

  const activeChips: { label: string; clear: () => void }[] = [
    ...(statusFilter !== 'all'
      ? [{ label: `Status: ${statusLabels[statusFilter]}`, clear: () => setStatusFilter('all') }]
      : []),
    ...(priorityFilter !== 'all'
      ? [
          {
            label: `Priority: ${priorityFilter.charAt(0).toUpperCase()}${priorityFilter.slice(1)}`,
            clear: () => setPriorityFilter('all'),
          },
        ]
      : []),
    ...(categoryFilter !== 'all'
      ? [{ label: `Category: ${categoryLabels[categoryFilter]}`, clear: () => setCategoryFilter('all') }]
      : []),
    ...(emergencyOnly ? [{ label: 'Emergency only', clear: () => setEmergencyOnly(false) }] : []),
  ];

  const clearAll = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setEmergencyOnly(false);
    setSearchQuery('');
  };

  const priorityCount = {
    emergency: (requests || []).filter(r => r.priority === 'emergency' && ACTIVE_STATUSES.includes(r.status)).length,
    high: (requests || []).filter(r => r.priority === 'high' && ACTIVE_STATUSES.includes(r.status)).length,
  };

  if (requestsLoading && studentsLoading) {
    return (
      <SidebarLayout>
        <LoadingSpinner />
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Request Queue"
          description="Review and respond to support requests assigned to you"
        />

        <GlobalFilterBar visible={['cohort', 'yearOfStudy', 'organizationId', 'status', 'assignedCaseManagerId']} />

        {/* My Students Section */}
        <MyStudentsSection 
          students={myStudents || []} 
          isLoading={studentsLoading} 
        />

        {/* Priority Queue Alert */}
        {(priorityCount.emergency > 0 || priorityCount.high > 0) && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4">
              <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Attention Required</p>
                <p className="text-sm text-muted-foreground">
                  You have {priorityCount.emergency} emergency and {priorityCount.high} high-priority requests open.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="sm:ml-auto w-full sm:w-auto"
                onClick={() => {
                  setView('active');
                  setPriorityFilter('emergency');
                }}
              >
                View Emergency
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <section className="space-y-4">
          <Tabs value={view} onValueChange={(v) => setView(v as QueueView)}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, description, or student name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RequestStatus | 'all')}>
                <SelectTrigger className="flex-1 min-w-0 sm:w-[130px] sm:flex-none">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as RequestPriority | 'all')}>
                <SelectTrigger className="flex-1 min-w-0 sm:w-[130px] sm:flex-none">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                aria-label={sortOrder === 'desc' ? 'Sort oldest first' : 'Sort newest first'}
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'desc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
              {view === 'active' ? ' open' : view === 'resolved' ? ' completed' : ''}
            </span>
            {activeChips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove filter ${chip.label}`}
                  onClick={chip.clear}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {activeChips.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            )}
          </div>
        </section>


        {/* Requests Table */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">Request Queue</h2>
          
          {requestsLoading ? (
            <LoadingSpinner />
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No requests found"
              description="No requests match your current filters."
            />
          ) : (
            <>
              {/* Mobile card list */}
              <div className="space-y-3 sm:hidden">
                {filteredRequests.map((request) => (
                  <Card
                    key={request.id}
                    className={request.is_emergency ? 'border-destructive/50 bg-destructive/5' : 'border-border/50'}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/requests/${request.id}`} className="flex-1 min-w-0 hover:underline">
                          <p className="font-medium truncate">{request.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{request.description}</p>
                        </Link>
                        <StatusBadge status={request.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-primary">
                            {request.student?.full_name?.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <Link
                          to={`/students/${request.student_id}`}
                          className="font-medium hover:underline truncate"
                        >
                          {request.student?.full_name}
                        </Link>
                        <span className="ml-auto text-muted-foreground"><TimeAgo date={request.created_at} /></span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <PriorityBadge priority={request.priority} />
                          <CategoryBadge category={request.category} />
                        </div>
                        <RequestQuickActions request={request} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <Card className="border border-border/50 hidden sm:block overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Request</TableHead>
                        <TableHead className="hidden md:table-cell">Category</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => (
                        <TableRow
                          key={request.id}
                          className={request.is_emergency ? 'bg-destructive/5' : undefined}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-semibold text-primary">
                                  {request.student?.full_name?.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <Link
                                to={`/students/${request.student_id}`}
                                className="font-medium hover:underline"
                              >
                                {request.student?.full_name}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link to={`/requests/${request.id}`} className="hover:underline">
                              <div className="max-w-xs">
                                <p className="font-medium truncate">{request.title}</p>
                                <p className="text-sm text-muted-foreground truncate">{request.description}</p>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <CategoryBadge category={request.category} />
                          </TableCell>
                          <TableCell>
                            <PriorityBadge priority={request.priority} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={request.status} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <TimeAgo date={request.created_at} />
                          </TableCell>
                          <TableCell className="text-right">
                            <RequestQuickActions request={request} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}
