import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc,
  Calendar,
  MessageSquare,
  AlertCircle,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { AIBadge } from '@/components/AIBadge';
import { TimeAgo } from '@/components/TimeAgo';
import { EmptyState } from '@/components/EmptyState';
import { RequestQuickActions } from '@/components/requests/RequestQuickActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/hooks/use-toast';
import { mockRequests, mockAIInsights } from '@/lib/mock-data';
import type { RequestStatus, RequestPriority } from '@/types/database';

export default function ManageRequests() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | 'all'>('all');
  const [sortField, setSortField] = useState<'created_at' | 'priority'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  // Filter requests for the logged-in case manager
  const caseManagerRequests = mockRequests.filter(
    r => r.assigned_case_manager_id === 'cm-user-1' || r.assigned_case_manager_id === null
  );
  
  const filteredRequests = caseManagerRequests
    .filter((request) => {
      const matchesSearch = 
        request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
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

  // Get AI insights for this case manager
  const insights = mockAIInsights.filter(i => i.case_manager_id === 'cm-user-1' && !i.is_dismissed);

  const priorityCount = {
    emergency: caseManagerRequests.filter(r => r.priority === 'emergency' && r.status !== 'resolved').length,
    high: caseManagerRequests.filter(r => r.priority === 'high' && r.status !== 'resolved').length,
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Manage Student Requests"
          description="Review and respond to student support requests assigned to you"
        />

        {/* AI Insights Section */}
        {insights.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-h3">AI Insights</h2>
              <AIBadge />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.slice(0, 3).map((insight) => (
                <Card key={insight.id} className="border border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      {insight.insight_type === 'alert' && (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                      {insight.insight_type === 'suggestion' && (
                        <TrendingUp className="h-5 w-5 text-primary" />
                      )}
                      <CardTitle className="text-base">
                        {(insight.content as any).title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {(insight.content as any).message}
                    </p>
                    {(insight.content as any).action && (
                      <Button variant="outline" size="sm" className="mt-3">
                        {(insight.content as any).action}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Priority Queue Alert */}
        {(priorityCount.emergency > 0 || priorityCount.high > 0) && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-semibold">Attention Required</p>
                <p className="text-sm text-muted-foreground">
                  You have {priorityCount.emergency} emergency and {priorityCount.high} high-priority requests pending.
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                className="ml-auto"
                onClick={() => setPriorityFilter('emergency')}
              >
                View Emergency
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <section className="space-y-4">
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
                <SelectTrigger className="w-[130px]">
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

              <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as RequestPriority | 'all')}>
                <SelectTrigger className="w-[130px]">
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
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'desc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </section>

        {/* Requests Table */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">Request Queue</h2>
          
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No requests found"
              description="No requests match your current filters."
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
                    <TableHead>Created</TableHead>
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
                          <span className="font-medium">{request.student?.full_name}</span>
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
                        <TimeAgo date={request.created_at} />
                      </TableCell>
                      <TableCell className="text-right">
                        <RequestQuickActions request={request} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}
