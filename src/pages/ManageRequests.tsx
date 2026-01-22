import { useState } from 'react';
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
  Loader2,
  Eye
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { AIBadge } from '@/components/AIBadge';
import { TimeAgo } from '@/components/TimeAgo';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { mockRequests, mockAIInsights } from '@/lib/mock-data';
import type { RequestStatus, RequestPriority } from '@/types/database';

export default function ManageRequests() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | 'all'>('all');
  const [sortField, setSortField] = useState<'created_at' | 'priority'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRequest, setSelectedRequest] = useState<typeof mockRequests[0] | null>(null);
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
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

  const updateRequestStatus = (requestId: string, newStatus: RequestStatus) => {
    toast({
      title: 'Status updated',
      description: `Request status changed to ${newStatus.replace('_', ' ')}.`,
    });
    setSelectedRequest(null);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setIsSubmittingNote(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    toast({
      title: 'Note added',
      description: 'Your note has been added to the request.',
    });
    setNewNote('');
    setIsSubmittingNote(false);
  };

  const priorityCount = {
    emergency: caseManagerRequests.filter(r => r.priority === 'emergency' && r.status !== 'resolved').length,
    high: caseManagerRequests.filter(r => r.priority === 'high' && r.status !== 'resolved').length,
  };

  return (
    <AppLayout>
      <div className="space-y-12">
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
                      <TableCell>
                        <TimeAgo date={request.created_at} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        {/* Request Detail Sheet */}
        <Sheet open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedRequest && (
              <>
                <SheetHeader>
                  <SheetTitle className="font-display">{selectedRequest.title}</SheetTitle>
                  <SheetDescription>
                    Request from {selectedRequest.student?.full_name}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Status & Priority */}
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={selectedRequest.status} />
                    <PriorityBadge priority={selectedRequest.priority} />
                    <CategoryBadge category={selectedRequest.category} />
                    {selectedRequest.is_emergency && (
                      <Badge variant="destructive">Emergency</Badge>
                    )}
                  </div>

                  {/* Student Info */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Student Information</h3>
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {selectedRequest.student?.full_name?.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{selectedRequest.student?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{selectedRequest.student?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Description</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.description}
                    </p>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Timeline</h3>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Submitted</span>
                        <span>{format(new Date(selectedRequest.created_at), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span>{format(new Date(selectedRequest.updated_at), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Update Status */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Update Status</h3>
                    <Select 
                      value={selectedRequest.status}
                      onValueChange={(value) => updateRequestStatus(selectedRequest.id, value as RequestStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Add Note */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Add Note</h3>
                    <Textarea
                      placeholder="Add a note about this request..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                    />
                    <Button onClick={addNote} disabled={!newNote.trim() || isSubmittingNote} size="sm">
                      {isSubmittingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Add Note
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="flex-1">
                          <Calendar className="mr-2 h-4 w-4" />
                          Schedule Meeting
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Schedule Meeting</DialogTitle>
                          <DialogDescription>
                            Schedule a meeting with {selectedRequest.student?.full_name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <p className="text-sm text-muted-foreground">
                            Meeting scheduling UI would go here with calendar integration.
                          </p>
                        </div>
                        <DialogFooter>
                          <Button variant="outline">Cancel</Button>
                          <Button>Send Invite</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
