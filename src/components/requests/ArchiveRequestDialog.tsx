import { useState } from 'react';
import { Loader2, Archive, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useArchiveRequest } from '@/hooks/useRequestControls';
import { useHardDeleteRequest } from '@/hooks/useRequest';
import { useIsDesignatedDeleteAdmin } from '@/hooks/useInternalControls';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ArchiveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestTitle: string;
  studentName?: string;
  onArchived?: () => void;
}

export function ArchiveRequestDialog({
  open,
  onOpenChange,
  requestId,
  requestTitle,
  studentName,
  onArchived,
}: ArchiveRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const archive = useArchiveRequest();
  const hardDelete = useHardDeleteRequest();
  const isDesignated = useIsDesignatedDeleteAdmin();
  const { user } = useAuth();
  const { toast } = useToast();

  const reset = () => {
    setReason('');
    setConfirmText('');
    setShowDelete(false);
  };

  const handleArchive = async () => {
    if (!user || !reason.trim()) return;
    try {
      await archive.mutateAsync({ requestId, userId: user.id, reason });
      toast({ title: 'Request archived', description: 'It stays in history and reports, but leaves the active lists.' });
      reset();
      onOpenChange(false);
      onArchived?.();
    } catch (err) {
      toast({
        title: 'Could not archive the request',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!user || confirmText.trim() !== 'DELETE' || !reason.trim()) return;
    try {
      await hardDelete.mutateAsync({ requestId, reason, userId: user.id });
      toast({ title: 'Request deleted', description: 'The deletion has been permanently logged.' });
      reset();
      onOpenChange(false);
      onArchived?.();
    } catch (err) {
      toast({
        title: 'Could not delete the request',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive this request?</DialogTitle>
          <DialogDescription>
            Nothing is destroyed. The request stays in history, reports and the participant's file, and drops out of
            active lists and dashboards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="font-medium break-words">{requestTitle}</p>
            {studentName && <p className="text-sm text-muted-foreground">From: {studentName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="archive-reason">Reason (recorded permanently)</Label>
            <Textarea
              id="archive-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this request being archived?"
            />
          </div>

          {isDesignated && (
            <>
              <Separator />
              {!showDelete ? (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setShowDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  I need to delete this permanently
                </Button>
              ) : (
                <div className="space-y-2 rounded-lg border border-destructive/40 p-3">
                  <p className="text-sm text-destructive font-medium">Permanent deletion</p>
                  <p className="text-xs text-muted-foreground">
                    This removes the request and its history for good. Your name, the date and the reason above are
                    written to the permanent deletion log.
                  </p>
                  <Label htmlFor="confirm-delete">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={confirmText.trim() !== 'DELETE' || !reason.trim() || hardDelete.isPending}
                  >
                    {hardDelete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete permanently
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleArchive} disabled={!reason.trim() || archive.isPending}>
            {archive.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
            Archive request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
