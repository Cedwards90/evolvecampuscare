import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBulkAssignCohort } from '@/hooks/useCohorts';
import { useBulkAssignOrganization } from '@/hooks/useTrainingOrganizations';
import { useBulkAssignStudents } from '@/hooks/useStudentAssignments';

export type BulkMode = 'class' | 'organization' | 'case_manager';

interface BulkStudentUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: BulkMode;
  studentIds: string[];
  cohorts: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
  caseManagers: { value: string; label: string }[];
  onDone: () => void;
}

export function BulkStudentUpdateDialog({
  open,
  onOpenChange,
  mode,
  studentIds,
  cohorts,
  organizations,
  caseManagers,
  onDone,
}: BulkStudentUpdateDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [value, setValue] = useState('');

  const bulkCohort = useBulkAssignCohort();
  const bulkOrg = useBulkAssignOrganization();
  const bulkCm = useBulkAssignStudents();

  const pending = bulkCohort.isPending || bulkOrg.isPending || bulkCm.isPending;

  const config = {
    class: {
      title: 'Change class',
      description: `Assign ${studentIds.length} student(s) to a class.`,
      label: 'Class',
      options: [{ value: 'none', label: 'No class' }, ...cohorts.map((c) => ({ value: c.id, label: c.name }))],
    },
    organization: {
      title: 'Change organization',
      description: `Move ${studentIds.length} student(s) to an organization.`,
      label: 'Organization',
      options: organizations.map((o) => ({ value: o.id, label: o.name })),
    },
    case_manager: {
      title: 'Reassign case manager',
      description: `Assign ${studentIds.length} student(s) to a case manager. Their open requests move too.`,
      label: 'Case manager',
      options: caseManagers,
    },
  }[mode];

  const handleSave = async () => {
    if (!value) return;
    try {
      if (mode === 'class') {
        await bulkCohort.mutateAsync({ studentIds, cohortId: value === 'none' ? null : value });
      } else if (mode === 'organization') {
        await bulkOrg.mutateAsync({ organizationId: value, userIds: studentIds });
      } else {
        if (!user) throw new Error('You must be signed in.');
        await bulkCm.mutateAsync({ studentIds, caseManagerId: value, assignedBy: user.id });
      }
      toast({ title: 'Students updated', description: `${studentIds.length} student(s) updated.` });
      setValue('');
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{config.label}</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${config.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {config.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={handleSave} disabled={!value || pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply to {studentIds.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
