import { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCaseManagers } from '@/hooks/useCaseManagerStats';
import { useBulkAssignStudents, type UnassignedStudent } from '@/hooks/useStudentAssignments';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Search, Users } from 'lucide-react';

interface BulkStudentAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: UnassignedStudent[];
  onAssigned?: () => void;
}

const MAX_STUDENTS_PER_CM = 25;

function getWorkloadIndicatorClass(percentage: number): string {
  if (percentage >= 80) return 'bg-destructive';
  if (percentage >= 60) return 'bg-warning';
  return 'bg-success';
}

function getWorkloadStatus(count: number, max: number): string {
  const percentage = (count / max) * 100;
  if (percentage >= 80) return 'High';
  if (percentage >= 50) return 'Medium';
  return 'Low';
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function BulkStudentAssignmentDialog({
  open,
  onOpenChange,
  students,
  onAssigned,
}: BulkStudentAssignmentDialogProps) {
  const [selectedCaseManager, setSelectedCaseManager] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { data: caseManagers, isLoading: caseManagersLoading } = useCaseManagers();
  const bulkAssign = useBulkAssignStudents();
  const { user } = useAuth();

  const sortedCaseManagers = useMemo(() => {
    if (!caseManagers) return [];
    const sorted = [...caseManagers].sort((a, b) => {
      const aCapacity = MAX_STUDENTS_PER_CM - (a.active_requests || 0);
      const bCapacity = MAX_STUDENTS_PER_CM - (b.active_requests || 0);
      return bCapacity - aCapacity;
    });
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (cm) =>
        (cm.full_name || '').toLowerCase().includes(q) ||
        (cm.email || '').toLowerCase().includes(q)
    );
  }, [caseManagers, search]);

  const handleAssign = async () => {
    if (!selectedCaseManager || !user || students.length === 0) return;

    const studentIds = students.map(s => s.user_id);
    
    await bulkAssign.mutateAsync({
      studentIds,
      caseManagerId: selectedCaseManager,
      assignedBy: user.id,
    });

    setSelectedCaseManager(null);
    onOpenChange(false);
    onAssigned?.();
  };

  const selectedCM = sortedCaseManagers.find(cm => cm.user_id === selectedCaseManager);
  const newWorkload = selectedCM 
    ? (selectedCM.active_requests || 0) + students.length 
    : 0;
  const isOverloading = newWorkload > MAX_STUDENTS_PER_CM;
  const totalPendingRequests = students.reduce((sum, s) => sum + s.pendingRequests, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Assign Students
          </DialogTitle>
          <DialogDescription>
            Assign {students.length} selected student{students.length > 1 ? 's' : ''} to a case manager.
            {totalPendingRequests > 0 && (
              <span className="block mt-1 text-warning">
                These students have {totalPendingRequests} pending request{totalPendingRequests > 1 ? 's' : ''} that will also be assigned.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm font-medium mb-3">Selected Students:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {students.slice(0, 5).map((student, index) => (
              <Badge key={student.user_id} variant="secondary" className="gap-1">
                {student.profile.full_name || student.profile.email}
              </Badge>
            ))}
            {students.length > 5 && (
              <Badge variant="outline">+{students.length - 5} more</Badge>
            )}
          </div>

          <p className="text-sm font-medium mb-3">Select a Case Manager:</p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {caseManagersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading case managers...
                </div>
              ) : sortedCaseManagers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No case managers available.
                </div>
              ) : (
                sortedCaseManagers.map((cm) => {
                  const currentStudents = cm.active_requests || 0;
                  const projectedStudents = selectedCaseManager === cm.user_id 
                    ? currentStudents + students.length 
                    : currentStudents;
                  const percentage = (currentStudents / MAX_STUDENTS_PER_CM) * 100;
                  const projectedPercentage = (projectedStudents / MAX_STUDENTS_PER_CM) * 100;
                  const isSelected = selectedCaseManager === cm.user_id;
                  const wouldOverload = currentStudents + students.length > MAX_STUDENTS_PER_CM;

                  return (
                    <div
                      key={cm.user_id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      } ${wouldOverload && isSelected ? 'border-destructive bg-destructive/5' : ''}`}
                      onClick={() => setSelectedCaseManager(cm.user_id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={cm.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(cm.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {cm.full_name || 'Unnamed Case Manager'}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                getWorkloadStatus(currentStudents, MAX_STUDENTS_PER_CM) === 'High'
                                  ? 'border-destructive text-destructive'
                                  : getWorkloadStatus(currentStudents, MAX_STUDENTS_PER_CM) === 'Medium'
                                  ? 'border-warning text-warning'
                                  : 'border-success text-success'
                              }`}
                            >
                              {getWorkloadStatus(currentStudents, MAX_STUDENTS_PER_CM)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {cm.email}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          {isSelected ? (
                            <span className={wouldOverload ? 'text-destructive font-medium' : 'text-primary font-medium'}>
                              {projectedStudents}/{MAX_STUDENTS_PER_CM}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {currentStudents}/{MAX_STUDENTS_PER_CM}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <Progress 
                          value={isSelected ? projectedPercentage : percentage} 
                          className={`h-1.5 ${getWorkloadIndicatorClass(isSelected ? projectedPercentage : percentage)}`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {isOverloading && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              This assignment would exceed the recommended caseload of {MAX_STUDENTS_PER_CM} students.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedCaseManager || bulkAssign.isPending}
          >
            {bulkAssign.isPending 
              ? 'Assigning...' 
              : `Assign ${students.length} Student${students.length > 1 ? 's' : ''}`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
