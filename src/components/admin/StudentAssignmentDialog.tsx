import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useCaseManagers } from '@/hooks/useCaseManagerStats';
import { useAssignStudent, type UnassignedStudent } from '@/hooks/useStudentAssignments';
import { useAuth } from '@/contexts/AuthContext';
import { Check, Users, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: UnassignedStudent | null;
  onAssigned?: () => void;
}

const MAX_STUDENTS_PER_CM = 25; // Maximum students per case manager

function getWorkloadIndicatorClass(percentage: number): string {
  if (percentage < 50) return 'bg-green-500';
  if (percentage < 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getWorkloadStatus(count: number, max: number): string {
  const percentage = (count / max) * 100;
  if (percentage < 50) return 'Low';
  if (percentage < 80) return 'Medium';
  return 'High';
}

export function StudentAssignmentDialog({
  open,
  onOpenChange,
  student,
  onAssigned,
}: StudentAssignmentDialogProps) {
  const [selectedCaseManager, setSelectedCaseManager] = useState<string | null>(null);
  const { data: caseManagers, isLoading: caseManagersLoading } = useCaseManagers();
  const assignStudent = useAssignStudent();
  const { user } = useAuth();

  // Sort case managers by available capacity (fewer students first)
  const sortedCaseManagers = useMemo(() => {
    if (!caseManagers) return [];
    return [...caseManagers].sort((a, b) => a.active_requests - b.active_requests);
  }, [caseManagers]);

  const handleAssign = async () => {
    if (!selectedCaseManager || !student || !user?.id) return;

    try {
      await assignStudent.mutateAsync({
        studentId: student.user_id,
        caseManagerId: selectedCaseManager,
        assignedBy: user.id,
        updateExistingRequests: true,
      });
      onOpenChange(false);
      setSelectedCaseManager(null);
      onAssigned?.();
    } catch (error) {
      // Error handled by the hook
    }
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Student to Case Manager</DialogTitle>
          <DialogDescription>
            Assign <strong>{student.profile.full_name || student.profile.email}</strong> to a case manager. 
            All current and future requests from this student will be routed to the selected case manager.
          </DialogDescription>
        </DialogHeader>

        {student.pendingRequests > 0 && (
          <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>
              This student has <strong>{student.pendingRequests}</strong> pending request(s) that will be 
              automatically assigned.
            </span>
          </div>
        )}

        <ScrollArea className="max-h-[300px] pr-4">
          <div className="space-y-2">
            {caseManagersLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading case managers...
              </div>
            ) : sortedCaseManagers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No case managers available
              </div>
            ) : (
              sortedCaseManagers.map((cm) => {
                const workloadPercentage = Math.min((cm.active_requests / MAX_STUDENTS_PER_CM) * 100, 100);
                const isSelected = selectedCaseManager === cm.user_id;
                const workloadStatus = getWorkloadStatus(cm.active_requests, MAX_STUDENTS_PER_CM);

                return (
                  <div
                    key={cm.user_id}
                    onClick={() => setSelectedCaseManager(cm.user_id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={cm.avatar_url || undefined} />
                      <AvatarFallback>
                        {(cm.full_name || cm.email || 'CM').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {cm.full_name || cm.email}
                        </span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {cm.email}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1">
                          <Progress
                            value={workloadPercentage}
                            className={cn('h-1.5', getWorkloadIndicatorClass(workloadPercentage))}
                          />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{cm.active_requests} active</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            workloadStatus === 'Low' && 'border-success text-success',
                            workloadStatus === 'Medium' && 'border-warning text-warning',
                            workloadStatus === 'High' && 'border-destructive text-destructive'
                          )}
                        >
                          {workloadStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedCaseManager || assignStudent.isPending}
          >
            {assignStudent.isPending ? 'Assigning...' : 'Assign Student'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
