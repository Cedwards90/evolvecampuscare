import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteRequest } from '@/hooks/useRequest';
import { useToast } from '@/hooks/use-toast';

interface DeleteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestTitle: string;
  studentName?: string;
  onDeleted?: () => void;
}

export function DeleteRequestDialog({
  open,
  onOpenChange,
  requestId,
  requestTitle,
  studentName,
  onDeleted,
}: DeleteRequestDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const deleteRequest = useDeleteRequest();
  const { toast } = useToast();

  const canDelete = confirmText.trim() === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete) return;
    try {
      await deleteRequest.mutateAsync({ requestId });
      toast({
        title: 'Request deleted',
        description: 'The request and its history have been permanently removed.',
      });
      setConfirmText('');
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast({
        title: 'Failed to delete request',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmText('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this request?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the request, all updates, attachments, and share links.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2 space-y-4">
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="font-medium break-words">{requestTitle}</p>
            {studentName && (
              <p className="text-sm text-muted-foreground">From: {studentName}</p>
            )}
          </div>
          <div className="space-y-2">
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
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={!canDelete || deleteRequest.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete request
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
