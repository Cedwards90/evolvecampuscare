import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCaseManagers } from '@/hooks/useCaseManagerStats';
import { useAssignRequest, useBulkAssignRequests } from '@/hooks/useAssignRequest';
import type { SupportRequest, Profile } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssignCaseManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: SupportRequest | null;
  requests?: SupportRequest[];
  onAssigned?: () => void;
}

const MAX_CAPACITY = 20; // Maximum requests per case manager

function getWorkloadIndicatorClass(percentage: number): string {
  if (percentage < 50) return 'bg-green-600';
  if (percentage < 80) return 'bg-yellow-500';
  return 'bg-destructive';
}

function getWorkloadStatus(percentage: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (percentage < 50) return { label: 'Available', variant: 'default' };
  if (percentage < 80) return { label: 'Moderate', variant: 'secondary' };
  return { label: 'High Load', variant: 'destructive' };
}

export function AssignCaseManagerDialog({
  open,
  onOpenChange,
  request,
  requests = [],
  onAssigned,
}: AssignCaseManagerDialogProps) {
  const { user } = useAuth();
  const { data: caseManagers, isLoading } = useCaseManagers();
  const assignRequest = useAssignRequest();
  const bulkAssign = useBulkAssignRequests();
  
  const [selectedCaseManager, setSelectedCaseManager] = useState<string | null>(null);

  const isBulkMode = requests.length > 0;
  const requestCount = isBulkMode ? requests.length : 1;

  // Sort case managers by available capacity
  const sortedCaseManagers = useMemo(() => {
    if (!caseManagers) return [];
    return [...caseManagers].sort((a, b) => {
      const aCapacity = MAX_CAPACITY - a.active_requests;
      const bCapacity = MAX_CAPACITY - b.active_requests;
      return bCapacity - aCapacity;
    });
  }, [caseManagers]);

  const handleAssign = async () => {
    if (!selectedCaseManager || !user?.id) return;

    if (isBulkMode) {
      const requestIds = requests.map(r => r.id);
      await bulkAssign.mutateAsync({
        requestIds,
        caseManagerId: selectedCaseManager,
        userId: user.id,
      });
    } else if (request) {
      await assignRequest.mutateAsync({
        requestId: request.id,
        caseManagerId: selectedCaseManager,
        userId: user.id,
      });
    }

    setSelectedCaseManager(null);
    onOpenChange(false);
    onAssigned?.();
  };

  const selectedManager = sortedCaseManagers.find(cm => cm.user_id === selectedCaseManager);
  const newWorkload = selectedManager 
    ? ((selectedManager.active_requests + requestCount) / MAX_CAPACITY) * 100 
    : 0;
  const isOverloading = newWorkload > 80;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBulkMode ? (
              <>
                <Users className="h-5 w-5" />
                Assign {requests.length} Request{requests.length > 1 ? 's' : ''}
              </>
            ) : (
              <>
                <User className="h-5 w-5" />
                Assign Case Manager
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isBulkMode 
              ? 'Select a case manager to handle these requests. Consider their current workload.'
              : request 
                ? `Assign "${request.title}" to a case manager.`
                : 'Select a case manager to assign.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading case managers...
              </div>
            ) : sortedCaseManagers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No case managers available.
              </div>
            ) : (
              sortedCaseManagers.map((cm) => {
                const workloadPercentage = (cm.active_requests / MAX_CAPACITY) * 100;
                const status = getWorkloadStatus(workloadPercentage);
                const isSelected = selectedCaseManager === cm.user_id;
                const projectedWorkload = isSelected 
                  ? ((cm.active_requests + requestCount) / MAX_CAPACITY) * 100
                  : workloadPercentage;

                return (
                  <button
                    key={cm.user_id}
                    onClick={() => setSelectedCaseManager(cm.user_id)}
                    className={cn(
                      'w-full p-4 rounded-lg border transition-all text-left',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={cm.avatar_url || undefined} />
                        <AvatarFallback>
                          {cm.full_name?.charAt(0) || cm.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">
                            {cm.full_name || cm.email}
                          </p>
                          <Badge variant={status.variant} className="shrink-0">
                            {status.label}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground truncate">
                          {cm.email}
                        </p>
                        
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Workload: {cm.active_requests}/{MAX_CAPACITY} requests
                            </span>
                            {cm.emergency_requests > 0 && (
                              <span className="text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {cm.emergency_requests} emergency
                              </span>
                            )}
                          </div>
                          <Progress 
                            value={projectedWorkload} 
                            className="h-2"
                            indicatorClassName={getWorkloadIndicatorClass(projectedWorkload)}
                          />
                          {isSelected && requestCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              After assignment: {cm.active_requests + requestCount}/{MAX_CAPACITY}
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {isOverloading && selectedCaseManager && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Warning: This assignment will put the case manager above 80% capacity.
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedCaseManager || assignRequest.isPending || bulkAssign.isPending}
          >
            {assignRequest.isPending || bulkAssign.isPending 
              ? 'Assigning...' 
              : `Assign${isBulkMode ? ` ${requestCount} Request${requestCount > 1 ? 's' : ''}` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
