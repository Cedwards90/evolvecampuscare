import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Search, CheckCircle, Clock, Building2, GraduationCap, UserCheck } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStudentFolders } from '@/hooks/useStudentFolders';
import { useAllCohorts } from '@/hooks/useCohorts';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useAuth } from '@/contexts/AuthContext';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function StudentFolders() {
  const { data: students, isLoading } = useStudentFolders();
  const [search, setSearch] = useState('');

  const { filters: gf } = useGlobalFilters();
  const filtered = useMemo(() => (students || []).filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = (s.full_name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchesOrg = gf.organizationId.length === 0 || (s.organization_id && gf.organizationId.includes(s.organization_id));
    const matchesCohort = gf.cohort.length === 0 || (s.cohort_id && gf.cohort.includes(s.cohort_id));
    const matchesCM = gf.assignedCaseManagerId.length === 0 || (s.case_manager_id && gf.assignedCaseManagerId.includes(s.case_manager_id));
    return matchesSearch && matchesOrg && matchesCohort && matchesCM;
  }), [students, search, gf]);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Student Folders"
          description="Browse student files, intake responses, and request history."
        />

        <GlobalFilterBar visible={['organizationId', 'cohort', 'assignedCaseManagerId']} />

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="whitespace-nowrap">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No student folders found"
            description={search ? 'Try adjusting your search.' : 'No students match the current filters.'}
          />
        ) : (
          <>
          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {filtered.map((student) => (
              <Card key={student.user_id} className="border border-border/50 p-4 space-y-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(student.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{student.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                  </div>
                  {student.pending_requests > 0 && (
                    <Badge variant="destructive" className="text-xs shrink-0">
                      {student.pending_requests} pending
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {student.cohort_name && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <GraduationCap className="h-3 w-3" />
                      {student.cohort_name}
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1 text-xs">
                    <UserCheck className="h-3 w-3" />
                    {student.case_manager_name || 'Unassigned'}
                  </Badge>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={`/students/${student.user_id}`}>Open folder</Link>
                </Button>
              </Card>
            ))}
          </div>

          <div className="hidden sm:block">

          <Card className="border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Case Manager</TableHead>
                  <TableHead>Intake</TableHead>
                  <TableHead>Graduation</TableHead>
                  <TableHead className="text-center">Requests</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => (
                  <TableRow key={student.user_id} className="cursor-pointer">
                    <TableCell>
                      <Link to={`/students/${student.user_id}`} className="flex items-center gap-3 hover:underline">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(student.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{student.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {student.organization_name ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Building2 className="h-3 w-3" />
                          {student.organization_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.cohort_name ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <GraduationCap className="h-3 w-3" />
                          {student.cohort_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {student.case_manager_name || <span className="text-muted-foreground text-xs">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      {student.intake_completed ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.graduation_date
                        ? format(new Date(student.graduation_date), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {student.total_requests}
                    </TableCell>
                    <TableCell className="text-center">
                      {student.pending_requests > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          {student.pending_requests}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.last_activity
                        ? formatDistanceToNow(new Date(student.last_activity), { addSuffix: true })
                        : 'No activity'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
