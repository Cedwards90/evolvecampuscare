import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Building2,
  Calendar as CalendarIcon,
  GraduationCap,
  UserCheck,
  UserCog,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useMyOrgAdminOrgs } from '@/hooks/useOrgAdmins';
import {
  FilterMultiSelect,
  type FilterOption,
} from '@/components/filters/FilterMultiSelect';
import type {
  ReportStudentFilters,
  StudentStatusFilter,
} from '@/hooks/useReportStudentFilters';
import {
  getStudentReportPresetRange,
  type StudentReportPreset,
} from '@/hooks/useStudentProgressReport';

const STATUS_OPTIONS: { value: StudentStatusFilter; label: string }[] = [
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
  { value: 'all', label: 'All statuses' },
];

const PRESETS: { key: Exclude<StudentReportPreset, 'custom'>; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

interface Props {
  filters: ReportStudentFilters;
  setFilter: <K extends keyof ReportStudentFilters>(
    key: K,
    value: ReportStudentFilters[K],
  ) => void;
  resetFilters: () => void;
  preset: StudentReportPreset;
  from: Date;
  to: Date;
  onPresetChange: (p: Exclude<StudentReportPreset, 'custom'>) => void;
  onRangeChange: (from: Date, to: Date) => void;
  totalCount: number;
  matchingCount: number;
}

export function ReportFilters({
  filters,
  setFilter,
  resetFilters,
  preset,
  from,
  to,
  onPresetChange,
  onRangeChange,
  totalCount,
  matchingCount,
}: Props) {
  const { role } = useAuth();
  const { data: opts } = useFilterOptions();
  const { data: orgAdminOrgs } = useMyOrgAdminOrgs();

  // Scope org options by role
  const organizationOptions: FilterOption[] = useMemo(() => {
    const all = opts?.organizations ?? [];
    if (role === 'org_admin') {
      const allowed = new Set(orgAdminOrgs ?? []);
      return all.filter((o) => allowed.has(o.value));
    }
    return all;
  }, [opts?.organizations, role, orgAdminOrgs]);

  const showCaseManagerFilter = role === 'admin' || role === 'org_admin';

  const activeFilterCount =
    filters.organizationIds.length +
    filters.cohorts.length +
    filters.yearsOfStudy.length +
    filters.caseManagerIds.length +
    (filters.status !== 'active' ? 1 : 0);

  const lookupCm = (id: string) =>
    opts?.caseManagers.find((o) => o.value === id)?.label ?? id;
  const lookupOrg = (id: string) =>
    organizationOptions.find((o) => o.value === id)?.label ?? id;

  return (
    <div className="space-y-3">
      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Report period:</span>
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            type="button"
            size="sm"
            variant={preset === p.key ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => onPresetChange(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={preset === 'custom' ? 'default' : 'outline'}
              className="rounded-full gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              {preset === 'custom'
                ? `${format(from, 'PP')} – ${format(to, 'PP')}`
                : 'Custom range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from, to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onRangeChange(range.from, range.to);
                }
              }}
              numberOfMonths={2}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Student-scope filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Filter students:</span>

        <FilterMultiSelect
          label="Organization"
          icon={<Building2 className="h-3.5 w-3.5" />}
          options={organizationOptions}
          selected={filters.organizationIds}
          onChange={(v) => setFilter('organizationIds', v)}
        />

        <FilterMultiSelect
          label="Class"
          icon={<GraduationCap className="h-3.5 w-3.5" />}
          options={opts?.cohorts ?? []}
          selected={filters.cohorts}
          onChange={(v) => setFilter('cohorts', v)}
        />

        <FilterMultiSelect
          label="Year"
          icon={<CalendarIcon className="h-3.5 w-3.5" />}
          options={opts?.yearsOfStudy ?? []}
          selected={filters.yearsOfStudy}
          onChange={(v) => setFilter('yearsOfStudy', v)}
        />

        {showCaseManagerFilter && (
          <FilterMultiSelect
            label="Case Manager"
            icon={<UserCog className="h-3.5 w-3.5" />}
            options={opts?.caseManagers ?? []}
            selected={filters.caseManagerIds}
            onChange={(v) => setFilter('caseManagerIds', v)}
          />
        )}

        <div className="flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={filters.status}
            onValueChange={(v) => setFilter('status', v as StudentStatusFilter)}
          >
            <SelectTrigger className="h-9 w-[150px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-9 text-muted-foreground"
            onClick={resetFilters}
          >
            Reset filters
          </Button>
        )}

        <Badge variant="secondary" className="rounded-full ml-auto">
          {matchingCount} of {totalCount} students
        </Badge>
      </div>

      {/* Active chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.organizationIds.map((v) => (
            <Chip
              key={`org-${v}`}
              label={lookupOrg(v)}
              onRemove={() =>
                setFilter(
                  'organizationIds',
                  filters.organizationIds.filter((x) => x !== v),
                )
              }
            />
          ))}
          {filters.cohorts.map((v) => (
            <Chip
              key={`cohort-${v}`}
              label={`Class of ${v}`}
              onRemove={() =>
                setFilter('cohorts', filters.cohorts.filter((x) => x !== v))
              }
            />
          ))}
          {filters.yearsOfStudy.map((v) => (
            <Chip
              key={`yr-${v}`}
              label={v}
              onRemove={() =>
                setFilter(
                  'yearsOfStudy',
                  filters.yearsOfStudy.filter((x) => x !== v),
                )
              }
            />
          ))}
          {filters.caseManagerIds.map((v) => (
            <Chip
              key={`cm-${v}`}
              label={lookupCm(v)}
              onRemove={() =>
                setFilter(
                  'caseManagerIds',
                  filters.caseManagerIds.filter((x) => x !== v),
                )
              }
            />
          ))}
          {filters.status !== 'active' && (
            <Chip
              label={
                STATUS_OPTIONS.find((s) => s.value === filters.status)?.label ??
                filters.status
              }
              onRemove={() => setFilter('status', 'active')}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="rounded-full gap-1 pr-1">
      <span className="text-xs">{label}</span>
      <button
        onClick={onRemove}
        className="hover:bg-muted-foreground/20 rounded-full p-0.5"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

export { getStudentReportPresetRange };
