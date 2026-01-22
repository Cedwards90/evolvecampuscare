import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, RefreshCw, Trash2, Users } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useStudentAssignments,
  useUnassignedStudents,
  useRemoveStudentAssignment,
  type StudentAssignment,
  type UnassignedStudent,
} from '@/hooks/useStudentAssignments';
import { StudentAssignmentDialog } from './StudentAssignmentDialog';
import { BulkStudentAssignmentDialog } from './BulkStudentAssignmentDialog';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function StudentAssignmentsTable() {
  const { data: assignments, isLoading: assignmentsLoading } = useStudentAssignments();
  const { data: unassignedStudents, isLoading: unassignedLoading } = useUnassignedStudents();
  const removeAssignment = useRemoveStudentAssignment();

  const [selectedStudent, setSelectedStudent] = useState<UnassignedStudent | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [removeConfirmStudent, setRemoveConfirmStudent] = useState<StudentAssignment | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);

  const handleAssignClick = (student: UnassignedStudent) => {
    setSelectedStudent(student);
    setAssignDialogOpen(true);
  };

  const handleReassignClick = (assignment: StudentAssignment) => {
    setSelectedStudent({
      user_id: assignment.student_id,
      profile: assignment.student!,
      pendingRequests: 0,
    });
    setAssignDialogOpen(true);
  };

  const confirmRemove = async () => {
    if (!removeConfirmStudent) return;
    await removeAssignment.mutateAsync(removeConfirmStudent.student_id);
    setRemoveConfirmStudent(null);
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudentIds);
    if (checked) newSelected.add(studentId);
    else newSelected.delete(studentId);
    setSelectedStudentIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && unassignedStudents) {
      setSelectedStudentIds(new Set(unassignedStudents.map(s => s.user_id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const selectedStudentsForBulk = unassignedStudents?.filter(s => selectedStudentIds.has(s.user_id)) || [];
  const isLoading = assignmentsLoading || unassignedLoading;

  return (
    <>
      <Tabs defaultValue="assigned" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="assigned">Assigned ({assignments?.length || 0})</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned ({unassignedStudents?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="assigned" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : assignments?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No students assigned yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Case Manager</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments?.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={a.student?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(a.student?.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{a.student?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{a.student?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(a.case_manager?.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{a.case_manager?.full_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleReassignClick(a)}><RefreshCw className="h-4 w-4 mr-1" />Reassign</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoveConfirmStudent(a)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="unassigned" className="mt-4 space-y-4">
          {selectedStudentIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">{selectedStudentIds.size} selected</span>
              <Button size="sm" onClick={() => setBulkAssignDialogOpen(true)}><Users className="h-4 w-4 mr-2" />Bulk Assign</Button>
            </div>
          )}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : unassignedStudents?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">All students assigned.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"><Checkbox checked={unassignedStudents && selectedStudentIds.size === unassignedStudents.length} onCheckedChange={handleSelectAll} /></TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedStudents?.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell><Checkbox checked={selectedStudentIds.has(s.user_id)} onCheckedChange={(c) => handleSelectStudent(s.user_id, c as boolean)} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(s.profile?.full_name)}</AvatarFallback></Avatar>
                        <div><p className="font-medium text-sm">{s.profile?.full_name || 'Unknown'}</p><p className="text-xs text-muted-foreground">{s.profile?.email}</p></div>
                      </div>
                    </TableCell>
                    <TableCell>{s.pendingRequests > 0 ? <Badge variant="secondary">{s.pendingRequests}</Badge> : <span className="text-muted-foreground text-sm">None</span>}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleAssignClick(s)}><UserPlus className="h-4 w-4 mr-1" />Assign</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <StudentAssignmentDialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen} student={selectedStudent} onAssigned={() => setSelectedStudent(null)} />
      <BulkStudentAssignmentDialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen} students={selectedStudentsForBulk} onAssigned={() => setSelectedStudentIds(new Set())} />

      <AlertDialog open={!!removeConfirmStudent} onOpenChange={() => setRemoveConfirmStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>Remove assignment for <strong>{removeConfirmStudent?.student?.full_name}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
