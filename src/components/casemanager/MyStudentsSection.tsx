import { Link } from 'react-router-dom';
import { Users, FileText, Calendar, Clock, ArrowRight, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { InviteStudentDialog } from '@/components/casemanager/InviteStudentDialog';
import type { MyStudent } from '@/hooks/useMyStudents';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';

interface MyStudentsSectionProps {
  students: MyStudent[];
  isLoading: boolean;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function MyStudentsSection({ students: rawStudents, isLoading }: MyStudentsSectionProps) {
  const { filters: f } = useGlobalFilters();
  const students = rawStudents.filter((s) => {
    const p: any = s.student;
    if (f.organizationId.length && (!p?.organization_id || !f.organizationId.includes(p.organization_id))) return false;
    if (f.cohort.length) {
      if (!p?.cohort_id || !f.cohort.includes(p.cohort_id)) return false;
    }
    if (f.yearOfStudy.length && (!p?.year_of_study || !f.yearOfStudy.includes(p.year_of_study))) return false;
    return true;
  });
  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-h3">My Students</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-border/50 animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (students.length === 0) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-h3">My Students</h2>
        </div>
        <EmptyState
          icon={Users}
          title="No students assigned"
          description="You don't have any students assigned to you yet. An administrator will assign students to your caseload."
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-h3">My Students</h2>
          <Badge variant="secondary" className="ml-2">
            {students.length}
          </Badge>
        </div>
        <InviteStudentDialog
          trigger={
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Student
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {students.map((student) => (
          <Card key={student.id} className="border border-border/50 hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.student?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(student.student?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {student.student?.full_name || 'Unknown Student'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {student.student?.email}
                    </CardDescription>
                  </div>
                </div>
                {student.pending_requests > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {student.pending_requests} pending
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{student.total_requests} total requests</span>
                </div>
                {student.last_activity && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatDistanceToNow(new Date(student.last_activity), { addSuffix: true })}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to={`/students/${student.student_id}`}>
                    View Profile
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/requests?studentId=${student.student_id}`}>
                    <FileText className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/messages/${student.student_id}`}>
                    <Calendar className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
