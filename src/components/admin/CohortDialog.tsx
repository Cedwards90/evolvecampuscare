import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCreateCohort, useUpdateCohort, type Cohort } from '@/hooks/useCohorts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  cohort?: Cohort | null;
}

export function CohortDialog({ open, onOpenChange, organizationId, cohort }: Props) {
  const { toast } = useToast();
  const create = useCreateCohort();
  const update = useUpdateCohort();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (open) {
      setName(cohort?.name ?? '');
      setDescription(cohort?.description ?? '');
      setStartDate(cohort?.start_date ?? '');
      setEndDate(cohort?.end_date ?? '');
    }
  }, [open, cohort]);

  const submitting = create.isPending || update.isPending;
  const isEdit = !!cohort;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: cohort!.id,
          name: trimmed,
          description,
          start_date: startDate || null,
          end_date: endDate || null,
        });
        toast({ title: 'Cohort updated' });
      } else {
        await create.mutateAsync({
          organization_id: organizationId,
          name: trimmed,
          description,
          start_date: startDate || null,
          end_date: endDate || null,
        });
        toast({ title: 'Cohort created' });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: isEdit ? 'Failed to update cohort' : 'Failed to create cohort',
        description: e?.message?.includes('duplicate') ? 'A cohort with that name already exists in this organization.' : e?.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit cohort' : 'New cohort'}</DialogTitle>
          <DialogDescription>
            Group students within this organization into a class or cohort.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cohort-name">Name</Label>
            <Input
              id="cohort-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring 2026 Cohort"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cohort-start">Start date</Label>
              <Input id="cohort-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohort-end">End date</Label>
              <Input id="cohort-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cohort-desc">Description</Label>
            <Textarea
              id="cohort-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this cohort"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create cohort'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
