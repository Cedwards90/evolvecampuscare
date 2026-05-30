import { useState } from "react";
import { AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useBulkOrgStudentApply,
  useBulkOrgStudentPreview,
} from "@/hooks/useBulkOrgStudentStatus";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  active: boolean; // true = reactivate, false = deactivate
}

export function BulkOrgStudentStatusDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  active,
}: Props) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const preview = useBulkOrgStudentPreview(organizationId, active, open);
  const apply = useBulkOrgStudentApply(organizationId);

  const requiredWord = active ? "REACTIVATE" : "DEACTIVATE";
  const count = preview.data?.count ?? 0;
  const sample = preview.data?.sample ?? [];

  const canSubmit =
    !apply.isPending &&
    !preview.isLoading &&
    count > 0 &&
    confirmation === requiredWord &&
    (active || reason.trim().length >= 3);

  const handleClose = (next: boolean) => {
    if (apply.isPending) return;
    if (!next) {
      setReason("");
      setConfirmation("");
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    try {
      const result = await apply.mutateAsync({ active, reason, confirmation });
      toast({
        title: active ? "Students reactivated" : "Students deactivated",
        description: `${result.processed} processed${
          result.failed ? `, ${result.failed} failed` : ""
        }. Batch ${result.batchId.slice(0, 8)}.`,
      });
      handleClose(false);
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {active ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            {active ? "Reactivate" : "Deactivate"} all students in {organizationName}
          </DialogTitle>
          <DialogDescription>
            This affects all students currently linked to this organization. Historical
            records remain visible to authorized admins.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant={active ? "default" : "destructive"}>
            <AlertDescription className="text-sm">
              {active ? (
                <>
                  This restores platform access for all currently <b>inactive</b> students
                  in this organization. Each student will be able to sign in again.
                </>
              ) : (
                <>
                  Deactivated students lose login access <b>immediately</b> and all active
                  sessions are revoked. Reports, case notes, assignments, documents, and
                  history remain visible to authorized admins.
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Affected students</div>
              {preview.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Badge variant={count > 0 ? "default" : "secondary"}>{count}</Badge>
              )}
            </div>
            {sample.length > 0 && (
              <ScrollArea className="h-40 rounded border bg-muted/30 p-2">
                <ul className="text-sm space-y-1">
                  {sample.map((s) => (
                    <li key={s.user_id} className="flex justify-between gap-2">
                      <span className="truncate">{s.full_name || "Unnamed"}</span>
                      <span className="text-muted-foreground truncate">{s.email}</span>
                    </li>
                  ))}
                </ul>
                {count > sample.length && (
                  <div className="text-xs text-muted-foreground mt-2 px-1">
                    + {count - sample.length} more
                  </div>
                )}
              </ScrollArea>
            )}
            {!preview.isLoading && count === 0 && (
              <p className="text-sm text-muted-foreground">
                No {active ? "inactive" : "active"} students match this action.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-reason">
              Reason {active ? "(optional)" : <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="bulk-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder={
                active
                  ? "Optional note for the audit log"
                  : "Required: explain why these students are being deactivated"
              }
              rows={3}
              disabled={apply.isPending}
            />
            <p className="text-xs text-muted-foreground">{reason.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-confirm">
              Type <code className="font-mono font-bold">{requiredWord}</code> to confirm
            </Label>
            <Input
              id="bulk-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={requiredWord}
              autoComplete="off"
              disabled={apply.isPending}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            A timestamped audit entry will be recorded for every affected student.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={apply.isPending}>
            Cancel
          </Button>
          <Button
            variant={active ? "default" : "destructive"}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {apply.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {active ? "Reactivate" : "Deactivate"} {count > 0 ? `${count} ` : ""}student
            {count === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
