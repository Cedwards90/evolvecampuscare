import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc,
  ArrowLeft,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { TimeAgo } from '@/components/TimeAgo';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { useAuth } from '@/contexts/AuthContext';
import { useRequests } from '@/hooks/useRequests';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import type { RequestStatus, RequestPriority, RequestCategory } from '@/types/database';

const categoryLabels: Record<RequestCategory, string> = {
  academic: 'Academic Advising',
  financial: 'Financial Aid',
  mental_health: 'Mental Health',
  housing: 'Housing',
  other: 'Other',
};

const statusLabels: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

export default function RequestsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  
  // Parse URL params for initial filter state
  const initialStatus = (searchParams.get('status') as RequestStatus | 'all') || 'all';
  const initialCategory = (searchParams.get('category') as RequestCategory | 'all') || 'all';
  const initialPriority = (searchParams.get('priority') as RequestPriority | 'all') || 'all';
  const initialEmergency = searchParams.get('is_emergency') === 'true';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState<RequestCategory | 'all'>(initialCategory);
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | 'all'>(initialPriority);
  const [showEmergencyOnly, setShowEmergencyOnly] = useState(initialEmergency);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Build filter object based on role
  const filters = {
    status: statusFilter,
    category: categoryFilter,
    priority: priorityFilter,
    isEmergency: showEmergencyOnly ? true : undefined,
    search: searchQuery || undefined,
    // Students only see their own requests
    studentId: role === 'student' ? user?.id : undefined,
  };

  const { data: requests, isLoading, error } = useRequests(filters);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (showEmergencyOnly) params.set('is_emergency', 'true');
    setSearchParams(params, { replace: true });
  }, [statusFilter, categoryFilter, priorityFilter, showEmergencyOnly, setSearchParams]);

  // Sort requests
  const sortedRequests = [...(requests || [])].sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return sortOrder === 'desc' ? diff : -diff;
  });

  // Generate page title based on filters
  const getPageTitle = () => {
    const parts: string[] = [];
    if (showEmergencyOnly) parts.push('Emergency');
    if (categoryFilter !== 'all') parts.push(categoryLabels[categoryFilter]);
    if (statusFilter !== 'all') parts.push(statusLabels[statusFilter]);
    parts.push('Requests');
    return parts.join(' ');
  };

  const getPageDescription = () => {
    if (role === 'student') return 'View and track all your support requests';
    if (role === 'case_manager') return 'View all requests in the system';
    return 'Monitor and manage all support requests across the system';
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Back button and header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={getPageTitle()}
            description={getPageDescription()}
          />
        </div>

        {role !== 'student' && (
          <GlobalFilterBar visible={['organizationId', 'program', 'cohort', 'assignedCaseManagerId', 'studentStatus']} />
        )}

        {/* Active Filters Display */}
        {(statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || showEmergencyOnly) && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusLabels[statusFilter]}
                <button onClick={() => setStatusFilter('all')} className="ml-1 hover:text-destructive">×</button>
              </Badge>
            )}
            {categoryFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Category: {categoryLabels[categoryFilter]}
                <button onClick={() => setCategoryFilter('all')} className="ml-1 hover:text-destructive">×</button>
              </Badge>
            )}
            {priorityFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Priority: {priorityFilter}
                <button onClick={() => setPriorityFilter('all')} className="ml-1 hover:text-destructive">×</button>
              </Badge>
            )}
            {showEmergencyOnly && (
              <Badge variant="destructive" className="gap-1">
                Emergency Only
                <button onClick={() => setShowEmergencyOnly(false)} className="ml-1">×</button>
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setPriorityFilter('all');
                setShowEmergencyOnly(false);
              }}
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Filters */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RequestStatus | 'all')}>
                <SelectTrigger className="flex-1 min-w-0 sm:w-[140px] sm:flex-none">
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

              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as RequestCategory | 'all')}>
                <SelectTrigger className="flex-1 min-w-0 sm:w-[150px] sm:flex-none">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="mental_health">Mental Health</SelectItem>
                  <SelectItem value="housing">Housing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
                variant={showEmergencyOnly ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setShowEmergencyOnly(!showEmergencyOnly)}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Emergency
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'desc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </section>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${sortedRequests.length} request${sortedRequests.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Requests Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : sortedRequests.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No requests found"
            description="No requests match your current filters. Try adjusting the filters or search query."
          />
        ) : (
          <Card className="border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  {role !== 'student' && <TableHead>Student</TableHead>}
                  <TableHead>Request</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  {role === 'admin' && <TableHead>Assigned To</TableHead>}
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRequests.map((request) => (
                  <TableRow 
                    key={request.id}
                    className={`cursor-pointer hover:bg-muted/50 ${request.is_emergency ? 'bg-destructive/5' : ''}`}
                    onClick={() => navigate(`/requests/${request.id}`)}
                  >
                    {role !== 'student' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {request.student?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">{request.student?.full_name || 'Unknown'}</span>
                            {request.is_emergency && (
                              <AlertTriangle className="inline-block ml-1 h-3 w-3 text-destructive" />
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="font-medium truncate">{request.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{request.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={request.category} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={request.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    {role === 'admin' && (
                      <TableCell>
                        {request.case_manager?.full_name || (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <TimeAgo date={request.created_at} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
