import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  ArrowRight,
  Plus,
  Video,
  MapPin
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { RequestCard } from '@/components/RequestCard';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { TimeAgo } from '@/components/TimeAgo';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { mockRequests, mockAppointments } from '@/lib/mock-data';
import type { RequestStatus, RequestCategory } from '@/types/database';

export default function TrackRequests() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<RequestCategory | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<typeof mockRequests[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Filter requests for the logged-in student
  const studentRequests = mockRequests.filter(r => r.student_id === 'student-user-1');
  
  const filteredRequests = studentRequests.filter((request) => {
    const matchesSearch = request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || request.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Get appointments for this student
  const studentAppointments = mockAppointments.filter(a => a.student_id === 'student-user-1' && a.status === 'scheduled');

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader
            title="Track Your Requests"
            description="View the status of your support requests and schedule meetings"
          />
          <Button asChild>
            <Link to="/student-submitting-a-support-request">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Link>
          </Button>
        </div>

        {/* Upcoming Appointments */}
        {studentAppointments.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-h3">Upcoming Appointments</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {studentAppointments.slice(0, 3).map((apt) => (
                <Card key={apt.id} className="border border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{apt.title}</CardTitle>
                    <CardDescription>
                      with {apt.case_manager?.full_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(apt.scheduled_at), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(apt.scheduled_at), 'h:mm a')} ({apt.duration_minutes} min)</span>
                    </div>
                    {apt.meeting_link && (
                      <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                        <a href={apt.meeting_link} target="_blank" rel="noopener noreferrer">
                          <Video className="mr-2 h-4 w-4" />
                          Join Meeting
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        <section className="space-y-4">
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
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RequestStatus | 'all')}>
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[140px]">
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
            </div>
          </div>
        </section>

        {/* Request List */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">Your Requests</h2>
          
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No requests found"
              description={studentRequests.length === 0 
                ? "You haven't submitted any support requests yet."
                : "No requests match your current filters."
              }
              action={
                studentRequests.length === 0 ? (
                  <Button asChild>
                    <Link to="/student-submitting-a-support-request">
                      <Plus className="mr-2 h-4 w-4" />
                      Submit Your First Request
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
                <Sheet key={request.id}>
                  <SheetTrigger asChild>
                    <div className="cursor-pointer">
                      <RequestCard request={request} onClick={() => setSelectedRequest(request)} />
                    </div>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="font-display">{request.title}</SheetTitle>
                      <SheetDescription>
                        Request ID: {request.id}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-6">
                      {/* Status & Priority */}
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={request.status} />
                        <PriorityBadge priority={request.priority} />
                        <CategoryBadge category={request.category} />
                      </div>

                      {/* Timeline */}
                      <div className="space-y-4">
                        <h3 className="font-semibold">Timeline</h3>
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="h-3 w-3 rounded-full bg-primary" />
                              <div className="w-px flex-1 bg-border" />
                            </div>
                            <div className="pb-4">
                              <p className="text-sm font-medium">Submitted</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                          {request.status !== 'submitted' && (
                            <div className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className="h-3 w-3 rounded-full bg-primary" />
                                <div className="w-px flex-1 bg-border" />
                              </div>
                              <div className="pb-4">
                                <p className="text-sm font-medium">In Progress</p>
                                <p className="text-xs text-muted-foreground">
                                  Assigned to {request.case_manager?.full_name || 'Case Manager'}
                                </p>
                              </div>
                            </div>
                          )}
                          {request.resolved_at && (
                            <div className="flex gap-3">
                              <div className="h-3 w-3 rounded-full bg-success" />
                              <div>
                                <p className="text-sm font-medium">Resolved</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(request.resolved_at), 'MMM d, yyyy h:mm a')}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <h3 className="font-semibold">Description</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {request.description}
                        </p>
                      </div>

                      {/* Case Manager Info */}
                      {request.case_manager && (
                        <div className="space-y-2">
                          <h3 className="font-semibold">Your Case Manager</h3>
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {request.case_manager.full_name?.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{request.case_manager.full_name}</p>
                              <p className="text-sm text-muted-foreground">{request.case_manager.email}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Schedule Meeting Button */}
                      {request.case_manager && request.status !== 'resolved' && request.status !== 'cancelled' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button className="w-full">
                              <Calendar className="mr-2 h-4 w-4" />
                              Schedule Meeting
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-display">Schedule a Meeting</DialogTitle>
                              <DialogDescription>
                                Select a date to see available time slots with {request.case_manager.full_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-center py-4">
                              <CalendarComponent
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Available Times</p>
                              <div className="grid grid-cols-3 gap-2">
                                {['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'].map((time) => (
                                  <Button key={time} variant="outline" size="sm">
                                    {time}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              ))}
            </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}
