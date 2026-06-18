import { useMemo, useState } from 'react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeEntries, type TimeEntryStatus } from '@/hooks/useTimeEntries';
import { useDeleteTimeEntry } from '@/hooks/useTimeEntryMutations';
import { TimeEntryDialog } from '@/components/timetracking/TimeEntryDialog';
import { TimeEntryTable } from '@/components/timetracking/TimeEntryTable';
import { WeeklyTotalsCards } from '@/components/timetracking/WeeklyTotalsCards';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function TimeTracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState<TimeEntryStatus | 'all'>('all');
  const [billable, setBillable] = useState<'all' | 'yes' | 'no'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const del = useDeleteTimeEntry();

  const filters = useMemo(() => ({
    caseManagerIds: user ? [user.id] : [],
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: status === 'all' ? undefined : [status],
    billable: billable === 'all' ? null : billable === 'yes',
  }), [user, dateFrom, dateTo, status, billable]);

  const { data: entries = [], isLoading } = useTimeEntries(filters);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast({ title: 'Entry deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader title="Time tracking" description="Log billable and non-billable hours.">
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Log time
          </Button>
        </PageHeader>

        <WeeklyTotalsCards entries={entries} />

        <div className="grid gap-3 md:grid-cols-4">
          <div className="grid gap-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Billable</Label>
            <Select value={billable} onValueChange={(v) => setBillable(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Billable</SelectItem>
                <SelectItem value="no">Non-billable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <TimeEntryTable
            entries={entries}
            onEdit={(e) => { setEditing(e); setDialogOpen(true); }}
            onDelete={(e) => setDeleting(e)}
            canModify={(e) => e.status === 'pending' && e.case_manager_id === user?.id}
          />
        )}

        <TimeEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} entry={editing} />

        <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete time entry?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarLayout>
  );
}
