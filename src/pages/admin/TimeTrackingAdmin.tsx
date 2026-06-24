import { useMemo, useState } from 'react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Check, X, Pencil, Eye, Loader2, CheckCheck, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import {
  useTimeEntries,
  useUpdateTimeEntry,
  useReviewTimeEntry,
  useTimeEntryAudit,
  useCreateTimeEntry,
  type TimeEntry,
  type TimeEntryFilters,
} from '@/hooks/useTimeEntries';
import { useTrainingOrganizations } from '@/hooks/useTrainingOrganizations';
import { useUsers } from '@/hooks/useUsers';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

const SERVICE_TYPES = [
  'case_management',
  'direct_service',
  'documentation',
  'meeting',
  'outreach',
  'travel',
  'other',
];

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function toCSV(rows: TimeEntry[]) {
  const headers = [
    'date',
    'case_manager',
    'case_manager_email',
    'student',
    'student_email',
    'organization',
    'service_type',
    'start_time',
    'end_time',
    'duration_hours',
    'billable',
    'status',
    'review_note',
    'notes',
  ];
  const escape = (v: any) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.entry_date,
      r.case_manager_name ?? '',
      r.case_manager_email ?? '',
      r.student_name ?? '',
      r.student_email ?? '',
      r.organization_name ?? '',
      r.service_type,
      r.start_time,
      r.end_time,
      (r.duration_minutes / 60).toFixed(2),
      r.billable ? 'yes' : 'no',
      r.status,
      r.review_note ?? '',
      r.notes ?? '',
    ]
      .map(escape)
      .join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}

