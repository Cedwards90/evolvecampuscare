import { useState, useMemo } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCaseManagers } from '@/hooks/useCaseManagerStats';
import { useReassignStudent } from '@/hooks/useReassignStudent';

interface ReassignStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  fromCaseManagerId: string;
  fromCaseManagerName: string;
}

export function ReassignStudentDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  fromCaseManagerId,
  fromCaseManagerName,
}: ReassignStudentDialogProps) {
  const [targetId, setTargetId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [reassignOpenRequests, setReassignOpenRequests] = useState(true);

  const { data: caseManagers, isLoading: isLoadingCMs } = useCaseManagers();
  const reassign = useReassignStudent();

  const targets = useMemo(
    () => (caseManagers || []).filter((cm) => cm.user_id !== fromCaseManagerId),
    [caseManagers, fromCaseManagerId]
  );

  const targetCM = targets.find((cm) => cm.user_id === targetId);
  const valid = !!targetId && targetId !== fromCaseManagerId;

  const handleSubmit = async () => {
    if (!valid) return;
    try {
      await reassign.mutateAsync({
        studentId,
        fromCaseManagerId,
        toCaseManagerId: targetId,
        fromCaseManagerName,
        toCaseManagerName: targetCM?.full_name || targetCM?.email || null,
        notes: notes.trim() || undefined,
        reassignOpenRequests,
      });
      // reset and close
      setTargetId('');
      setNotes('');
      setReassignOpenRequests(true);
      onOpenChange(false);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign Student</DialogTitle>
          <DialogDescription>
            Move <span className="font-medium text-foreground">{studentName}</span> to a
            different case manager. This action is logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="truncate text-sm font-medium">{fromCaseManagerName}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-right">
              <p className="text-xs text-muted-foreground">To</p>
              <p className="truncate text-sm font-medium">
                {targetCM?.full_name || targetCM?.email || (
                  <span className="text-muted-foreground">Select…</span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-cm">New case manager</Label>
            <Select value={targetId} onValueChange={setTargetId} disabled={isLoadingCMs}>
              <SelectTrigger id="target-cm">
                <SelectValue
                  placeholder={isLoadingCMs ? 'Loading…' : 'Choose a case manager'}
                />
              </SelectTrigger>
              <SelectContent>
                {targets.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No other case managers available.
                  </div>
                )}
                {targets.map((cm) => (
                  <SelectItem key={cm.user_id} value={cm.user_id}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span>{cm.full_name || cm.email}</span>
                      <Badge variant="secondary" className="ml-2">
                        {cm.assigned_students} students
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="reassign-open"
              checked={reassignOpenRequests}
              onCheckedChange={(v) => setReassignOpenRequests(v === true)}
            />
            <Label htmlFor="reassign-open" className="text-sm font-normal leading-snug">
              Also move the student's open requests (submitted, in progress, escalated) to
              the new case manager.
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Reason / notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Workload balancing, specialty match, leave coverage…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reassign.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || reassign.isPending}>
            {reassign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm reassignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
