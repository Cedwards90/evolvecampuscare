import { useMemo, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useStudentCrm, useStudentInvitationCounts, type StudentCrmRow } from '@/hooks/useStudentCrm';
import { useAllCohorts } from '@/hooks/useCohorts';
import { useTrainingOrganizations } from '@/hooks/useTrainingOrganizations';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useSetUserActive } from '@/hooks/useUsers';
import { EditProfileDialog } from '@/components/profile/EditProfileDialog';
import { CrmSummaryBar } from './CrmSummaryBar';
import { EnrollmentFunnelCard, matchesStage, type FunnelStage } from './EnrollmentFunnelCard';
import { StudentCrmToolbar } from './StudentCrmToolbar';
import { StudentCrmTable } from './StudentCrmTable';
import { StudentDetailPanel } from './StudentDetailPanel';
import { BulkStudentUpdateDialog, type BulkMode } from './BulkStudentUpdateDialog';
import { CRM_COLUMNS, DEFAULT_VISIBLE_COLUMNS, displayName, legalName, fullAddress } from './crmColumns';

const PAGE_SIZE = 25;

export function StudentCrmSection() {
  const { toast } = useToast();
  const { role } = useAuth();
  const { data: rows, isLoading } = useStudentCrm();
  const { data: invitations } = useStudentInvitationCounts();
  const { data: organizations } = useTrainingOrganizations();
  const { data: cohorts } = useAllCohorts();
  const { data: filterOptions } = useFilterOptions();
  const setActive = useSetUserActive();

  const canManageEnrollment = role === 'admin' || role === 'org_admin';
  const canSeeSensitive = role === 'admin' || role === 'org_admin' || role === 'case_manager';

  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [cmFilter, setCmFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stage, setStage] = useState<FunnelStage>('all');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<StudentCrmRow | null>(null);
  const [editRow, setEditRow] = useState<StudentCrmRow | null>(null);
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);

  const orgOptions = (organizations || []).map((o) => ({ id: o.id, name: o.name }));
  const cohortOptions = useMemo(() => {
    const list = (cohorts || []).map((c) => ({ id: c.id, name: c.name, organization_id: c.organization_id }));
    return orgFilter === 'all' ? list : list.filter((c) => c.organization_id === orgFilter);
  }, [cohorts, orgFilter]);
  const cmOptions = filterOptions?.caseManagers ?? [];

  /** Rows after column filters but before the funnel stage filter (drives the funnel counts). */
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (q) {
        const haystack = [r.full_name, r.preferred_name, r.email, r.phone, r.student_id, legalName(r)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (orgFilter !== 'all' && r.organization_id !== orgFilter) return false;
      if (cohortFilter === 'none' ? !!r.cohort_id : cohortFilter !== 'all' && r.cohort_id !== cohortFilter) return false;
      if (cmFilter === 'none' ? !!r.case_manager_id : cmFilter !== 'all' && r.case_manager_id !== cmFilter) return false;
      if (statusFilter === 'active' && !r.is_active) return false;
      if (statusFilter === 'inactive' && r.is_active) return false;
      return true;
    });
  }, [rows, search, orgFilter, cohortFilter, cmFilter, statusFilter]);

  const filtered = useMemo(
    () => (stage === 'all' ? scoped : scoped.filter((r) => matchesStage(r, stage))),
    [scoped, stage],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const toggleColumn = (key: string) =>
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelected((prev) => {
      const allShown = paginated.every((r) => prev.has(r.user_id));
      const next = new Set(prev);
      paginated.forEach((r) => (allShown ? next.delete(r.user_id) : next.add(r.user_id)));
      return next;
    });

  const handleToggleActive = async (row: StudentCrmRow) => {
    try {
      await setActive.mutateAsync({ userId: row.user_id, active: !row.is_active });
      toast({ title: row.is_active ? 'Enrollment deactivated' : 'Enrollment reactivated' });
    } catch (e: any) {
      toast({ title: 'Could not update enrollment', description: e?.message, variant: 'destructive' });
    }
  };

  const exportCsv = () => {
    const cols = CRM_COLUMNS.filter((c) => visibleColumns.includes(c.key) && (canSeeSensitive || !c.sensitive));
    const value = (r: StudentCrmRow, key: string): string => {
      switch (key) {
        case 'name': return displayName(r);
        case 'student_id': return r.student_id ?? '';
        case 'email': return r.email;
        case 'phone': return r.phone ?? '';
        case 'organization': return r.organization_name ?? '';
        case 'cohort': return r.cohort_name ?? '';
        case 'case_manager': return r.case_manager_name ?? '';
        case 'status': return r.is_active ? 'Active' : 'Inactive';
        case 'age': return r.age !== null ? String(r.age) : '';
        case 'date_of_birth': return r.date_of_birth ?? '';
        case 'address': return fullAddress(r);
        case 'cohort_start_date': return r.cohort_start_date ?? '';
        case 'graduation_date': return r.graduation_date ?? '';
        case 'placement_date': return r.placement_date ?? '';
        case 'open_requests': return String(r.open_requests);
        case 'dispersed': return r.dispersed.toFixed(2);
        case 'last_activity': return r.last_activity_at ?? '';
        case 'joined': return r.created_at;
        default: return '';
      }
    };
    const escape = (v: string) => `"${v.split('"').join('""')}"`;
    const lines = [
      cols.map((c) => escape(c.label)).join(','),
      ...filtered.map((r) => cols.map((c) => escape(value(r, c.key))).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedIds = [...selected].filter((id) => filtered.some((r) => r.user_id === id));

  return (
    <div className="space-y-4">
      <CrmSummaryBar rows={filtered} showMoney={canSeeSensitive} />

      <EnrollmentFunnelCard
        rows={scoped}
        stage={stage}
        onStageChange={(s) => {
          setStage(s);
          resetPage();
        }}
        invitations={invitations ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student records
          </CardTitle>
          <CardDescription>
            Every student with their class, enrollment, case manager and funding in one place. Changes are saved
            immediately and recorded in the audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StudentCrmToolbar
            search={search}
            onSearchChange={(v) => { setSearch(v); resetPage(); }}
            orgFilter={orgFilter}
            onOrgFilterChange={(v) => { setOrgFilter(v); setCohortFilter('all'); resetPage(); }}
            organizations={orgOptions}
            cohortFilter={cohortFilter}
            onCohortFilterChange={(v) => { setCohortFilter(v); resetPage(); }}
            cohorts={cohortOptions}
            cmFilter={cmFilter}
            onCmFilterChange={(v) => { setCmFilter(v); resetPage(); }}
            caseManagers={cmOptions}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => { setStatusFilter(v); resetPage(); }}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            canSeeSensitive={canSeeSensitive}
            onExport={exportCsv}
          />

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
              <span className="text-sm font-medium">{selectedIds.length} selected</span>
              <Button size="sm" variant="outline" onClick={() => setBulkMode('class')}>Change class</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkMode('organization')}>Change organization</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkMode('case_manager')}>Reassign case manager</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="font-medium">No students match these filters</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try clearing the search, class or stage filters, or invite a student to get started.
              </p>
            </div>
          ) : (
            <>
              <StudentCrmTable
                rows={paginated}
                visibleColumns={visibleColumns}
                canSeeSensitive={canSeeSensitive}
                canManageEnrollment={canManageEnrollment}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onOpen={setDetailRow}
                onEditProfile={setEditRow}
                onToggleActive={handleToggleActive}
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of{' '}
                  {filtered.length} students
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <StudentDetailPanel
        row={detailRow ? filtered.find((r) => r.user_id === detailRow.user_id) ?? detailRow : null}
        open={!!detailRow}
        onOpenChange={(o) => !o && setDetailRow(null)}
        organizations={orgOptions}
        cohorts={(cohorts || []).map((c) => ({ id: c.id, name: c.name, organization_id: c.organization_id }))}
        caseManagers={cmOptions}
        canSeeSensitive={canSeeSensitive}
        canManageEnrollment={canManageEnrollment}
        onEditProfile={setEditRow}
      />

      {editRow && (
        <EditProfileDialog
          open={!!editRow}
          onOpenChange={(o) => !o && setEditRow(null)}
          userId={editRow.user_id}
          initial={editRow}
          targetLabel={displayName(editRow)}
        />
      )}

      {bulkMode && (
        <BulkStudentUpdateDialog
          open={!!bulkMode}
          onOpenChange={(o) => !o && setBulkMode(null)}
          mode={bulkMode}
          studentIds={selectedIds}
          cohorts={cohortOptions.map((c) => ({ id: c.id, name: c.name }))}
          organizations={orgOptions}
          caseManagers={cmOptions}
          onDone={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
