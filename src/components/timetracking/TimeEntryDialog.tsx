import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useMyStudents } from '@/hooks/useMyStudents';
import { useCreateTimeEntry, useUpdateTimeEntry, type TimeEntryInput } from '@/hooks/useTimeEntryMutations';
import type { ServiceType, TimeEntry } from '@/hooks/useTimeEntries';

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'direct_service', label: 'Direct service' },
  { value: 'case_management', label: 'Case management' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
];

const schema = z.object({
  student_id: z.string().nullable(),
  entry_date: z.string().min(1, 'Date required'),
  start_time: z.string().min(1, 'Start time required'),
  end_time: z.string().min(1, 'End time required'),
  service_type: z.string().min(1),
  notes: z.string().max(2000).optional(),
  billable: z.boolean(),
}).refine((v) => v.end_time > v.start_time, { message: 'End time must be after start time', path: ['end_time'] })
  .refine((v) => new Date(v.entry_date) <= new Date(new Date().toDateString()), {
    message: 'Date cannot be in the future', path: ['entry_date'],
  });

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry?: TimeEntry | null;
}

export function TimeEntryDialog({ open, onOpenChange, entry }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: myStudents = [] } = useMyStudents(user?.id);
  const create = useCreateTimeEntry();
  const update = useUpdateTimeEntry();

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    student_id: '' as string,
    entry_date: today,
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'case_management' as ServiceType,
    notes: '',
    billable: true,
  });

  useEffect(() => {
    if (entry) {
      setForm({
        student_id: entry.student_id ?? '',
        entry_date: entry.entry_date,
        start_time: entry.start_time.slice(0, 5),
        end_time: entry.end_time.slice(0, 5),
        service_type: entry.service_type,
        notes: entry.notes ?? '',
        billable: entry.billable,
      });
    } else {
      setForm({
        student_id: '',
        entry_date: today,
        start_time: '09:00',
        end_time: '10:00',
        service_type: 'case_management',
        notes: '',
        billable: true,
      });
    }
  }, [entry, open]);

  async function submit() {
    if (!user) return;
    const payload = {
      student_id: form.student_id || null,
      entry_date: form.entry_date,
      start_time: form.start_time,
      end_time: form.end_time,
      service_type: form.service_type,
      notes: form.notes || null,
      billable: form.billable,
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      toast({ title: 'Invalid entry', description: parsed.error.issues[0].message, variant: 'destructive' });
      return;
    }
    try {
      if (entry) {
        await update.mutateAsync({ id: entry.id, patch: payload as Partial<TimeEntryInput> });
        toast({ title: 'Entry updated' });
      } else {
        await create.mutateAsync({ case_manager_id: user.id, ...payload } as TimeEntryInput);
        toast({ title: 'Time logged' });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit time entry' : 'Log time'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Client / Student</Label>
            <Select value={form.student_id || 'none'} onValueChange={(v) => setForm({ ...form, student_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client / internal time</SelectItem>
                {myStudents.map((s) => (
                  <SelectItem key={s.student_id} value={s.student_id}>
                    {s.student?.full_name || s.student?.email || 'Unnamed'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={form.entry_date} max={today} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Start</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>End</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Service type</Label>
            <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v as ServiceType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Billable</Label>
              <p className="text-sm text-muted-foreground">Mark this entry as billable hours.</p>
            </div>
            <Switch checked={form.billable} onCheckedChange={(v) => setForm({ ...form, billable: v })} />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Brief description of the work performed" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending}>
            {entry ? 'Save changes' : 'Log time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
