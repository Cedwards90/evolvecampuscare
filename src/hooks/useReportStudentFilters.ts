import { useMemo, useState, useCallback } from 'react';
import { useStudentAssignments, type StudentAssignment } from '@/hooks/useStudentAssignments';
import { useAuth } from '@/contexts/AuthContext';
import { useMyOrgAdminOrgs } from '@/hooks/useOrgAdmins';

export type StudentStatusFilter = 'active' | 'inactive' | 'all';

export interface ReportStudentFilters {
  organizationIds: string[];
  cohorts: string[]; // string years e.g. "2024"
  yearsOfStudy: string[];
  caseManagerIds: string[];
  status: StudentStatusFilter;
}

export const DEFAULT_REPORT_FILTERS: ReportStudentFilters = {
  organizationIds: [],
  cohorts: [],
  yearsOfStudy: [],
  caseManagerIds: [],
  status: 'active',
};

export interface UseReportStudentFiltersResult {
  filters: ReportStudentFilters;
  setFilter: <K extends keyof ReportStudentFilters>(key: K, value: ReportStudentFilters[K]) => void;
  resetFilters: () => void;
  /** Unique assigned-student rows, deduped by student_id, after RLS + role + filter scoping. */
  filteredStudents: StudentAssignment[];
  /** Total students visible to the user before filters (deduped). */
  totalCount: number;
  /** Students after applying filters. */
  matchingCount: number;
  /** True while base assignments query is loading. */
  isLoading: boolean;
}

/**
 * Centralized filter state + derived student list for the Student Progress
 * Reports page. RLS already scopes which students the user can see; this
 * layer adds optional role-aware constraints (case manager -> own caseload,
 * org admin -> only orgs they administer) and the user-selected filters.
 */
export function useReportStudentFilters(
  initial?: Partial<ReportStudentFilters>,
): UseReportStudentFiltersResult {
  const { user, role } = useAuth();
  const { data: assignments, isLoading } = useStudentAssignments();
  const { data: orgAdminOrgs } = useMyOrgAdminOrgs();

  const [filters, setFilters] = useState<ReportStudentFilters>({
    ...DEFAULT_REPORT_FILTERS,
    ...initial,
  });

  const setFilter = useCallback(
    <K extends keyof ReportStudentFilters>(key: K, value: ReportStudentFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_REPORT_FILTERS), []);

  // Base list scoped by role
  const baseList = useMemo<StudentAssignment[]>(() => {
    const list = assignments ?? [];

    // Dedupe by student_id (a student should only have one active assignment,
    // but data may have legacy rows).
    const seen = new Set<string>();
    const deduped = list.filter((a) => {
      if (!a.student) return false;
      if (seen.has(a.student_id)) return false;
      seen.add(a.student_id);
      return true;
    });

    if (!user) return [];
    if (role === 'case_manager') {
      return deduped.filter((a) => a.case_manager_id === user.id);
    }
    if (role === 'org_admin') {
      const allowed = new Set(orgAdminOrgs ?? []);
      if (allowed.size === 0) return [];
      return deduped.filter(
        (a) => a.student?.organization_id && allowed.has(a.student.organization_id),
      );
    }
    // admin (and any other elevated role) sees everything RLS returns
    return deduped;
  }, [assignments, user, role, orgAdminOrgs]);

  const filteredStudents = useMemo(() => {
    return baseList.filter((a) => {
      const p = a.student;
      if (!p) return false;

      if (filters.organizationIds.length > 0) {
        if (!p.organization_id || !filters.organizationIds.includes(p.organization_id))
          return false;
      }

      if (filters.cohorts.length > 0) {
        if (!p.cohort_start_date) return false;
        const y = String(new Date(p.cohort_start_date).getUTCFullYear());
        if (!filters.cohorts.includes(y)) return false;
      }

      if (filters.yearsOfStudy.length > 0) {
        if (!p.year_of_study || !filters.yearsOfStudy.includes(p.year_of_study))
          return false;
      }

      if (filters.caseManagerIds.length > 0) {
        if (!filters.caseManagerIds.includes(a.case_manager_id)) return false;
      }

      const isActive = !p.deactivated_at;
      if (filters.status === 'active' && !isActive) return false;
      if (filters.status === 'inactive' && isActive) return false;

      return true;
    });
  }, [baseList, filters]);

  return {
    filters,
    setFilter,
    resetFilters,
    filteredStudents,
    totalCount: baseList.length,
    matchingCount: filteredStudents.length,
    isLoading,
  };
}
