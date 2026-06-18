import { GlobalFilters } from '@/contexts/GlobalFiltersContext';
import type { SupportRequest } from '@/types/database';

/** Narrow support_requests by the global filter selections (client-side). */
export function applyToRequests(rows: SupportRequest[], f: GlobalFilters): SupportRequest[] {
  return rows.filter((r) => {
    if (f.status.length && !f.status.includes(r.status)) return false;
    if (f.assignedCaseManagerId.length) {
      if (!r.assigned_case_manager_id || !f.assignedCaseManagerId.includes(r.assigned_case_manager_id)) return false;
    }
    const s: any = r.student;
    if (f.organizationId.length) {
      if (!s?.organization_id || !f.organizationId.includes(s.organization_id)) return false;
    }
    if (f.cohort.length) {
      if (!s?.cohort_id || !f.cohort.includes(s.cohort_id)) return false;
    }
    if (f.yearOfStudy.length) {
      if (!s?.year_of_study || !f.yearOfStudy.includes(s.year_of_study)) return false;
    }
    return true;
  });
}

/** Narrow generic profile-shaped rows. */
export function applyToProfiles<T extends {
  user_id?: string;
  organization_id?: string | null;
  cohort_id?: string | null;
  year_of_study?: string | null;
  role?: string;
}>(rows: T[], f: GlobalFilters): T[] {
  return rows.filter((r) => {
    if (f.role.length && r.role && !f.role.includes(r.role)) return false;
    if (f.organizationId.length) {
      if (!r.organization_id || !f.organizationId.includes(r.organization_id)) return false;
    }
    if (f.cohort.length) {
      if (!r.cohort_id || !f.cohort.includes(r.cohort_id)) return false;
    }
    if (f.yearOfStudy.length) {
      if (!r.year_of_study || !f.yearOfStudy.includes(r.year_of_study)) return false;
    }
    return true;
  });
}

/** Narrow rows that only carry an organization_id (training_organizations, invitations). */
export function applyOrgOnly<T extends { organization_id?: string | null; id?: string }>(
  rows: T[],
  f: GlobalFilters,
  idIsOrg = false,
): T[] {
  if (f.organizationId.length === 0) return rows;
  return rows.filter((r) => {
    const orgId = idIsOrg ? r.id : r.organization_id;
    return !!orgId && f.organizationId.includes(orgId);
  });
}
