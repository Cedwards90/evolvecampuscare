import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useStudentAssignments,
  useUnassignedStudents,
  useRemoveStudentAssignment,
  type StudentAssignment,
  type UnassignedStudent,
} from '@/hooks/useStudentAssignments';
import { StudentAssignmentDialog } from './StudentAssignmentDialog';
import { UserPlus, UserMinus, ArrowRightLeft, Users, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function StudentAssignmentsTable() {
  const { data: assignments, isLoading: assignmentsLoading } = useStudentAssignments();
  const { data: unassignedStudents, isLoading: unassignedLoading } = useUnassignedStudents();
  const removeAssignment = useRemoveStudentAssignment();

  const [selectedStudent, setSelectedStudent] = useState<UnassignedStudent | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [reassignStudent, setReassignStudent] = useState<StudentAssignment | null>(null);
  const [removeConfirmStudent, setRemoveConfirmStudent] = useState<StudentAssignment | null>(null);

  const handleAssignClick = (student: UnassignedStudent) => {
    setSelectedStudent(student);
    setAssignDialogOpen(true);
  };

  const handleReassignClick = (assignment: StudentAssignment) => {
    // Convert to UnassignedStudent format for the dialog
    if (assignment.student) {
      setSelectedStudent({
        user_id: assignment.student_id,
        profile: assignment.student,
        pendingRequests: 0, // Will be fetched by the dialog if needed
      });
      setAssignDialogOpen(true);
    }
  };

  const handleRemoveClick = (assignment: StudentAssignment) => {
    setRemoveConfirmStudent(assignment);
  };

  const confirmRemove = async () => {
    if (removeConfirmStudent) {
      await removeAssignment.mutateAsync(removeConfirmStudent.student_id);
      setRemoveConfirmStudent(null);
    }
  };

  const isLoading = assignmentsLoading || unassignedLoading;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="assigned" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assigned" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assigned ({assignments?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="unassigned" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Unassigned ({unassignedStudents?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assigned" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading assignments...
            </div>
          ) : !assignments || assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No student assignments yet
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Assigned Case Manager</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={assignment.student?.avatar_url || undefined} />
                            <AvatarFallback>
                              {(assignment.student?.full_name || assignment.student?.email || 'S')
                                .substring(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {assignment.student?.full_name || 'Unknown Student'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {assignment.student?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={assignment.case_manager?.avatar_url || undefined} />
                            <AvatarFallback>
                              {(assignment.case_manager?.full_name || assignment.case_manager?.email || 'CM')
                                .substring(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {assignment.case_manager?.full_name || 'Unknown Case Manager'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {assignment.case_manager?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReassignClick(assignment)}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-1" />
                            Reassign
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveClick(assignment)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="unassigned" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading students...
            </div>
          ) : !unassignedStudents || unassignedStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              All students have been assigned to case managers
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Pending Requests</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedStudents.map((student) => (
                    <TableRow key={student.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student.profile.avatar_url || undefined} />
                            <AvatarFallback>
                              {(student.profile.full_name || student.profile.email || 'S')
                                .substring(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {student.profile.full_name || 'Unknown Student'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {student.profile.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.pendingRequests > 0 ? (
                          <Badge variant="secondary">
                            {student.pendingRequests} pending
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAssignClick(student)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <StudentAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        student={selectedStudent}
        onAssigned={() => setSelectedStudent(null)}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog
        open={!!removeConfirmStudent}
        onOpenChange={(open) => !open && setRemoveConfirmStudent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the assignment for{' '}
              <strong>{removeConfirmStudent?.student?.full_name || 'this student'}</strong>?
              <br /><br />
              Their existing requests will remain assigned to the current case manager, but 
              new requests will go to the unassigned queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
