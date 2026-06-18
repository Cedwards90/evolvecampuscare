import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShieldOff, ShieldCheck, ShieldAlert, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  useMFAFactors,
  useSetMFAExempt,
  useForceUnenrollMFA,
  useMFAAudit,
} from '@/hooks/useAdminMFA';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  currentlyExempt: boolean;
}

export function MFAUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  currentlyExempt,
}: Props) {
  const { toast } = useToast();
  const { data: factors, isLoading: factorsLoading } = useMFAFactors(open ? userId : null);
  const { data: audit = [] } = useMFAAudit(open ? userId : null);
  const setExempt = useSetMFAExempt();
  const unenroll = useForceUnenrollMFA();

  const [reason, setReason] = useState('');
  const [unenrollConfirm, setUnenrollConfirm] = useState('');
  const [showUnenroll, setShowUnenroll] = useState(false);

  const verifiedCount = factors?.verified_count ?? 0;

  const toggleExempt = async () => {
    try {
      await setExempt.mutateAsync({
        user_id: userId,
        exempt: !currentlyExempt,
        reason: reason || undefined,
      });
      toast({
        title: !currentlyExempt ? 'MFA exemption granted' : 'MFA exemption revoked',
      });
      setReason('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleUnenroll = async () => {
    if (unenrollConfirm !== userEmail) return;
    try {
      const res: any = await unenroll.mutateAsync({ user_id: userId, reason: reason || undefined });
      toast({
        title: 'Factors removed',
        description: `Removed ${res?.removed ?? 0} factor(s).`,
      });
      setUnenrollConfirm('');
      setShowUnenroll(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>MFA controls</DialogTitle>
          <DialogDescription>
            {userName} • {userEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md border">
            <div>
              <p className="text-sm font-medium">Current status</p>
              <div className="flex gap-2 mt-1">
                {factorsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : verifiedCount > 0 ? (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Enrolled ({verifiedCount})
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <ShieldOff className="h-3 w-3 mr-1" />
                    Not enrolled
                  </Badge>
                )}
                {currentlyExempt && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Exempt
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason (recommended)</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change being made?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant={currentlyExempt ? 'outline' : 'default'}
              onClick={toggleExempt}
              disabled={setExempt.isPending}
            >
              {setExempt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {currentlyExempt ? 'Revoke MFA exemption' : 'Grant MFA exemption'}
            </Button>

            {verifiedCount > 0 && !showUnenroll && (
              <Button variant="destructive" onClick={() => setShowUnenroll(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Force unenroll MFA factors
              </Button>
            )}

            {showUnenroll && (
              <div className="border border-destructive/40 rounded-md p-3 space-y-2">
                <p className="text-sm">
                  This will remove all MFA factors from this user's account. They will need to
                  re-enroll on next sign-in (unless exempt).
                </p>
                <Label className="text-xs">
                  Type the user's email <strong>{userEmail}</strong> to confirm:
                </Label>
                <Input
                  value={unenrollConfirm}
                  onChange={(e) => setUnenrollConfirm(e.target.value)}
                  placeholder={userEmail}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleUnenroll}
                    disabled={unenrollConfirm !== userEmail || unenroll.isPending}
                  >
                    {unenroll.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Confirm unenroll
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUnenroll(false);
                      setUnenrollConfirm('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Audit history</Label>
            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1 text-xs mt-1">
              {audit.length === 0 ? (
                <p className="text-muted-foreground">No history.</p>
              ) : (
                audit.map((a: any) => (
                  <div key={a.id} className="flex justify-between gap-2">
                    <span className="capitalize">{a.action.replace('_', ' ')}</span>
                    <span className="text-muted-foreground shrink-0">
                      {format(new Date(a.created_at), 'PPp')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
