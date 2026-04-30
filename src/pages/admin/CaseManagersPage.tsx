import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Users,
  AlertTriangle,
  ExternalLink,
  ArrowRightLeft,
  UserCog,
  FileText,
  Mail,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useCaseManagers } from '@/hooks/useCaseManagerStats';
import { useStudentAssignments } from '@/hooks/useStudentAssignments';
import { useRequests } from '@/hooks/useRequests';
import { ReassignStudentDialog } from '@/components/admin/ReassignStudentDialog';

type WorkloadFilter = 'all' | 'available' | 'balanced' | 'overloaded';
type StudentStatusFilter = 'all' | 'active' | 'inactive' | 'has_pending';

const OVERLOAD_THRESHOLD = 15; // students considered an overload
const AVAILABLE_THRESHOLD = 5;

function getInitials(name?: string | null, email?: string | null) {
  const src = name || email || '?';
  return src
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function CaseManagersPage() {
  const { data: caseManagers, isLoading: loadingCMs } = useCaseManagers();
  const { data: assignments, isLoading: loadingAssignments } = useStudentAssignments();
  const { data: allRequests } = useRequests();

  const [cmSearch, setCmSearch] = useState('');
  const [workloadFilter, setWorkloadFilter] = useState<WorkloadFilter>('all');
  const [selectedCmId, setSelectedCmId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentStatusFilter>('all');

  const [reassignTarget, setReassignTarget] = useState<{
    studentId: string;
    studentName: string;
    fromCaseManagerId: string;
    fromCaseManagerName: string;
  } | null>(null);

  // Filter case managers
  const filteredCMs = useMemo(() => {
    if (!caseManagers) return [];
    const q = cmSearch.trim().toLowerCase();
    return caseManagers
      .filter((cm) => {
        if (q) {
          const name = (cm.full_name || '').toLowerCase();
          const email = (cm.email || '').toLowerCase();
          if (!name.includes(q) && !email.includes(q)) return false;
        }
        const count = cm.assigned_students;
        if (workloadFilter === 'overloaded' && count < OVERLOAD_THRESHOLD) return false;
        if (workloadFilter === 'available' && count > AVAILABLE_THRESHOLD) return false;
        if (
          workloadFilter === 'balanced' &&
          (count < AVAILABLE_THRESHOLD || count >= OVERLOAD_THRESHOLD)
        )
          return false;
        return true;
      })
      .sort((a, b) => b.assigned_students - a.assigned_students);
  }, [caseManagers, cmSearch, workloadFilter]);

  // Auto-select first CM
  const effectiveSelectedId =
    selectedCmId && filteredCMs.some((c) => c.user_id === selectedCmId)
      ? selectedCmId
      : filteredCMs[0]?.user_id || null;

  const selectedCM = filteredCMs.find((c) => c.user_id === effectiveSelectedId) || null;

  // Build students for selected CM
  const studentsForSelected = useMemo(() => {
    if (!selectedCM || !assignments) return [];
    const cmAssignments = assignments.filter(
      (a) => a.case_manager_id === selectedCM.user_id
    );
    const requestsByStudent = new Map<
      string,
      { pending: number; total: number; lastActivity: string | null }
    >();
    (allRequests || []).forEach((r) => {
      const cur = requestsByStudent.get(r.student_id) || {
        pending: 0,
        total: 0,
        lastActivity: null as string | null,
      };
      cur.total += 1;
      if (r.status !== 'resolved' && r.status !== 'cancelled') cur.pending += 1;
      const updated = r.updated_at || r.created_at;
      if (!cur.lastActivity || updated > cur.lastActivity) cur.lastActivity = updated;
      requestsByStudent.set(r.student_id, cur);
    });

    return cmAssignments.map((a) => {
      const stats = requestsByStudent.get(a.student_id) || {
        pending: 0,
        total: 0,
        lastActivity: null,
      };
      const lastActivity = stats.lastActivity || a.updated_at || a.created_at;
      const ageMs = Date.now() - new Date(lastActivity).getTime();
      const isInactive = ageMs > 1000 * 60 * 60 * 24 * 30; // 30 days
      return {
        assignmentId: a.id,
        studentId: a.student_id,
        student: a.student,
        pendingRequests: stats.pending,
        totalRequests: stats.total,
        lastActivity,
        isInactive,
      };
    });
  }, [selectedCM, assignments, allRequests]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return studentsForSelected.filter((s) => {
      if (q) {
        const name = (s.student?.full_name || '').toLowerCase();
        const email = (s.student?.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      if (studentFilter === 'active' && s.isInactive) return false;
      if (studentFilter === 'inactive' && !s.isInactive) return false;
      if (studentFilter === 'has_pending' && s.pendingRequests === 0) return false;
      return true;
    });
  }, [studentsForSelected, studentSearch, studentFilter]);

  const isLoading = loadingCMs || loadingAssignments;

  return (
    <SidebarLayout>
      <div className="w-full max-w-full space-y-6">
        <PageHeader
          title="Case Managers"
          description="Monitor case manager workloads and reassign students between case managers."
        />

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : !caseManagers || caseManagers.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No case managers yet"
            description="Invite case managers from User Management to start assigning students."
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            {/* Left: CM list */}
            <Card className="h-fit">
              <CardHeader className="space-y-3">
                <CardTitle className="text-base">All Case Managers</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    value={cmSearch}
                    onChange={(e) => setCmSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={workloadFilter}
                  onValueChange={(v) => setWorkloadFilter(v as WorkloadFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All workloads</SelectItem>
                    <SelectItem value="available">
                      Available (≤ {AVAILABLE_THRESHOLD})
                    </SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="overloaded">
                      Overloaded (≥ {OVERLOAD_THRESHOLD})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
                {filteredCMs.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No case managers match your filters.
                  </p>
                )}
                {filteredCMs.map((cm) => {
                  const isSelected = cm.user_id === effectiveSelectedId;
                  const overloaded = cm.assigned_students >= OVERLOAD_THRESHOLD;
                  const pct = Math.min(
                    100,
                    Math.round((cm.assigned_students / OVERLOAD_THRESHOLD) * 100)
                  );
                  return (
                    <button
                      key={cm.user_id}
                      onClick={() => setSelectedCmId(cm.user_id)}
                      className={cn(
                        'w-full rounded-xl border p-3 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={cm.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(cm.full_name, cm.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {cm.full_name || cm.email}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {cm.email}
                          </p>
                        </div>
                        {overloaded && (
                          <Badge variant="destructive" className="shrink-0">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            High
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {cm.assigned_students} students • {cm.active_requests} active
                          </span>
                          {cm.emergency_requests > 0 && (
                            <span className="text-destructive font-medium">
                              {cm.emergency_requests} emergency
                            </span>
                          )}
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Right: detail */}
            <Card className="min-w-0 overflow-hidden">
              {!selectedCM ? (
                <CardContent className="py-16">
                  <EmptyState
                    icon={Users}
                    title="Select a case manager"
                    description="Pick a case manager from the list to see their assigned students."
                  />
                </CardContent>
              ) : (
                <>
                  <CardHeader className="space-y-4 border-b">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={selectedCM.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(selectedCM.full_name, selectedCM.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-lg">
                            {selectedCM.full_name || selectedCM.email}
                          </CardTitle>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{selectedCM.email}</span>
                          </p>
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <Link to={`/case-managers/${selectedCM.user_id}`}>
                          View profile
                          <ExternalLink className="ml-2 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <StatTile label="Students" value={selectedCM.assigned_students} />
                      <StatTile label="Active" value={selectedCM.active_requests} />
                      <StatTile
                        label="Emergency"
                        value={selectedCM.emergency_requests}
                        tone={selectedCM.emergency_requests > 0 ? 'danger' : 'default'}
                      />
                      <StatTile
                        label="Workload"
                        value={
                          selectedCM.assigned_students >= OVERLOAD_THRESHOLD
                            ? 'High'
                            : selectedCM.assigned_students >= AVAILABLE_THRESHOLD
                            ? 'Balanced'
                            : 'Available'
                        }
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search students…"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select
                        value={studentFilter}
                        onValueChange={(v) => setStudentFilter(v as StudentStatusFilter)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All students</SelectItem>
                          <SelectItem value="active">Active (last 30d)</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="has_pending">Has pending requests</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {filteredStudents.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="No students match"
                        description={
                          studentsForSelected.length === 0
                            ? 'This case manager has no assigned students yet.'
                            : 'Try adjusting your search or filters.'
                        }
                      />
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <Table className="min-w-[640px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-center">Requests</TableHead>
                              <TableHead className="whitespace-nowrap">Last activity</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((s) => (
                              <TableRow key={s.assignmentId}>
                                <TableCell>
                                  <Link
                                    to={`/students/${s.studentId}`}
                                    className="flex items-center gap-3 hover:underline"
                                  >
                                    <Avatar className="h-8 w-8 shrink-0">
                                      <AvatarImage src={s.student?.avatar_url || undefined} />
                                      <AvatarFallback className="text-xs">
                                        {getInitials(
                                          s.student?.full_name,
                                          s.student?.email
                                        )}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {s.student?.full_name || 'Unknown'}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {s.student?.email}
                                      </p>
                                    </div>
                                  </Link>
                                </TableCell>
                                <TableCell>
                                  {s.isInactive ? (
                                    <Badge variant="outline">Inactive</Badge>
                                  ) : (
                                    <Badge variant="secondary">Active</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm">{s.totalRequests}</span>
                                    {s.pendingRequests > 0 && (
                                      <Badge variant="destructive" className="text-xs">
                                        {s.pendingRequests}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                  {formatDistanceToNowStrict(new Date(s.lastActivity), {
                                    addSuffix: true,
                                  })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    title="Reassign student"
                                    onClick={() =>
                                      setReassignTarget({
                                        studentId: s.studentId,
                                        studentName:
                                          s.student?.full_name ||
                                          s.student?.email ||
                                          'student',
                                        fromCaseManagerId: selectedCM.user_id,
                                        fromCaseManagerName:
                                          selectedCM.full_name ||
                                          selectedCM.email ||
                                          'current case manager',
                                      })
                                    }
                                  >
                                    <ArrowRightLeft className="h-3.5 w-3.5 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Reassign</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        )}
      </div>

      {reassignTarget && (
        <ReassignStudentDialog
          open={!!reassignTarget}
          onOpenChange={(open) => !open && setReassignTarget(null)}
          studentId={reassignTarget.studentId}
          studentName={reassignTarget.studentName}
          fromCaseManagerId={reassignTarget.fromCaseManagerId}
          fromCaseManagerName={reassignTarget.fromCaseManagerName}
        />
      )}
    </SidebarLayout>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          'mt-1 text-base font-semibold truncate',
          tone === 'danger' && 'text-destructive'
        )}
      >
        {value}
      </p>
    </div>
  );
}