export default function TimeTrackingAdmin() {
  const { toast } = useToast();
  const { data: users } = useUsers();
  const { data: orgs } = useTrainingOrganizations();

  const caseManagers = useMemo(
    () => (users ?? []).filter((u) => u.role === 'case_manager' || u.role === 'admin'),
    [users],
  );
  const students = useMemo(
    () => (users ?? []).filter((u) => u.role === 'student'),
    [users],
  );

  const [filters, setFilters] = useState<TimeEntryFilters>({ status: 'all', billable: 'all' });
  const { data: entries = [], isLoading } = useTimeEntries(filters);

  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [viewing, setViewing] = useState<TimeEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<{ entry: TimeEntry; status: 'approved' | 'rejected' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const updateEntry = useUpdateTimeEntry();
  const reviewEntry = useReviewTimeEntry();
  const createEntry = useCreateTimeEntry();

  const totalHours = entries.reduce((acc, e) => acc + e.duration_minutes, 0) / 60;
  const pendingCount = entries.filter((e) => e.status === 'pending').length;
  const billableHours =
    entries.filter((e) => e.billable).reduce((acc, e) => acc + e.duration_minutes, 0) / 60;

  const toggleAll = () => {
    if (selected.size === entries.length) setSelected(new Set());
    else setSelected(new Set(entries.map((e) => e.id)));
  };

  const handleBulkApprove = async () => {
    const ids = entries.filter((e) => selected.has(e.id) && e.status === 'pending').map((e) => e.id);
    if (ids.length === 0) {
      toast({ title: 'No pending entries selected' });
      return;
    }
    try {
      await Promise.all(
        ids.map((id) => reviewEntry.mutateAsync({ id, status: 'approved' })),
      );
      toast({ title: `Approved ${ids.length} entries` });
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleReview = async () => {
    if (!reviewing) return;
    try {
      await reviewEntry.mutateAsync({
        id: reviewing.entry.id,
        status: reviewing.status,
        review_note: reviewNote || undefined,
      });
      toast({ title: `Entry ${reviewing.status}` });
      setReviewing(null);
      setReviewNote('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const csv = toCSV(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-entries-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <PageHeader
            title="Time Reports"
            description="Review, edit, approve, and export case manager time entries."
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBulkApprove} disabled={selected.size === 0}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Approve selected ({selected.size})
            </Button>
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add entry
            </Button>
            <Button onClick={handleExport} disabled={entries.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total hours</CardDescription>
              <CardTitle className="text-3xl">{totalHours.toFixed(1)}h</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Billable hours</CardDescription>
              <CardTitle className="text-3xl">{billableHours.toFixed(1)}h</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending review</CardDescription>
              <CardTitle className="text-3xl">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Case manager</Label>
              <Select
                value={filters.caseManagerId ?? 'all'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, caseManagerId: v === 'all' ? undefined : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {caseManagers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Organization</Label>
              <Select
                value={filters.organizationId ?? 'all'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, organizationId: v === 'all' ? undefined : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {(orgs ?? []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={filters.status ?? 'all'}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Billable</Label>
              <Select
                value={filters.billable ?? 'all'}
                onValueChange={(v) => setFilters((f) => ({ ...f, billable: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Billable</SelectItem>
                  <SelectItem value="false">Non-billable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={filters.startDate ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={filters.endDate ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entries ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No entries match your filters.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selected.size === entries.length && entries.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Case manager</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Billable</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(e.id)}
                            onCheckedChange={() => {
                              const s = new Set(selected);
                              if (s.has(e.id)) s.delete(e.id);
                              else s.add(e.id);
                              setSelected(s);
                            }}
                          />
                        </TableCell>
                        <TableCell>{format(parseISO(e.entry_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-sm">
                          {e.case_manager_name || e.case_manager_email || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.student_name || e.student_email || '—'}
                        </TableCell>
                        <TableCell className="capitalize text-sm">
                          {e.service_type.replace('_', ' ')}
                        </TableCell>
                        <TableCell>{formatDuration(e.duration_minutes)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[e.status]}>{e.status}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {e.billable ? 'Yes' : 'No'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setViewing(e)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {e.status === 'pending' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-emerald-600"
                                  onClick={() => setReviewing({ entry: e, status: 'approved' })}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-rose-600"
                                  onClick={() => setReviewing({ entry: e, status: 'rejected' })}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      {editing && (
        <EditDialog
          entry={editing}
          caseManagers={caseManagers}
          students={students}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            try {
              await updateEntry.mutateAsync({ id: editing.id, patch });
              toast({ title: 'Entry updated' });
              setEditing(null);
            } catch (e: any) {
              toast({ title: 'Error', description: e.message, variant: 'destructive' });
            }
          }}
          saving={updateEntry.isPending}
        />
      )}

      {/* Create dialog */}
      {creating && (
        <CreateDialog
          caseManagers={caseManagers}
          students={students}
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            try {
              await createEntry.mutateAsync(input);
              toast({ title: 'Entry created' });
              setCreating(false);
            } catch (e: any) {
              toast({ title: 'Error', description: e.message, variant: 'destructive' });
            }
          }}
          saving={createEntry.isPending}
        />
      )}

      {/* View / audit drawer */}
      {viewing && <ViewDialog entry={viewing} onClose={() => setViewing(null)} />}

      {/* Review dialog */}
      {reviewing && (
        <Dialog open onOpenChange={() => setReviewing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewing.status === 'approved' ? 'Approve' : 'Reject'} time entry
              </DialogTitle>
              <DialogDescription>
                {format(parseISO(reviewing.entry.entry_date), 'MMM d, yyyy')} •{' '}
                {formatDuration(reviewing.entry.duration_minutes)} •{' '}
                {reviewing.entry.case_manager_name || reviewing.entry.case_manager_email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Review note (optional)</Label>
              <Textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Add a note for the case manager..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewing(null)}>
                Cancel
              </Button>
              <Button onClick={handleReview} disabled={reviewEntry.isPending}>
                {reviewEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SidebarLayout>
  );
}

function EditDialog({
  entry,
  caseManagers,
  students,
  onClose,
  onSave,
  saving,
}: {
  entry: TimeEntry;
  caseManagers: import('@/hooks/useUsers').UserWithRole[];
  students: import('@/hooks/useUsers').UserWithRole[];
  onClose: () => void;
  onSave: (patch: Partial<TimeEntry>) => void;
  saving: boolean;
}) {
  const [caseManagerId, setCaseManagerId] = useState(entry.case_manager_id);
  const [studentId, setStudentId] = useState<string>(entry.student_id ?? 'none');
  const [start, setStart] = useState(entry.start_time.slice(0, 16));
  const [end, setEnd] = useState(entry.end_time.slice(0, 16));
  const [serviceType, setServiceType] = useState(entry.service_type);
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [billable, setBillable] = useState(entry.billable);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>(entry.status);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit time entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Case manager</Label>
              <Select value={caseManagerId} onValueChange={setCaseManagerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {caseManagers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Student (optional)</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {students.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Service type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="billable" checked={billable} onCheckedChange={(c) => setBillable(!!c)} />
            <Label htmlFor="billable">Billable</Label>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={() => {
              const [startDate, startClock] = start.split('T');
              const [, endClock] = end.split('T');
              onSave({
                case_manager_id: caseManagerId,
                student_id: studentId === 'none' ? null : studentId,
                start_time: `${startClock}:00`,
                end_time: `${endClock}:00`,
                entry_date: startDate,
                service_type: serviceType,
                notes,
                billable,
                status,
              } as any);
            }}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({
  caseManagers,
  students,
  onClose,
  onSave,
  saving,
}: {
  caseManagers: import('@/hooks/useUsers').UserWithRole[];
  students: import('@/hooks/useUsers').UserWithRole[];
  onClose: () => void;
  onSave: (input: {
    case_manager_id: string;
    student_id?: string | null;
    service_type: string;
    start_time: string;
    end_time: string;
    entry_date: string;
    notes?: string | null;
    billable?: boolean;
    status?: 'pending' | 'approved' | 'rejected';
  }) => void;
  saving: boolean;
}) {
  const today = format(new Date(), "yyyy-MM-dd'T'HH:mm");
  const [caseManagerId, setCaseManagerId] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('none');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [serviceType, setServiceType] = useState('case_management');
  const [notes, setNotes] = useState('');
  const [billable, setBillable] = useState(true);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');

  const valid =
    !!caseManagerId && !!start && !!end && new Date(end) > new Date(start);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add time entry</DialogTitle>
          <DialogDescription>
            Log time on behalf of a case manager. Set status to Approved to skip review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Case manager *</Label>
              <Select value={caseManagerId} onValueChange={setCaseManagerId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {caseManagers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Student (optional)</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {students.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start *</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">End *</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Service type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="create-billable" checked={billable} onCheckedChange={(c) => setBillable(!!c)} />
            <Label htmlFor="create-billable">Billable</Label>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving || !valid}
            onClick={() => {
              const [startDate, startClock] = start.split('T');
              const [, endClock] = end.split('T');
              onSave({
                case_manager_id: caseManagerId,
                student_id: studentId === 'none' ? null : studentId,
                service_type: serviceType,
                start_time: `${startClock}:00`,
                end_time: `${endClock}:00`,
                entry_date: startDate,
                notes: notes || null,
                billable,
                status,
              });
            }}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function safeFormat(value: unknown, fmt: string): string {
  if (!value) return '—';
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : (value as Date);
  if (!d || isNaN(d.getTime())) return '—';
  return format(d, fmt);
}

function ViewDialog({ entry, onClose }: { entry: TimeEntry; onClose: () => void }) {
  const { data: audit = [] } = useTimeEntryAudit(entry.id);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Time entry details</DialogTitle>
          <DialogDescription>
            {safeFormat(entry.entry_date, 'PP')} •{' '}
            {entry.case_manager_name || entry.case_manager_email}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Start" value={safeFormat(entry.start_time, 'PPp')} />
          <Field label="End" value={safeFormat(entry.end_time, 'PPp')} />
          <Field label="Duration" value={formatDuration(entry.duration_minutes)} />
          <Field label="Service" value={entry.service_type.replace('_', ' ')} />
          <Field label="Billable" value={entry.billable ? 'Yes' : 'No'} />
          <Field label="Status" value={entry.status} />
          {entry.student_name && <Field label="Student" value={entry.student_name} />}
          {entry.organization_name && (
            <Field label="Organization" value={entry.organization_name} />
          )}
        </div>
        {entry.notes && (
          <div>
            <Label className="text-xs">Notes</Label>
            <p className="text-sm bg-muted/40 p-2 rounded">{entry.notes}</p>
          </div>
        )}
        {entry.review_note && (
          <div>
            <Label className="text-xs">Review note</Label>
            <p className="text-sm bg-muted/40 p-2 rounded">{entry.review_note}</p>
          </div>
        )}
        <div>
          <Label className="text-xs">Audit history</Label>
          <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1 text-xs">
            {audit.length === 0 ? (
              <p className="text-muted-foreground">No history.</p>
            ) : (
              audit.map((a: any) => (
                <div key={a.id} className="flex justify-between">
                  <span className="capitalize">{a.action}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(a.created_at), 'PPp')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="capitalize">{value}</p>
    </div>
  );
}
