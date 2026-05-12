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
  User,
  GraduationCap,
  CalendarDays,
  Briefcase,
  Pencil,
  Download,
  Award,
} from 'lucide-react';
import { StickyNote, PenLine, Building2, NotebookPen, Trash2, X, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, formatDistanceToNow } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { PageNav } from '@/components/navigation/PageNav';
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
import { GenerateStudentReportCard } from '@/components/reports/GenerateStudentReportCard';
import { useFileNotes } from '@/hooks/useFileNotes';
import { useStudentCheckIns } from '@/hooks/useStudentCheckIns';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrgBadgeInline } from '@/components/OrgBadgeInline';
import { useStudentPlans } from '@/hooks/usePostGraduationPlan';
import { Smile, Frown, Meh, TrendingUp as TrendUp, TrendingDown } from 'lucide-react';
import { downloadCheckInPdf, downloadCheckInsPdf, downloadPlanPdf } from '@/lib/wellbeingExport';
import { SendSurveyDialog } from '@/components/admin/SendSurveyDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CertificationsSection } from '@/components/certifications/CertificationsSection';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: student, isLoading, error } = useStudentDetail(id);
  const { toast } = useToast();
  const { role } = useAuth();
  const [editDatesOpen, setEditDatesOpen] = useState(false);
  const [cohortStart, setCohortStart] = useState<Date | undefined>();
  const [gradDate, setGradDate] = useState<Date | undefined>();
  const [placementDate, setPlacementDate] = useState<Date | undefined>();
  const [savingDates, setSavingDates] = useState(false);

  const isStaff = role === 'admin' || role === 'case_manager';

  const openEditDates = () => {
    const p = student?.profile as any;
    setCohortStart(p?.cohort_start_date ? new Date(p.cohort_start_date) : undefined);
    setGradDate(p?.graduation_date ? new Date(p.graduation_date) : undefined);
    setPlacementDate(p?.placement_date ? new Date(p.placement_date) : undefined);
    setEditDatesOpen(true);
  };

  const saveDates = async () => {
    if (!id) return;
    setSavingDates(true);
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          cohort_start_date: cohortStart ? cohortStart.toISOString().split('T')[0] : null,
          graduation_date: gradDate ? gradDate.toISOString().split('T')[0] : null,
          placement_date: placementDate ? placementDate.toISOString().split('T')[0] : null,
        } as any)
        .eq('user_id', id);
      if (err) throw err;
      toast({ title: 'Dates updated successfully' });
      setEditDatesOpen(false);
      // Refetch will happen via react-query invalidation
      window.location.reload();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save dates', variant: 'destructive' });
    } finally {
      setSavingDates(false);
    }
  };

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
      <PageNav
        fallback="/student-folders"
        crumbs={[
          { label: 'Students', to: '/student-folders' },
          { label: student.profile?.full_name || 'Student' },
        ]}
      />
      <div className="space-y-6">

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

                {/* Milestone Dates */}
                <div className="flex flex-wrap gap-4 text-sm">
                  {(student.profile as any)?.cohort_start_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      <span>Cohort Start: {format(new Date((student.profile as any).cohort_start_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {(student.profile as any)?.graduation_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                      <span>Graduation: {format(new Date((student.profile as any).graduation_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {(student.profile as any)?.placement_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      <span>Placement: {format(new Date((student.profile as any).placement_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {isStaff && (
                    <Button variant="ghost" size="sm" onClick={openEditDates} className="h-6 px-2 text-xs">
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit Dates
                    </Button>
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
                  <SendSurveyDialog
                    studentId={id!}
                    studentName={student.profile?.full_name || 'Student'}
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

        <div className="grid gap-4 md:grid-cols-2">
          <GenerateStudentReportCard studentId={id} />
          <FolderSummaryButton
            studentId={id!}
            studentName={student.profile?.full_name || student.profile?.email || 'Student'}
          />
        </div>

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
            <TabsTrigger value="case-notes" className="gap-2">
              <NotebookPen className="h-4 w-4" />
              Case Notes
            </TabsTrigger>
            <TabsTrigger value="checkins" className="gap-2">
              <Smile className="h-4 w-4" />
              Check-Ins
            </TabsTrigger>
            <TabsTrigger value="grad-plan" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              Post-Grad Plan
            </TabsTrigger>
            <TabsTrigger value="certifications" className="gap-2">
              <Award className="h-4 w-4" />
              Certifications
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

          {/* Case Notes Tab */}
          <TabsContent value="case-notes" className="space-y-4">
            <StudentCaseNotesTab studentId={id!} />
          </TabsContent>

          {/* Check-Ins Tab */}
          <TabsContent value="checkins" className="space-y-4">
            <StudentCheckInsTab studentId={id!} studentName={student.profile?.full_name || null} />
          </TabsContent>

          {/* Post-Graduation Plan Tab */}
          <TabsContent value="grad-plan" className="space-y-4">
            <PostGradPlanTab studentId={id!} studentName={student.profile?.full_name || null} />
          </TabsContent>

          {/* Certifications Tab */}
          <TabsContent value="certifications" className="space-y-4">
            <CertificationsSection studentId={id!} canManage={role !== 'student'} />
          </TabsContent>
        </Tabs>

        {/* Edit Dates Dialog */}
        <Dialog open={editDatesOpen} onOpenChange={setEditDatesOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Milestone Dates</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Cohort Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !cohortStart && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {cohortStart ? format(cohortStart, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker mode="single" selected={cohortStart} onSelect={setCohortStart} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Graduation Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !gradDate && "text-muted-foreground")}>
                      <GraduationCap className="mr-2 h-4 w-4" />
                      {gradDate ? format(gradDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker mode="single" selected={gradDate} onSelect={setGradDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Placement Date (Job Secured)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !placementDate && "text-muted-foreground")}>
                      <Briefcase className="mr-2 h-4 w-4" />
                      {placementDate ? format(placementDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker mode="single" selected={placementDate} onSelect={setPlacementDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDatesOpen(false)}>Cancel</Button>
              <Button onClick={saveDates} disabled={savingDates}>
                {savingDates ? 'Saving...' : 'Save Dates'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarLayout>
  );
}

// ---- Student File Tab Component ----
function StudentFileTab({ studentId, requests }: { studentId: string; requests: import('@/types/database').SupportRequest[] }) {
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

      {/* Case notes are managed in the dedicated Case Notes tab */}
    </div>
  );
}

// ---- Case Notes Tab Component ----
const NOTE_TYPES: { value: string; label: string }[] = [
  { value: 'case_note', label: 'Case Note' },
  { value: 'general', label: 'General' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'follow_up', label: 'Follow-up' },
];

function StudentCaseNotesTab({ studentId }: { studentId: string }) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { notes, isLoading, addNote, updateNote, deleteNote } = useFileNotes(studentId);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [noteType, setNoteType] = useState('case_note');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('case_note');

  const handleAdd = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await addNote.mutateAsync({ content: content.trim(), noteType, title });
      setContent('');
      setTitle('');
      setNoteType('case_note');
      toast({ title: 'Note added' });
    } catch (err: any) {
      toast({ title: 'Could not add note', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (note: any) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditTitle(note.title || '');
    setEditType(note.note_type || 'case_note');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditTitle('');
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      await updateNote.mutateAsync({ id, content: editContent.trim(), noteType: editType, title: editTitle });
      cancelEdit();
      toast({ title: 'Note updated' });
    } catch (err: any) {
      toast({ title: 'Could not update note', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote.mutateAsync(id);
      toast({ title: 'Note deleted' });
    } catch (err: any) {
      toast({ title: 'Could not delete note', description: err.message, variant: 'destructive' });
    }
  };

  const canModify = (note: any) =>
    role === 'admin' || (note.author_id === user?.id);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <NotebookPen className="h-4 w-4" />
            Add Case Note
          </CardTitle>
          <CardDescription>
            Notes are visible to admins and the assigned case manager only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-[180px_1fr] gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary..." maxLength={120} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Document the conversation, decisions, action items, or context..."
              className="min-h-[140px]"
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{content.length}/5000</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={submitting || !content.trim()} className="rounded-full">
              {submitting ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Case Note History</CardTitle>
          <CardDescription>{notes.length} note{notes.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : notes.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No case notes yet"
              description="Add the first note to start documenting this student's case."
            />
          ) : (
            <div className="space-y-3">
              {notes.map((note: any) => {
                const isEditing = editingId === note.id;
                const typeLabel = NOTE_TYPES.find((t) => t.value === note.note_type)?.label || note.note_type;
                return (
                  <div key={note.id} className="border border-border/60 rounded-lg p-4 space-y-2 bg-card">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid sm:grid-cols-[180px_1fr] gap-2">
                          <Select value={editType} onValueChange={setEditType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {NOTE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} />
                        </div>
                        <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[120px]" maxLength={5000} />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="rounded-full">
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleUpdate(note.id)} disabled={!editContent.trim()} className="rounded-full">
                            <Save className="h-3 w-3 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
                              {note.title && <p className="font-medium text-sm">{note.title}</p>}
                            </div>
                          </div>
                          {canModify(note) && (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => startEdit(note)} className="h-7 w-7 p-0">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this case note?</AlertDialogTitle>
                                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(note.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          <span className="font-medium">{note.author_name}</span>
                          <span>•</span>
                          <span>{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
                          {note.updated_at && note.updated_at !== note.created_at && (
                            <>
                              <span>•</span>
                              <span className="italic">edited {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Check-Ins Tab Component ----
function StudentCheckInsTab({ studentId, studentName }: { studentId: string; studentName?: string | null }) {
  const { data: checkIns = [], isLoading } = useStudentCheckIns(studentId);

  const moodEmojis = ['😔', '😕', '😐', '🙂', '😊'];
  const progressLabels = ['Struggling', 'Behind', 'On Track', 'Progressing', 'Thriving'];

  if (isLoading) return <LoadingSpinner />;

  if (checkIns.length === 0) {
    return (
      <EmptyState
        icon={Smile}
        title="No check-ins yet"
        description="This student hasn't completed any check-ins."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => downloadCheckInsPdf(checkIns, studentName)}
        >
          <Download className="mr-2 h-4 w-4" /> Download all (PDF)
        </Button>
      </div>
      {checkIns.map((checkIn) => (
        <Card key={checkIn.id} className="border border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">
                {format(new Date(checkIn.created_at), 'PPP')}
              </CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <span title="Mood">
                  {moodEmojis[checkIn.mood_rating - 1]} Mood: {checkIn.mood_rating}/5
                </span>
                <span title="Progress" className="text-muted-foreground">
                  📈 {progressLabels[checkIn.progress_rating - 1]}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8"
                  onClick={() => downloadCheckInPdf(checkIn, studentName)}
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {checkIn.wins && (
              <div>
                <p className="text-xs font-medium text-success">What's going well</p>
                <p className="text-sm">{checkIn.wins}</p>
              </div>
            )}
            {checkIn.blockers && (
              <div>
                <p className="text-xs font-medium text-destructive">Blockers</p>
                <p className="text-sm">{checkIn.blockers}</p>
              </div>
            )}
            {checkIn.additional_notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Additional notes</p>
                <p className="text-sm">{checkIn.additional_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PostGradPlanTab({ studentId, studentName }: { studentId: string; studentName?: string | null }) {
  const { data: plans = [], isLoading } = useStudentPlans(studentId);

  if (isLoading) return <LoadingSpinner />;

  if (plans.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No post-graduation plan yet"
        description="This student hasn't submitted a 12-month post-graduation plan."
      />
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <Card key={plan.id} className="border border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">
                Plan submitted {format(new Date(plan.created_at), 'PPP')}
              </CardTitle>
              <div className="flex items-center gap-2">
                {plan.graduation_date && (
                  <Badge variant="outline">
                    Graduation: {format(new Date(plan.graduation_date), 'MMM yyyy')}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => downloadPlanPdf(plan as any, studentName)}
                >
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {plan.career_goals && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Career Goals</p>
                  <p className="text-sm">{plan.career_goals}</p>
                </div>
              )}
              {plan.education_goals && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Education Goals</p>
                  <p className="text-sm">{plan.education_goals}</p>
                </div>
              )}
              {plan.housing_plan && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Housing Plan</p>
                  <p className="text-sm">{plan.housing_plan}</p>
                </div>
              )}
              {plan.financial_plan && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Financial Plan</p>
                  <p className="text-sm">{plan.financial_plan}</p>
                </div>
              )}
              {plan.health_wellness && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Health & Wellness</p>
                  <p className="text-sm">{plan.health_wellness}</p>
                </div>
              )}
              {plan.support_needed && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Support Needed</p>
                  <p className="text-sm">{plan.support_needed}</p>
                </div>
              )}
            </div>
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Quarterly Milestones</p>
              <div className="grid gap-3 md:grid-cols-2">
                {plan.month_1_3_actions && (
                  <div>
                    <p className="text-xs font-medium text-primary">Months 1–3</p>
                    <p className="text-sm">{plan.month_1_3_actions}</p>
                  </div>
                )}
                {plan.month_4_6_actions && (
                  <div>
                    <p className="text-xs font-medium text-primary">Months 4–6</p>
                    <p className="text-sm">{plan.month_4_6_actions}</p>
                  </div>
                )}
                {plan.month_7_9_actions && (
                  <div>
                    <p className="text-xs font-medium text-primary">Months 7–9</p>
                    <p className="text-sm">{plan.month_7_9_actions}</p>
                  </div>
                )}
                {plan.month_10_12_actions && (
                  <div>
                    <p className="text-xs font-medium text-primary">Months 10–12</p>
                    <p className="text-sm">{plan.month_10_12_actions}</p>
                  </div>
                )}
              </div>
            </div>
            {plan.additional_notes && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Additional Notes</p>
                <p className="text-sm">{plan.additional_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
