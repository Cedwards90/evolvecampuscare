import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
import { UserPlus, RefreshCw, UserMinus, UserCheck } from 'lucide-react';
import { StudentAssignmentDialog } from './StudentAssignmentDialog';
import {
  useRemoveStudentAssignment,
  type UnassignedStudent,
} from '@/hooks/useStudentAssignments';
import type { Profile } from '@/types/database';

interface Props {
  studentProfile: Profile;
  assignedCaseManager: Profile | null;
  pendingRequests?: number;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function StudentAssignmentCard({ studentProfile, assignedCaseManager, pendingRequests = 0 }: Props) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeAssignment = useRemoveStudentAssignment();

  const studentForDialog: UnassignedStudent = {
    user_id: studentProfile.user_id,
    profile: studentProfile,
    pendingRequests,
  };

  const handleRemove = async () => {
    await removeAssignment.mutateAsync(studentProfile.user_id);
    setConfirmRemove(false);
  };

  return (
    <>
      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Case Manager Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignedCaseManager ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={assignedCaseManager.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(assignedCaseManager.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{assignedCaseManager.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground">{assignedCaseManager.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reassign
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmRemove(true)}
                >
                  <UserMinus className="h-4 w-4 mr-1" />
                  Unassign
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                No case manager assigned. Future requests will be unrouted until you assign one.
              </p>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Assign
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <StudentAssignmentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        student={studentForDialog}
      />

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign Case Manager</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{assignedCaseManager?.full_name || 'this case manager'}</strong> from{' '}
              <strong>{studentProfile.full_name || studentProfile.email}</strong>?
              {pendingRequests > 0 && (
                <span className="block mt-2 text-warning">
                  {pendingRequests} pending request{pendingRequests > 1 ? 's' : ''} will remain
                  attached to this case manager until reassigned.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground"
            >
              Unassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
