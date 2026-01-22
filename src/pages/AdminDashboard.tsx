import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Search, 
  Filter, 
  Users, 
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  UserCog,
  Loader2,
  Eye,
  MessageSquare
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { UserManagement } from '@/components/admin/UserManagement';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { TimeAgo } from '@/components/TimeAgo';
import { EmptyState } from '@/components/EmptyState';
import { RequestQuickActions } from '@/components/requests/RequestQuickActions';
import { ComposeMessage } from '@/components/messages/ComposeMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
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
import { mockRequests, mockCaseManagers, mockAnalytics, getDashboardStats } from '@/lib/mock-data';
import type { RequestStatus } from '@/types/database';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--success))', 'hsl(var(--muted))'];

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<typeof mockRequests[0] | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedCaseManager, setSelectedCaseManager] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);
  const { toast } = useToast();

  const stats = getDashboardStats('admin');
  
  // Filter escalated or unassigned requests
  const criticalRequests = mockRequests.filter(
    r => r.status === 'escalated' || !r.assigned_case_manager_id
  );

  const filteredRequests = mockRequests.filter((request) => {
    const matchesSearch = 
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Chart data
  const statusData = [
    { name: 'Submitted', value: mockRequests.filter(r => r.status === 'submitted').length },
    { name: 'In Progress', value: mockRequests.filter(r => r.status === 'in_progress').length },
    { name: 'Escalated', value: mockRequests.filter(r => r.status === 'escalated').length },
    { name: 'Resolved', value: mockRequests.filter(r => r.status === 'resolved').length },
    { name: 'Cancelled', value: mockRequests.filter(r => r.status === 'cancelled').length },
  ];

  const weeklyData = mockAnalytics
    .filter(a => a.metric === 'requests_submitted')
    .slice(-7)
    .map(a => ({
      date: format(new Date(a.date), 'EEE'),
      requests: a.value,
    }));

  const reassignRequest = async () => {
    if (!selectedRequest || !selectedCaseManager) return;
    setIsReassigning(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const caseManager = mockCaseManagers.find(cm => cm.id === selectedCaseManager);
    toast({
      title: 'Request reassigned',
      description: `Request has been assigned to ${caseManager?.full_name}.`,
    });
    
    setIsReassigning(false);
    setReassignDialogOpen(false);
    setSelectedRequest(null);
    setSelectedCaseManager('');
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Admin Dashboard"
          description="Monitor system performance and manage request assignments"
        />

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
                        {statusData.map((entry, index) => (
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockCaseManagers.map((cm) => {
              const maxLoad = 20;
              const loadPercentage = (cm.active_requests / maxLoad) * 100;
              const isOverloaded = loadPercentage > 80;
              
              return (
                <Card key={cm.id} className="border border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{cm.full_name}</CardTitle>
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
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Emergency</span>
                        <p className="font-semibold text-destructive">{cm.emergency_requests}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Response</span>
                        <p className="font-semibold">{cm.avg_response_time}h</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link to={`/case-managers/${cm.id}`}>View Details</Link>
                      </Button>
                      <ComposeMessage
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        }
                        defaultRecipientId={cm.id}
                        defaultSubject={`Quick message`}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Escalated & Unassigned Requests */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-h3">Escalated & Unassigned</h2>
            <Badge variant="outline" className="text-destructive border-destructive">
              {criticalRequests.length} requiring attention
            </Badge>
          </div>
          
          {criticalRequests.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="All clear!"
              description="No escalated or unassigned requests at this time."
            />
          ) : (
            <Card className="border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criticalRequests.map((request) => (
                    <TableRow key={request.id} className={request.is_emergency ? 'bg-destructive/5' : undefined}>
                      <TableCell>
                        <span className="font-medium">{request.student?.full_name}</span>
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
                        <StatusBadge status={request.status} />
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
                                  setReassignDialogOpen(true);
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
              <SelectTrigger className="w-[150px]">
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
                        {request.student?.full_name}
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
                                  setReassignDialogOpen(true);
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
        </section>

        {/* User Management Section */}
        <UserManagement />

        {/* Reassign Dialog */}
        <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Reassign Request</DialogTitle>
              <DialogDescription>
                Select a case manager to assign this request to.
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="py-4 space-y-4">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="font-medium">{selectedRequest.title}</p>
                  <p className="text-sm text-muted-foreground">
                    From: {selectedRequest.student?.full_name}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Assign to Case Manager</Label>
                  <Select value={selectedCaseManager} onValueChange={setSelectedCaseManager}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select case manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCaseManagers.map((cm) => (
                        <SelectItem key={cm.id} value={cm.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{cm.full_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({cm.active_requests} active)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={reassignRequest} disabled={!selectedCaseManager || isReassigning}>
                {isReassigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reassign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarLayout>
  );
}
