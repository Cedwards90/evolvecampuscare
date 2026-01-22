import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useApproveRequest, useDenyRequest } from '@/hooks/useRequest';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { SupportRequest } from '@/types/database';

interface RequestQuickActionsProps {
  request: SupportRequest;
  showViewLink?: boolean;
  onActionComplete?: () => void;
}

export function RequestQuickActions({
  request,
  showViewLink = true,
  onActionComplete,
}: RequestQuickActionsProps) {
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  const approveRequest = useApproveRequest();
  const denyRequest = useDenyRequest();

  const canTakeAction = request.status === 'submitted';
  const isLoading = approveRequest.isPending || denyRequest.isPending;

  const handleApprove = async () => {
    if (!user?.id) return;

    try {
      await approveRequest.mutateAsync({
        requestId: request.id,
        userId: user.id,
      });
      toast({
        title: 'Request approved',
        description: 'The request has been approved and is now in progress.',
      });
      setApproveDialogOpen(false);
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
    if (!user?.id || !denyReason.trim()) return;

    try {
      await denyRequest.mutateAsync({
        requestId: request.id,
        userId: user.id,
        reason: denyReason.trim(),
      });
      toast({
        title: 'Request denied',
        description: 'The request has been denied.',
      });
      setDenyDialogOpen(false);
      setDenyReason('');
      onActionComplete?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to deny request. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center gap-1">
      {canTakeAction && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={() => setApproveDialogOpen(true)}
                disabled={isLoading}
              >
                {approveRequest.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Approve</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDenyDialogOpen(true)}
                disabled={isLoading}
              >
                {denyRequest.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deny</TooltipContent>
          </Tooltip>
        </>
      )}

      {showViewLink && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
              <Link to={`/requests/${request.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View Details</TooltipContent>
        </Tooltip>
      )}

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this request? It will be moved to "In Progress" status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-medium">{request.title}</p>
              <p className="text-sm text-muted-foreground">
                From: {request.student?.full_name || 'Unknown'}
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isLoading}>
              {approveRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deny Dialog */}
      <AlertDialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for denying this request. The student will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-medium">{request.title}</p>
              <p className="text-sm text-muted-foreground">
                From: {request.student?.full_name || 'Unknown'}
              </p>
            </div>
            <Textarea
              placeholder="Reason for denial (required)"
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDenyReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeny}
              disabled={!denyReason.trim() || isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {denyRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deny Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
