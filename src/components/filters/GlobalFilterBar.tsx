import { GraduationCap, Calendar, Building2, Activity, UserCog, Users, X, BookOpen, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGlobalFilters, FilterKey } from '@/contexts/GlobalFiltersContext';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useAuth } from '@/contexts/AuthContext';
import { FilterMultiSelect, FilterOption } from './FilterMultiSelect';

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ROLE_OPTIONS: FilterOption[] = [
  { value: 'student', label: 'Student' },
  { value: 'case_manager', label: 'Case Manager' },
  { value: 'admin', label: 'Admin' },
];

const STUDENT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export type FilterField = FilterKey;

interface Props {
  /** Which filters to show on this page. */
  visible?: FilterField[];
  className?: string;
}

const ALL: FilterField[] = [
  'organizationId',
  'cohort',
  'program',
  'yearOfStudy',
  'assignedCaseManagerId',
  'studentStatus',
  'status',
  'role',
];

export function GlobalFilterBar({ visible = ALL, className }: Props) {
  const { filters, setFilter, resetAll, activeCount } = useGlobalFilters();
  const { role } = useAuth();
  const { data: opts } = useFilterOptions();

  // Hide admin-only filters for non-admins
  const effectiveVisible = visible.filter((f) => {
    if (f === 'role' && role !== 'admin') return false;
    if (f === 'assignedCaseManagerId' && role !== 'admin' && role !== 'org_admin') return false;
    return true;
  });

  if (effectiveVisible.length === 0) return null;

  const lookup = (key: FilterKey, value: string): string => {
    if (key === 'organizationId') return opts?.organizations.find((o) => o.value === value)?.label || value;
    if (key === 'assignedCaseManagerId') return opts?.caseManagers.find((o) => o.value === value)?.label || value;
    if (key === 'cohort') return opts?.cohorts.find((o) => o.value === value)?.label || value;
    if (key === 'status') return STATUS_OPTIONS.find((o) => o.value === value)?.label || value;
    if (key === 'role') return ROLE_OPTIONS.find((o) => o.value === value)?.label || value;
    if (key === 'studentStatus') return STUDENT_STATUS_OPTIONS.find((o) => o.value === value)?.label || value;
    if (key === 'program') return value;
    return value;
  };

  const renderFilter = (f: FilterField) => {
    switch (f) {
      case 'cohort':
        return <FilterMultiSelect key={f} label="Cohort" icon={<GraduationCap className="h-3.5 w-3.5" />} options={opts?.cohorts || []} selected={filters.cohort} onChange={(v) => setFilter('cohort', v)} />;
      case 'yearOfStudy':
        return <FilterMultiSelect key={f} label="Year" icon={<Calendar className="h-3.5 w-3.5" />} options={opts?.yearsOfStudy || []} selected={filters.yearOfStudy} onChange={(v) => setFilter('yearOfStudy', v)} />;
      case 'organizationId':
        return <FilterMultiSelect key={f} label="Organization" icon={<Building2 className="h-3.5 w-3.5" />} options={opts?.organizations || []} selected={filters.organizationId} onChange={(v) => setFilter('organizationId', v)} />;
      case 'status':
        return <FilterMultiSelect key={f} label="Request Status" icon={<Activity className="h-3.5 w-3.5" />} options={STATUS_OPTIONS} selected={filters.status} onChange={(v) => setFilter('status', v)} />;
      case 'role':
        return <FilterMultiSelect key={f} label="Role" icon={<Users className="h-3.5 w-3.5" />} options={ROLE_OPTIONS} selected={filters.role} onChange={(v) => setFilter('role', v)} />;
      case 'assignedCaseManagerId':
        return <FilterMultiSelect key={f} label="Case Manager" icon={<UserCog className="h-3.5 w-3.5" />} options={opts?.caseManagers || []} selected={filters.assignedCaseManagerId} onChange={(v) => setFilter('assignedCaseManagerId', v)} />;
      case 'program':
        return <FilterMultiSelect key={f} label="Program" icon={<BookOpen className="h-3.5 w-3.5" />} options={opts?.programs || []} selected={filters.program} onChange={(v) => setFilter('program', v)} />;
      case 'studentStatus':
        return <FilterMultiSelect key={f} label="Student Status" icon={<UserCheck className="h-3.5 w-3.5" />} options={STUDENT_STATUS_OPTIONS} selected={filters.studentStatus} onChange={(v) => setFilter('studentStatus', v)} />;
    }
  };

  // Build active chips
  const chips: { key: FilterKey; value: string; label: string }[] = [];
  effectiveVisible.forEach((f) => {
    filters[f].forEach((v) => chips.push({ key: f, value: v, label: lookup(f, v) }));
  });

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {effectiveVisible.map(renderFilter)}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="rounded-full h-9 text-muted-foreground" onClick={resetAll}>
            Reset all
          </Button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Badge key={`${c.key}-${c.value}`} variant="secondary" className="rounded-full gap-1 pr-1">
              <span className="text-xs">{c.label}</span>
              <button
                onClick={() => {
                  const next = filters[c.key].filter((v) => v !== c.value);
                  setFilter(c.key, next);
                }}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                aria-label={`Remove ${c.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
