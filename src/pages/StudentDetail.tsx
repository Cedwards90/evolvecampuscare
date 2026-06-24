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
  ClipboardCheck,
} from 'lucide-react';
import { StickyNote, PenLine, Building2, NotebookPen, Trash2, X, Save, Brain } from 'lucide-react';
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
import { SurveysSummaryCard } from '@/components/students/SurveysSummaryCard';
import { useFileNotes } from '@/hooks/useFileNotes';
import { useStudentCheckIns } from '@/hooks/useStudentCheckIns';
import { useOrgName } from '@/hooks/useOrgName';
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
import { StudentResourcesPanel } from '@/components/resources/StudentResourcesPanel';
import { ArrowRightLeft, Users as UsersIcon } from 'lucide-react';
import { useOrgCohorts, useAssignStudentCohort } from '@/hooks/useCohorts';
import { useMyOrgAdminOrgs } from '@/hooks/useOrgAdmins';
import { PersonalityCard } from '@/components/students/PersonalityCard';
import { CareerIntakeCard } from '@/components/students/CareerIntakeCard';
import { CMF_NEEDS, CMF_CONTACT_TYPES, needLabel } from '@/lib/cmfNeeds';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [activeTab, setActiveTab] = useState('requests');

  const isStaff = role === 'admin' || role === 'case_manager';

  const studentOrgId = (student?.profile as any)?.organization_id as string | null | undefined;
  const studentCohortId = (student?.profile as any)?.cohort_id as string | null | undefined;
  const { data: myOrgAdminOrgs } = useMyOrgAdminOrgs();
  const canManageCohort =
    role === 'admin' ||
    (role === 'org_admin' && !!studentOrgId && (myOrgAdminOrgs ?? []).includes(studentOrgId));
  const { data: orgCohorts } = useOrgCohorts(canManageCohort ? studentOrgId : null);
  const assignCohort = useAssignStudentCohort();
  const currentCohort = (orgCohorts || []).find((c) => c.id === studentCohortId);

  const handleCohortChange = async (value: string) => {
    if (!id) return;
    try {
      await assignCohort.mutateAsync({
        studentId: id,
        cohortId: value === 'none' ? null : value,
      });
      toast({ title: 'Cohort updated' });
    } catch (e: any) {
      toast({ title: 'Failed to update cohort', description: e?.message, variant: 'destructive' });
    }
  };


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

                {/* Cohort */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UsersIcon className="h-4 w-4" />
                    <span>Cohort:</span>
                  </div>
                  {canManageCohort && studentOrgId ? (
                    <Select
                      value={studentCohortId ?? 'none'}
                      onValueChange={handleCohortChange}
                      disabled={assignCohort.isPending}
                    >
                      <SelectTrigger className="h-8 w-[240px] rounded-full">
                        <SelectValue placeholder="Assign cohort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No cohort</SelectItem>
                        {(orgCohorts || []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{currentCohort?.name || 'Not assigned'}</Badge>
                  )}
                  {canManageCohort && !studentOrgId && (
                    <span className="text-xs text-muted-foreground">Assign an organization first.</span>
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
                  {role === 'admin' ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/admin/students/${id}/submissions`}>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Manage Submissions
                      </Link>
                    </Button>
                  ) : (role === 'case_manager' || role === 'org_admin') ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/students/${id}/submissions`}>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        View Submissions
                      </Link>
                    </Button>
                  ) : null}
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

        <SurveysSummaryCard studentId={id!} />

        <GenerateStudentReportCard studentId={id} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {(() => {
            const tabOptions = [
              { value: 'requests', label: `Requests (${student.requests.length})` },
              { value: 'appointments', label: `Appointments (${student.appointments.length})` },
              { value: 'activity', label: 'Activity' },
              { value: 'file', label: 'Student File' },
              { value: 'case-notes', label: 'Case Notes' },
              { value: 'checkins', label: 'Check-Ins' },
              { value: 'grad-plan', label: 'Post-Grad Plan' },
              { value: 'certifications', label: 'Certifications' },
              { value: 'resources', label: 'Resources' },
              { value: 'profile', label: 'Profile & Intake' },
            ];
            return (
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {tabOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })()}


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
            <StudentCheckInsTab
              studentId={id!}
              studentName={student.profile?.full_name || null}
              orgId={student.profile?.organization_id || null}
            />
          </TabsContent>

          {/* Post-Graduation Plan Tab */}
          <TabsContent value="grad-plan" className="space-y-4">
            <PostGradPlanTab
              studentId={id!}
              studentName={student.profile?.full_name || null}
              orgId={student.profile?.organization_id || null}
            />
          </TabsContent>


          {/* Certifications Tab */}
          <TabsContent value="certifications" className="space-y-4">
            <CertificationsSection studentId={id!} canManage={role !== 'student'} />
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            <StudentResourcesPanel studentId={id!} />
          </TabsContent>



          {/* Profile & Intake Tab */}
          <TabsContent value="profile" className="space-y-4">
            <PersonalityCard studentId={id!} canEdit={isStaff} />
            <CareerIntakeCard studentId={id!} canEdit={isStaff} />
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


function StudentCaseNotesTab({ studentId }: { studentId: string }) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { notes, isLoading, addNote, updateNote, deleteNote } = useFileNotes(studentId);

  const blank = {
    content: '',
    title: '',
    noteType: 'case_note',
    contactDate: format(new Date(), 'yyyy-MM-dd'),
    contactType: '' as string,
    durationMinutes: '' as string,
    identifiedNeeds: [] as number[],
    referralAgency: '',
    referralContact: '',
    nextSteps: '',
  };
  const [form, setForm] = useState(blank);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleNeed = (code: number) => {
    setForm((f) => ({
      ...f,
      identifiedNeeds: f.identifiedNeeds.includes(code)
        ? f.identifiedNeeds.filter((n) => n !== code)
        : [...f.identifiedNeeds, code].sort((a, b) => a - b),
    }));
  };

  const payloadFromForm = () => ({
    content: form.content.trim(),
    noteType: form.noteType,
    title: form.title,
    contactDate: form.contactDate || null,
    contactType: form.contactType || null,
    durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes, 10) : null,
    identifiedNeeds: form.identifiedNeeds,
    referralAgency: form.referralAgency,
    referralContact: form.referralContact,
    nextSteps: form.nextSteps,
  });

  const handleSubmit = async () => {
    if (!form.content.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateNote.mutateAsync({ id: editingId, ...payloadFromForm() });
        toast({ title: 'Note updated' });
      } else {
        await addNote.mutateAsync(payloadFromForm());
        toast({ title: 'Note added' });
      }
      setForm(blank);
      setEditingId(null);
    } catch (err: any) {
      toast({ title: 'Could not save note', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (note: any) => {
    setEditingId(note.id);
    setForm({
      content: note.content,
      title: note.title || '',
      noteType: note.note_type || 'case_note',
      contactDate: note.contact_date || format(new Date(note.created_at), 'yyyy-MM-dd'),
      contactType: note.contact_type || '',
      durationMinutes: note.duration_minutes != null ? String(note.duration_minutes) : '',
      identifiedNeeds: note.identified_needs || [],
      referralAgency: note.referral_agency || '',
      referralContact: note.referral_contact || '',
      nextSteps: note.next_steps || '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(blank);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote.mutateAsync(id);
      toast({ title: 'Note deleted' });
    } catch (err: any) {
      toast({ title: 'Could not delete note', description: err.message, variant: 'destructive' });
    }
  };

  const canModify = (note: any) => role === 'admin' || note.author_id === user?.id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <NotebookPen className="h-4 w-4" />
            {editingId ? 'Edit Case Note' : 'Add Case Note'}
          </CardTitle>
          <CardDescription>
            CMF-aligned: capture contact details, identified needs, and any referrals. Visible to admins and the assigned case manager only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date of Contact</Label>
              <Input type="date" value={form.contactDate} onChange={(e) => setForm({ ...form, contactDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type of Contact</Label>
              <Select value={form.contactType} onValueChange={(v) => setForm({ ...form, contactType: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CMF_CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duration (min)</Label>
              <Input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="e.g. 30" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Title <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short summary..." maxLength={120} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Contact Notes / Next Steps</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Describe the focus of contact, decisions, action items, and any assignments..."
              className="min-h-[120px]"
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{form.content.length}/5000</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Identified Needs</Label>
            <div className="border border-border/60 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
              {CMF_NEEDS.map((n) => (
                <label key={n.code} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={form.identifiedNeeds.includes(n.code)}
                    onCheckedChange={() => toggleNeed(n.code)}
                  />
                  <span><span className="font-medium">{n.code}.</span> {n.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Referral Agency / Service</Label>
              <Input value={form.referralAgency} onChange={(e) => setForm({ ...form, referralAgency: e.target.value })} placeholder="Agency name & contact info" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Referral Contact Person</Label>
              <Input value={form.referralContact} onChange={(e) => setForm({ ...form, referralContact: e.target.value })} placeholder="Name / email / phone" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Next Steps <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={form.nextSteps} onChange={(e) => setForm({ ...form, nextSteps: e.target.value })} className="min-h-[60px]" maxLength={2000} placeholder="What's the plan after this contact?" />
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <Button variant="outline" onClick={cancelEdit} className="rounded-full">Cancel</Button>
            )}
            <Button onClick={handleSubmit} disabled={submitting || !form.content.trim()} className="rounded-full">
              {submitting ? 'Saving...' : editingId ? 'Update Note' : 'Save Note'}
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
              {notes.map((note: any) => (
                <div key={note.id} className="border border-border/60 rounded-lg p-4 space-y-2 bg-card">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-xs">
                      {note.contact_date && (
                        <Badge variant="secondary">{format(new Date(note.contact_date), 'MMM d, yyyy')}</Badge>
                      )}
                      {note.contact_type && <Badge variant="outline">{note.contact_type}</Badge>}
                      {note.duration_minutes != null && <Badge variant="outline">{note.duration_minutes} min</Badge>}
                      {note.title && <span className="font-medium text-sm">— {note.title}</span>}
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
                  {note.next_steps && (
                    <div className="text-xs">
                      <span className="font-medium">Next steps: </span>
                      <span className="whitespace-pre-wrap">{note.next_steps}</span>
                    </div>
                  )}
                  {(note.identified_needs?.length > 0 || note.referral_agency) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {note.identified_needs?.map((c: number) => (
                        <Badge key={c} variant="secondary" className="text-[10px]">#{c} {needLabel(c)}</Badge>
                      ))}
                      {note.referral_agency && (
                        <Badge variant="outline" className="text-[10px]">
                          Referral: {note.referral_agency}{note.referral_contact ? ` (${note.referral_contact})` : ''}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <span className="font-medium">{note.author_name}</span>
                    <span>•</span>
                    <span>logged {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
                    {note.updated_at && note.updated_at !== note.created_at && (
                      <>
                        <span>•</span>
                        <span className="italic">edited {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Check-Ins Tab Component ----
function StudentCheckInsTab({ studentId, studentName, orgId }: { studentId: string; studentName?: string | null; orgId?: string | null }) {
  const { data: checkIns = [], isLoading } = useStudentCheckIns(studentId);
  const orgName = useOrgName(orgId);


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
          onClick={() => downloadCheckInsPdf(checkIns, studentName, orgName)}
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
                  onClick={() => downloadCheckInPdf(checkIn, studentName, orgName)}
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

function PostGradPlanTab({ studentId, studentName, orgId }: { studentId: string; studentName?: string | null; orgId?: string | null }) {
  const { data: plans = [], isLoading } = useStudentPlans(studentId);
  const orgName = useOrgName(orgId);

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
                  onClick={() => downloadPlanPdf(plan as any, studentName, orgName)}
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
