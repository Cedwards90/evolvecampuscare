import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSuspendOrg, useReinstateOrg } from '@/hooks/useOrgSuspension';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  /** If true, dialog reinstates instead of suspends. */
  mode: 'suspend' | 'reinstate';
}

export function SuspendOrgDialog({ open, onOpenChange, orgId, orgName, mode }: Props) {
  const [reason, setReason] = useState('');
  const suspend = useSuspendOrg();
  const reinstate = useReinstateOrg();
  const { toast } = useToast();
  const isSuspend = mode === 'suspend';
  const pending = suspend.isPending || reinstate.isPending;

  const handleSubmit = async () => {
    try {
      if (isSuspend) {
        if (!reason.trim()) {
          toast({ title: 'Reason required', description: 'Please provide a reason for suspension.', variant: 'destructive' });
          return;
        }
        await suspend.mutateAsync({ orgId, reason: reason.trim() });
        toast({ title: 'Organization suspended', description: `${orgName} access is now suspended.` });
      } else {
        await reinstate.mutateAsync({ orgId, reason: reason.trim() || undefined });
        toast({ title: 'Organization reinstated', description: `${orgName} access has been restored.` });
      }
      setReason('');
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'Something went wrong.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuspend && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {isSuspend ? 'Suspend organization access' : 'Reinstate organization access'}
          </DialogTitle>
          <DialogDescription>
            {isSuspend ? (
              <>Members of <strong>{orgName}</strong> will see a banner and cannot submit
              requests, messages, or updates. Their data will be hidden from staff dashboards.
              No data is deleted.</>
            ) : (
              <>Restore full access for <strong>{orgName}</strong>. Members will be able to
              submit and staff will see their data again.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{isSuspend ? 'Reason (required)' : 'Note (optional)'}</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={isSuspend ? 'e.g. Billing on hold, compliance review…' : 'Anything to log with this action'}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button
            variant={isSuspend ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={pending}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSuspend ? 'Suspend access' : 'Reinstate access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
