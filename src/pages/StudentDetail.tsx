import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  User
} from 'lucide-react';
import { StickyNote, PenLine } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStudentDetail } from '@/hooks/useStudentDetail';
import { ScheduleMeetingDialog } from '@/components/scheduling/ScheduleMeetingDialog';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: student, isLoading, error } = useStudentDetail(id);

  if (isLoading) {
    return (
      <SidebarLayout>
        <LoadingSpinner />
      </SidebarLayout>
    );
  }

  if (error || !student) {
    return (
      <SidebarLayout>
        <div className="space-y-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/case-manager-managing-student-requests">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <EmptyState
            icon={User}
            title="Student not found"
            description="The student profile you're looking for doesn't exist or you don't have access to view it."
          />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/case-manager-managing-student-requests">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        {/* Profile Header */}
        <Card className="border border-border/50">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={student.profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                  {getInitials(student.profile?.full_name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="font-display text-h2 font-bold">
                    {student.profile?.full_name || 'Unknown Student'}
                  </h1>
                  {student.assignment && (
                    <p className="text-sm text-muted-foreground">
                      Assigned to {student.assignment.case_manager?.full_name || 'you'} since{' '}
                      {format(new Date(student.assignment.assigned_at), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  {student.profile?.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${student.profile.email}`} className="hover:underline">
                        {student.profile.email}
                      </a>
                    </div>
                  )}
                  {student.profile?.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{student.profile.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button asChild size="sm">
                    <Link to={`/messages/${id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Send Message
                    </Link>
                  </Button>
                  <ScheduleMeetingDialog
                    studentId={id!}
                    studentName={student.profile?.full_name || 'Student'}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Meeting
                      </Button>
                    }
                  />
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{student.stats.total_requests}</p>
                  <p className="text-xs text-muted-foreground">Total Requests</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-warning">{student.stats.pending_requests}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-success">{student.stats.resolved_requests}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">
                    {student.stats.avg_resolution_days ?? '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Days</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="requests" className="gap-2">
              <FileText className="h-4 w-4" />
              Requests ({student.requests.length})
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2">
              <Calendar className="h-4 w-4" />
              Appointments ({student.appointments.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Clock className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            {student.requests.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No requests yet"
                description="This student hasn't submitted any support requests."
              />
            ) : (
              <Card className="border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Link 
                            to={`/requests/${request.id}`} 
                            className="hover:underline font-medium"
                          >
                            {request.title}
                          </Link>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {request.description}
                          </p>
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
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-4">
            {student.appointments.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No appointments"
                description="No meetings have been scheduled with this student yet."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {student.appointments.map((appointment) => (
                  <Card key={appointment.id} className="border border-border/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{appointment.title}</CardTitle>
                        <Badge 
                          variant={appointment.status === 'scheduled' ? 'default' : 'secondary'}
                        >
                          {appointment.status}
                        </Badge>
                      </div>
                      <CardDescription>
                        {format(new Date(appointment.scheduled_at), 'PPP p')} · {appointment.duration_minutes} min
                      </CardDescription>
                    </CardHeader>
                    {appointment.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{appointment.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            {student.recentActivity.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No activity"
                description="No recent activity recorded for this student."
              />
            ) : (
              <Card className="border border-border/50">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {student.recentActivity.map((update) => (
                      <div 
                        key={update.id} 
                        className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0"
                      >
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          {update.new_status === 'resolved' ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : update.new_status === 'escalated' ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            {update.previous_status && update.new_status ? (
                              <>
                                Status changed from{' '}
                                <span className="font-medium">{update.previous_status.replace('_', ' ')}</span>
                                {' to '}
                                <span className="font-medium">{update.new_status.replace('_', ' ')}</span>
                              </>
                            ) : (
                              update.note || 'Update recorded'
                            )}
                          </p>
                          {update.note && update.previous_status && (
                            <p className="text-sm text-muted-foreground mt-1">{update.note}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
