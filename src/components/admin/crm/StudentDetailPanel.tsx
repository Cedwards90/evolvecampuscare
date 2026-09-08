import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ExternalLink, Pencil } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEditProfile } from '@/hooks/useEditProfile';
import { useAssignStudentCohort } from '@/hooks/useCohorts';
import { useBulkAssignOrganization } from '@/hooks/useTrainingOrganizations';
import { useAssignStudent } from '@/hooks/useStudentAssignments';
import { useSetUserActive } from '@/hooks/useUsers';
import { formatCurrency } from '@/lib/utils';
import type { StudentCrmRow } from '@/hooks/useStudentCrm';
import { displayName, legalName, fullAddress } from './crmColumns';

interface StudentDetailPanelProps {
  row: StudentCrmRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: { id: string; name: string }[];
  cohorts: { id: string; name: string; organization_id: string }[];
  caseManagers: { value: string; label: string }[];
  canSeeSensitive: boolean;
  canManageEnrollment: boolean;
  onEditProfile: (row: StudentCrmRow) => void;
}

export function StudentDetailPanel({
  row,
  open,
  onOpenChange,
  organizations,
  cohorts,
  caseManagers,
  canSeeSensitive,
  canManageEnrollment,
  onEditProfile,
}: StudentDetailPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const editProfile = useEditProfile();
  const assignCohort = useAssignStudentCohort();
  const assignOrg = useBulkAssignOrganization();
  const assignCm = useAssignStudent();
  const setActive = useSetUserActive();

  const [dates, setDates] = useState({ cohort_start_date: '', graduation_date: '', placement_date: '' });
  const [statusReason, setStatusReason] = useState('');

  useEffect(() => {
    if (row) {
      setDates({
        cohort_start_date: row.cohort_start_date ?? '',
        graduation_date: row.graduation_date ?? '',
        placement_date: row.placement_date ?? '',
      });
      setStatusReason('');
    }
  }, [row]);

  if (!row) return null;

  const orgCohorts = cohorts.filter((c) => !row.organization_id || c.organization_id === row.organization_id);

  const handleClassChange = async (value: string) => {
    try {
      await assignCohort.mutateAsync({ studentId: row.user_id, cohortId: value === 'none' ? null : value });
      toast({ title: 'Class updated' });
    } catch (e: any) {
      toast({ title: 'Could not change class', description: e?.message, variant: 'destructive' });
    }
  };

  const handleOrgChange = async (value: string) => {
    try {
      await assignOrg.mutateAsync({ organizationId: value, userIds: [row.user_id] });
      toast({ title: 'Organization updated' });
    } catch (e: any) {
      toast({ title: 'Could not change organization', description: e?.message, variant: 'destructive' });
    }
  };

  const handleCmChange = async (value: string) => {
    if (!user) return;
    try {
      await assignCm.mutateAsync({ studentId: row.user_id, caseManagerId: value, assignedBy: user.id });
    } catch {
      /* hook toasts on error */
    }
  };

  const handleSaveDates = async () => {
    try {
      await editProfile.mutateAsync({
        userId: row.user_id,
        changes: {
          cohort_start_date: dates.cohort_start_date || null,
          graduation_date: dates.graduation_date || null,
          placement_date: dates.placement_date || null,
        },
      });
      toast({ title: 'Program dates saved' });
    } catch (e: any) {
      toast({ title: 'Could not save dates', description: e?.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async () => {
    try {
      await setActive.mutateAsync({ userId: row.user_id, active: !row.is_active, reason: statusReason || undefined });
      toast({ title: row.is_active ? 'Enrollment deactivated' : 'Enrollment reactivated' });
      setStatusReason('');
    } catch (e: any) {
      toast({ title: 'Could not update enrollment', description: e?.message, variant: 'destructive' });
    }
  };

  const legal = legalName(row);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="break-words">{displayName(row)}</SheetTitle>
          <SheetDescription className="break-all">{row.email}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onEditProfile(row)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit details
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/students/${row.user_id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Full student file
            </Link>
          </Button>
          <Badge variant={row.is_active ? 'outline' : 'secondary'}>
            {row.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <Separator className="my-4" />

        {/* Record summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Student ID" value={row.student_id} />
          <Field label="Phone" value={row.phone} />
          {legal && <Field label="Legal name" value={legal} />}
          {canSeeSensitive && <Field label="Age" value={row.age !== null ? String(row.age) : null} />}
          {canSeeSensitive && (
            <Field label="Date of birth" value={row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString() : null} />
          )}
          <Field label="Program" value={row.department} />
          <Field label="Year" value={row.year_of_study} />
          {canSeeSensitive && (
            <div className="col-span-2">
              <Field label="Address" value={fullAddress(row) || null} />
            </div>
          )}
          {!row.is_active && row.deactivation_reason && (
            <div className="col-span-2">
              <Field label="Deactivation reason" value={row.deactivation_reason} />
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Placement in program */}
        <h3 className="text-sm font-semibold mb-3">Class & assignment</h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Organization</Label>
            <Select value={row.organization_id ?? ''} onValueChange={handleOrgChange}>
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Class</Label>
            <Select value={row.cohort_id ?? 'none'} onValueChange={handleClassChange} disabled={!row.organization_id}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No class</SelectItem>
                {orgCohorts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!row.organization_id && (
              <p className="text-xs text-muted-foreground">Assign an organization first.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Case manager</Label>
            <Select value={row.case_manager_id ?? ''} onValueChange={handleCmChange}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {caseManagers.map((cm) => (
                  <SelectItem key={cm.value} value={cm.value}>{cm.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Program dates */}
        <h3 className="text-sm font-semibold mb-3">Program dates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="crm-start">Class start</Label>
            <Input
              id="crm-start"
              type="date"
              value={dates.cohort_start_date}
              onChange={(e) => setDates((d) => ({ ...d, cohort_start_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="crm-grad">Graduation</Label>
            <Input
              id="crm-grad"
              type="date"
              value={dates.graduation_date}
              onChange={(e) => setDates((d) => ({ ...d, graduation_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="crm-place">Placement</Label>
            <Input
              id="crm-place"
              type="date"
              value={dates.placement_date}
              onChange={(e) => setDates((d) => ({ ...d, placement_date: e.target.value }))}
            />
          </div>
        </div>
        <Button size="sm" className="mt-3" onClick={handleSaveDates} disabled={editProfile.isPending}>
          {editProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save dates
        </Button>

        {canManageEnrollment && (
          <>
            <Separator className="my-4" />
            <h3 className="text-sm font-semibold mb-3">Enrollment status</h3>
            <div className="space-y-2">
              <Label htmlFor="crm-reason">Reason (recorded in the status history)</Label>
              <Textarea
                id="crm-reason"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder={row.is_active ? 'Why is this student being deactivated?' : 'Why are they returning?'}
                rows={2}
              />
              <Button
                variant={row.is_active ? 'destructive' : 'default'}
                size="sm"
                onClick={handleToggleActive}
                disabled={setActive.isPending}
              >
                {setActive.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {row.is_active ? 'Deactivate enrollment' : 'Reactivate enrollment'}
              </Button>
            </div>
          </>
        )}

        <Separator className="my-4" />

        {/* Funding */}
        <h3 className="text-sm font-semibold mb-1">Support requests & funding</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Total dispersed: <strong>{formatCurrency(row.dispersed)}</strong> across {row.total_requests} request
          {row.total_requests === 1 ? '' : 's'} ({row.open_requests} open).
        </p>
        {row.requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
        ) : (
          <ul className="space-y-2">
            {row.requests.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/requests/${r.id}`} className="font-medium hover:underline break-words">
                    {r.title}
                  </Link>
                  <span className="tabular-nums">
                    {r.approved_amount ? formatCurrency(r.approved_amount) : '—'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 break-words">
                  {r.category.replace('_', ' ')} · {r.status.replace('_', ' ')}
                  {r.approval_status ? ` · ${r.approval_status.replace('_', ' ')}` : ''} ·{' '}
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.requested_amount ? ` · requested ${formatCurrency(r.requested_amount)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words">{value || '—'}</p>
    </div>
  );
}
