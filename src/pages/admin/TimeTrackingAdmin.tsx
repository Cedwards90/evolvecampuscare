import { useMemo, useState } from 'react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeEntries, type TimeEntryStatus, formatHours } from '@/hooks/useTimeEntries';
import { useReviewTimeEntries, useDeleteTimeEntry } from '@/hooks/useTimeEntryMutations';
import { TimeEntryTable } from '@/components/timetracking/TimeEntryTable';
import { WeeklyTotalsCards } from '@/components/timetracking/WeeklyTotalsCards';
import { TimeEntryDialog } from '@/components/timetracking/TimeEntryDialog';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

function toCsv(rows: Record<string, any>[]) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

export default function TimeTrackingAdmin() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState<TimeEntryStatus | 'all'>('all');
  const [billable, setBillable] = useState<'all' | 'yes' | 'no'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  const review = useReviewTimeEntries();
  const del = useDeleteTimeEntry();

  const filters = useMemo(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: status === 'all' ? undefined : [status],
    billable: billable === 'all' ? null : billable === 'yes',
  }), [dateFrom, dateTo, status, billable]);

  const { data: entries = [], isLoading } = useTimeEntries(filters);

  function toggle(id: string) {
    setSelectedIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }
  function toggleAll() {
    setSelectedIds(selectedIds.length === entries.length ? [] : entries.map((e) => e.id));
  }

  async function approve() {
    if (selectedIds.length === 0) return;
    try {
      await review.mutateAsync({ ids: selectedIds, status: 'approved' });
      toast({ title: `Approved ${selectedIds.length} entries` });
      setSelectedIds([]);
    } catch (e: any) {
      toast({ title: 'Approve failed', description: e.message, variant: 'destructive' });
    }
  }

  async function reject() {
    if (selectedIds.length === 0) return;
    try {
      await review.mutateAsync({ ids: selectedIds, status: 'rejected', review_note: rejectNote || null });
      toast({ title: `Rejected ${selectedIds.length} entries` });
      setSelectedIds([]);
      setRejectOpen(false);
      setRejectNote('');
    } catch (e: any) {
      toast({ title: 'Reject failed', description: e.message, variant: 'destructive' });
    }
  }

  function exportCsv() {
    const rows = entries.map((e) => ({
      date: e.entry_date,
      case_manager: e.case_manager?.full_name || e.case_manager?.email || e.case_manager_id,
      client: e.student?.full_name || e.student?.email || '',
      service_type: e.service_type,
      start: e.start_time,
      end: e.end_time,
      hours: formatHours(e.duration_minutes),
      billable: e.billable ? 'yes' : 'no',
      status: e.status,
      reviewed_by: e.reviewed_by ?? '',
      reviewed_at: e.reviewed_at ?? '',
      notes: e.notes ?? '',
      review_note: e.review_note ?? '',
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-entries-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader title="Hours review" description="Review, approve, and export case manager hours.">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
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

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div className="text-sm">{selectedIds.length} selected</div>
            <div className="flex gap-2">
              <Button size="sm" onClick={approve}><Check className="mr-1 h-4 w-4" /> Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}><X className="mr-1 h-4 w-4" /> Reject</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <TimeEntryTable
            entries={entries}
            showCaseManager
            selectable
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onEdit={isAdmin ? (e) => { setEditing(e); setEditOpen(true); } : undefined}
            onDelete={isAdmin ? async (e) => {
              if (!confirm('Delete this entry?')) return;
              try { await del.mutateAsync(e.id); toast({ title: 'Deleted' }); }
              catch (err: any) { toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }); }
            } : undefined}
            canModify={() => isAdmin}
          />
        )}

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject entries</DialogTitle></DialogHeader>
            <div className="grid gap-2">
              <Label>Reason (optional)</Label>
              <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={reject}>Reject {selectedIds.length}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isAdmin && <TimeEntryDialog open={editOpen} onOpenChange={setEditOpen} entry={editing} />}
      </div>
    </SidebarLayout>
  );
}
