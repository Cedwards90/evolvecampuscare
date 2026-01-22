import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  CheckCheck,
  Loader2,
  DollarSign
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { 
  useApproveRequest, 
  useDenyRequest, 
  useResolveRequest, 
  useEscalateRequest 
} from '@/hooks/useRequest';
import type { RequestStatus } from '@/types/database';

interface RequestActionsProps {
  requestId: string;
  userId: string;
  currentStatus: RequestStatus;
  requestedAmount?: number | null;
  onActionComplete?: () => void;
}

type DialogType = 'approve' | 'deny' | 'resolve' | 'escalate' | null;
type ApprovalType = 'full' | 'custom' | 'none';

export function RequestActions({ 
  requestId, 
  userId, 
  currentStatus,
  requestedAmount,
  onActionComplete 
}: RequestActionsProps) {
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [reason, setReason] = useState('');
  const [approvalType, setApprovalType] = useState<ApprovalType>('full');
  const [customAmount, setCustomAmount] = useState('');
  const { toast } = useToast();

  const approveRequest = useApproveRequest();
  const denyRequest = useDenyRequest();
  const resolveRequest = useResolveRequest();
  const escalateRequest = useEscalateRequest();

  const isLoading = 
    approveRequest.isPending || 
    denyRequest.isPending || 
    resolveRequest.isPending || 
    escalateRequest.isPending;

  const handleApprove = async () => {
    try {
      let approvedAmount: number | undefined;
      
      if (requestedAmount) {
        if (approvalType === 'full') {
          approvedAmount = requestedAmount;
        } else if (approvalType === 'custom') {
          const parsed = parseFloat(customAmount);
          if (isNaN(parsed) || parsed < 0) {
            toast({
              title: 'Invalid Amount',
              description: 'Please enter a valid dollar amount.',
              variant: 'destructive',
            });
            return;
          }
          approvedAmount = parsed;
        }
        // If 'none', approvedAmount remains undefined
      }

      await approveRequest.mutateAsync({ requestId, userId, approvedAmount });
      toast({
        title: 'Request Approved',
        description: approvedAmount 
          ? `Request approved for $${approvedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`
          : 'The request has been approved and is now in progress.',
      });
      setDialogType(null);
      setApprovalType('full');
      setCustomAmount('');
      onActionComplete?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve request. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeny = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for denying this request.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await denyRequest.mutateAsync({ requestId, userId, reason });
      toast({
        title: 'Request Denied',
        description: 'The request has been denied and the student has been notified.',
      });
      setDialogType(null);
      setReason('');
      onActionComplete?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to deny request. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleResolve = async () => {
    try {
      await resolveRequest.mutateAsync({ requestId, userId });
      toast({
        title: 'Request Resolved',
        description: 'The request has been marked as resolved.',
      });
      setDialogType(null);
      onActionComplete?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve request. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEscalate = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for escalating this request.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await escalateRequest.mutateAsync({ requestId, userId, reason });
      toast({
        title: 'Request Escalated',
        description: 'The request has been escalated for urgent attention.',
      });
      setDialogType(null);
      setReason('');
      onActionComplete?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to escalate request. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const closeDialog = () => {
    setDialogType(null);
    setReason('');
    setApprovalType('full');
    setCustomAmount('');
  };

  // Determine which actions are available based on current status
  const canApprove = currentStatus === 'submitted';
  const canDeny = currentStatus === 'submitted';
  const canResolve = currentStatus === 'in_progress' || currentStatus === 'escalated';
  const canEscalate = currentStatus === 'in_progress';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <Button 
            onClick={() => setDialogType('approve')}
            disabled={isLoading}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Approve & Start
          </Button>
        )}

        {canDeny && (
          <Button 
            variant="destructive"
            onClick={() => setDialogType('deny')}
            disabled={isLoading}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Deny Request
          </Button>
        )}

        {canResolve && (
          <Button 
            variant="default"
            onClick={() => setDialogType('resolve')}
            disabled={isLoading}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCheck className="h-4 w-4" />
            Mark Resolved
          </Button>
        )}

        {canEscalate && (
          <Button 
            variant="outline"
            onClick={() => setDialogType('escalate')}
            disabled={isLoading}
            className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
          >
            <AlertTriangle className="h-4 w-4" />
            Escalate
          </Button>
        )}
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={dialogType === 'approve'} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Request</AlertDialogTitle>
            <AlertDialogDescription>
              This will approve the request and change its status to "In Progress". 
              The student will be notified that their request is being handled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {requestedAmount && requestedAmount > 0 && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Requested Amount:</span>
                  <span className="font-semibold text-foreground">
                    ${requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label>Approval Amount</Label>
                <RadioGroup 
                  value={approvalType} 
                  onValueChange={(v) => setApprovalType(v as ApprovalType)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="full" id="full" />
                    <Label htmlFor="full" className="font-normal cursor-pointer">
                      Approve full amount (${requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="font-normal cursor-pointer">
                      Approve different amount
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="none" id="none" />
                    <Label htmlFor="none" className="font-normal cursor-pointer">
                      Approve without specifying amount
                    </Label>
                  </div>
                </RadioGroup>
                
                {approvalType === 'custom' && (
                  <div className="relative ml-6">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deny Dialog */}
      <AlertDialog open={dialogType === 'deny'} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for denying this request. This will be visible to the student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="deny-reason">Reason for Denial</Label>
            <Textarea
              id="deny-reason"
              placeholder="Explain why this request cannot be fulfilled..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeny} 
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deny Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolve Dialog */}
      <AlertDialog open={dialogType === 'resolve'} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve Request</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the request as resolved. The student will be notified 
              that their issue has been addressed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResolve} 
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Resolved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Escalate Dialog */}
      <AlertDialog open={dialogType === 'escalate'} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Escalate Request</AlertDialogTitle>
            <AlertDialogDescription>
              Escalating this request will flag it for urgent administrative attention. 
              Please provide a reason for the escalation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="escalate-reason">Reason for Escalation</Label>
            <Textarea
              id="escalate-reason"
              placeholder="Explain why this request needs to be escalated..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleEscalate} 
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Escalate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
