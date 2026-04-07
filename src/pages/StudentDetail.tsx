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
import { StickyNote, PenLine, Building2 } from 'lucide-react';
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
import { useFileNotes } from '@/hooks/useFileNotes';
import { useStudentCheckIns } from '@/hooks/useStudentCheckIns';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrgBadgeInline } from '@/components/OrgBadgeInline';
import { Smile, Frown, Meh, TrendingUp as TrendUp, TrendingDown } from 'lucide-react';

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
            <TabsTrigger value="file" className="gap-2">
              <StickyNote className="h-4 w-4" />
              Student File
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
                    {student.profile?.organization_id && (
                      <OrgBadgeInline orgId={student.profile.organization_id} />
                    )}
                  </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Student File Tab */}
          <TabsContent value="file" className="space-y-4">
            <StudentFileTab studentId={id!} requests={student.requests} />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}

// ---- Student File Tab Component ----
function StudentFileTab({ studentId, requests }: { studentId: string; requests: import('@/types/database').SupportRequest[] }) {
  const { notes, isLoading: notesLoading, addNote } = useFileNotes(studentId);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const { data: intakeResponses = [], isLoading: intakeLoading } = useQuery({
    queryKey: ['intake-responses-admin', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intake_responses')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await addNote.mutateAsync({ content: newNote });
      setNewNote('');
    } finally {
      setAddingNote(false);
    }
  };

  const sectionLabels: Record<string, string> = {
    about_you: 'About You',
    daily_needs: 'Day-to-Day Needs',
    wellbeing: 'Wellbeing',
    goals: 'Goals',
  };

  const renderResponseValue = (key: string, value: any): string => {
    if (Array.isArray(value)) return value.length ? value.join(', ') : 'None selected';
    if (typeof value === 'number') return String(value);
    return value || '—';
  };

  const formatKey = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="space-y-4">
      {/* Intake Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Intake Summary</CardTitle>
          <CardDescription>
            {intakeResponses.length > 0
              ? 'Responses from the student wellness check-in'
              : 'The student has not completed the intake survey yet.'}
          </CardDescription>
        </CardHeader>
        {intakeResponses.length > 0 && (
          <CardContent className="space-y-4">
            {intakeResponses.map((section) => (
              <div key={section.id} className="space-y-2">
                <h4 className="font-medium text-sm text-primary">
                  {sectionLabels[section.section] || section.section}
                </h4>
                <div className="grid gap-1 pl-3 border-l-2 border-primary/20">
                  {Object.entries(section.responses as Record<string, any>).map(([key, value]) => (
                    <div key={key} className="flex gap-2 text-sm">
                      <span className="text-muted-foreground min-w-[140px]">{formatKey(key)}:</span>
                      <span>{renderResponseValue(key, value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Request History in File */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Request History
          </CardTitle>
          <CardDescription>
            All support requests submitted by this student.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  to={`/requests/${req.id}`}
                  className="block border border-border/50 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{req.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{req.description}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <CategoryBadge category={req.category} />
                    <PriorityBadge priority={req.priority} />
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Progress Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Note */}
          <div className="space-y-2">
            <Textarea
              placeholder="Add a progress note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[80px]"
            />
            <Button size="sm" onClick={handleAddNote} disabled={addingNote || !newNote.trim()}>
              {addingNote ? 'Adding...' : 'Add Note'}
            </Button>
          </div>

          {/* Notes Timeline */}
          {notesLoading ? (
            <p className="text-sm text-muted-foreground">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No progress notes yet.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="border-l-2 border-muted pl-3 py-1">
                  <p className="text-sm">{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    {note.note_type !== 'general' && (
                      <Badge variant="outline" className="ml-2 text-xs">{note.note_type}</Badge>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
