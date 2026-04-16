import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Search, 
  Users, 
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  UserCog,
  MessageSquare,
  CheckSquare,
  UserCheck
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { UserManagement } from '@/components/admin/UserManagement';
import { AssignCaseManagerDialog } from '@/components/admin/AssignCaseManagerDialog';
import { StudentAssignmentsTable } from '@/components/admin/StudentAssignmentsTable';
import { NotificationSettings } from '@/components/admin/NotificationSettings';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { TimeAgo } from '@/components/TimeAgo';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { RequestQuickActions } from '@/components/requests/RequestQuickActions';
import { ComposeMessage } from '@/components/messages/ComposeMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useRequests } from '@/hooks/useRequests';
import { useCaseManagers } from '@/hooks/useCaseManagerStats';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import type { RequestStatus, SupportRequest } from '@/types/database';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--success))', 'hsl(var(--muted))'];

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch real data
  const { data: requests = [], isLoading: requestsLoading } = useRequests({});
  const { data: caseManagers = [], isLoading: caseManagersLoading } = useCaseManagers();

  // Calculate stats from real data
  const stats = useMemo(() => ({
    totalRequests: requests.length,
    pendingRequests: requests.filter(r => r.status === 'submitted' || r.status === 'in_progress').length,
    escalatedRequests: requests.filter(r => r.status === 'escalated').length,
    emergencyRequests: requests.filter(r => r.is_emergency).length,
  }), [requests]);
  
  // Filter escalated or unassigned requests
  const criticalRequests = useMemo(() => 
    requests.filter(r => r.status === 'escalated' || !r.assigned_case_manager_id),
    [requests]
  );

  const filteredRequests = useMemo(() => 
    requests.filter((request) => {
      const matchesSearch = 
        request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      return matchesSearch && matchesStatus;
    }),
    [requests, searchQuery, statusFilter]
  );

  // Get unassigned requests for bulk assignment
  const unassignedRequests = useMemo(() => 
    requests.filter(r => !r.assigned_case_manager_id && r.status === 'submitted'),
    [requests]
  );

  // Chart data from real requests
  const statusData = useMemo(() => [
    { name: 'Submitted', value: requests.filter(r => r.status === 'submitted').length },
    { name: 'In Progress', value: requests.filter(r => r.status === 'in_progress').length },
    { name: 'Escalated', value: requests.filter(r => r.status === 'escalated').length },
    { name: 'Resolved', value: requests.filter(r => r.status === 'resolved').length },
    { name: 'Cancelled', value: requests.filter(r => r.status === 'cancelled').length },
  ], [requests]);

  // Generate weekly data from real requests
  const weeklyData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    return last7Days.map(date => ({
      date: format(date, 'EEE'),
      requests: requests.filter(r => {
        const requestDate = new Date(r.created_at);
        return requestDate.toDateString() === date.toDateString();
      }).length,
    }));
  }, [requests]);

  const handleSelectRequest = (requestId: string, checked: boolean) => {
    const newSet = new Set(selectedRequestIds);
    if (checked) {
      newSet.add(requestId);
    } else {
      newSet.delete(requestId);
    }
    setSelectedRequestIds(newSet);
  };

  const handleSelectAllUnassigned = (checked: boolean) => {
    if (checked) {
      setSelectedRequestIds(new Set(unassignedRequests.map(r => r.id)));
    } else {
      setSelectedRequestIds(new Set());
    }
  };

  const selectedRequests = useMemo(() => 
    requests.filter(r => selectedRequestIds.has(r.id)),
    [requests, selectedRequestIds]
  );

  const isLoading = requestsLoading || caseManagersLoading;

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Admin Dashboard"
          description="Monitor system performance and manage request assignments"
        />

        {/* Unassigned Requests Alert Banner */}
        {unassignedRequests.length > 0 && (
          <div
            className={`flex items-center justify-between rounded-lg border p-4 ${
              unassignedRequests.some(r => r.is_emergency)
                ? 'border-destructive/50 bg-destructive/5'
                : 'border-warning/50 bg-warning/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${
                unassignedRequests.some(r => r.is_emergency) ? 'text-destructive' : 'text-warning'
              }`} />
              <div>
                <p className="font-medium text-sm">
                  {unassignedRequests.length} request{unassignedRequests.length !== 1 ? 's' : ''} awaiting case manager assignment
                </p>
                {unassignedRequests.some(r => r.is_emergency) && (
                  <p className="text-xs text-destructive mt-0.5">Includes emergency requests requiring immediate attention</p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={unassignedRequests.some(r => r.is_emergency) ? 'destructive' : 'default'}
              onClick={() => {
                document.getElementById('unassigned-requests-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Review & Assign
            </Button>
          </div>
        )}

        {/* Stats Overview */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">System Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Requests"
              value={stats.totalRequests}
              icon={Users}
              trend={{ value: 15, isPositive: true }}
            />
            <StatsCard
              title="Pending"
              value={stats.pendingRequests}
              icon={RefreshCw}
              description="Awaiting resolution"
            />
            <StatsCard
              title="Escalated"
              value={stats.escalatedRequests}
              icon={ArrowUpRight}
              description="Needs attention"
            />
            <StatsCard
              title="Emergency"
              value={stats.emergencyRequests}
              icon={AlertTriangle}
              description="Critical cases"
            />
          </div>
        </section>

        {/* Charts */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">Analytics</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Weekly Requests Chart */}
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Weekly Request Volume</CardTitle>
                <CardDescription>Requests submitted in the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))' 
                        }} 
                      />
                      <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Status Distribution</CardTitle>
                <CardDescription>Current request status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Case Manager Workloads */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">Case Manager Workloads</h2>
          {caseManagers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Case Managers"
              description="No case managers have been assigned yet."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {caseManagers.map((cm) => {
                const maxLoad = 20;
                const loadPercentage = (cm.active_requests / maxLoad) * 100;
                const isOverloaded = loadPercentage > 80;
                
                return (
                  <Card key={cm.user_id} className="border border-border/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{cm.full_name || 'Unknown'}</CardTitle>
                        {isOverloaded && (
                          <Badge variant="destructive" className="text-xs">High Load</Badge>
                        )}
                      </div>
                      <CardDescription>{cm.email}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Active Requests</span>
                          <span className="font-medium">{cm.active_requests}/{maxLoad}</span>
                        </div>
                        <Progress 
                          value={loadPercentage} 
                          className={isOverloaded ? '[&>div]:bg-destructive' : ''}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Students</span>
                          <p className="font-semibold">{cm.assigned_students || 0}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Emergency</span>
                          <p className="font-semibold text-destructive">{cm.emergency_requests}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status</span>
                          <p className="font-semibold">
                            {isOverloaded ? 'High Load' : loadPercentage > 50 ? 'Moderate' : 'Available'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link to={`/case-managers/${cm.user_id}`}>View Details</Link>
                        </Button>
                        <ComposeMessage
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          }
                          defaultRecipientId={cm.user_id}
                          defaultSubject={`Quick message`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Bulk Assignment Panel for Unassigned Requests */}
        {unassignedRequests.length > 0 && (
          <section id="unassigned-requests-section" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-h3">Unassigned Requests</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedRequestIds.size} selected
                </span>
                <Button
                  variant="default"
                  size="sm"
                  disabled={selectedRequestIds.size === 0}
                  onClick={() => setBulkAssignDialogOpen(true)}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Bulk Assign
                </Button>
              </div>
            </div>
            
            <Card className="border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedRequestIds.size === unassignedRequests.length && unassignedRequests.length > 0}
                        onCheckedChange={(checked) => handleSelectAllUnassigned(checked as boolean)}
                      />
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedRequests.map((request) => (
                    <TableRow key={request.id} className={request.is_emergency ? 'bg-destructive/5' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRequestIds.has(request.id)}
                          onCheckedChange={(checked) => handleSelectRequest(request.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{request.student?.full_name || 'Unknown'}</span>
                      </TableCell>
                      <TableCell>
                        <Link to={`/requests/${request.id}`} className="hover:underline">
                          <p className="font-medium truncate max-w-[200px]">{request.title}</p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={request.category} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={request.priority} />
                      </TableCell>
                      <TableCell>
                        <TimeAgo date={request.created_at} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <RequestQuickActions request={request} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setAssignDialogOpen(true);
                                }}
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Assign</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </section>
        )}

        {/* Escalated Requests */}
        {criticalRequests.filter(r => r.status === 'escalated').length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-h3">Escalated Requests</h2>
              <Badge variant="outline" className="text-destructive border-destructive">
                {criticalRequests.filter(r => r.status === 'escalated').length} requiring attention
              </Badge>
            </div>
            
            <Card className="border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criticalRequests.filter(r => r.status === 'escalated').map((request) => (
                    <TableRow key={request.id} className={request.is_emergency ? 'bg-destructive/5' : undefined}>
                      <TableCell>
                        <span className="font-medium">{request.student?.full_name || 'Unknown'}</span>
                      </TableCell>
                      <TableCell>
                        <Link to={`/requests/${request.id}`} className="hover:underline">
                          <p className="font-medium truncate max-w-[200px]">{request.title}</p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={request.category} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={request.priority} />
                      </TableCell>
                      <TableCell>
                        {request.case_manager?.full_name || (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <RequestQuickActions request={request} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setAssignDialogOpen(true);
                                }}
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reassign</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </section>
        )}

        {/* All Requests Table */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">All Requests</h2>
          
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RequestStatus | 'all')}>
              <SelectTrigger className="flex-1 min-w-0 sm:w-[150px] sm:flex-none">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No requests found"
              description={searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filters.' : 'No support requests have been submitted yet.'}
            />
          ) : (
            <Card className="border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Case Manager</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.slice(0, 10).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.student?.full_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Link to={`/requests/${request.id}`} className="hover:underline">
                          <p className="truncate max-w-[200px]">{request.title}</p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={request.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell>
                        {request.case_manager?.full_name || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TimeAgo date={request.created_at} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <RequestQuickActions request={request} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setAssignDialogOpen(true);
                                }}
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reassign</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        {/* Student Assignments Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <h2 className="font-display text-h3">Student Assignments</h2>
          </div>
          <Card className="border border-border/50">
            <CardContent className="pt-6">
              <StudentAssignmentsTable />
            </CardContent>
          </Card>
        </section>

        {/* System Settings Section */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">System Settings</h2>
          <NotificationSettings />
        </section>

        {/* User Management Section */}
        <UserManagement />

        {/* Single Assignment Dialog */}
        <AssignCaseManagerDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          request={selectedRequest}
          onAssigned={() => {
            setSelectedRequest(null);
            setAssignDialogOpen(false);
          }}
        />

        {/* Bulk Assignment Dialog */}
        <AssignCaseManagerDialog
          open={bulkAssignDialogOpen}
          onOpenChange={setBulkAssignDialogOpen}
          requests={selectedRequests}
          onAssigned={() => {
            setSelectedRequestIds(new Set());
            setBulkAssignDialogOpen(false);
          }}
        />
      </div>
    </SidebarLayout>
  );
}
