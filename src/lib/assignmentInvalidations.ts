import type { QueryClient } from '@tanstack/react-query';

/**
 * Single source of truth for "an assignment changed — refresh anything that
 * shows assignments, workload, folders, or filters anywhere in the app."
 *
 * Call this from every mutation that writes to student_assignments,
 * cohort_case_managers, cohorts, organization_memberships, or org_admins.
 */
export function invalidateAssignmentSurfaces(qc: QueryClient, studentId?: string | null) {
  const keys: any[][] = [
    ['student-assignments'],
    ['unassigned-students'],
    ['my-students'],
    ['my-assignment'],
    ['student-folders'],
    ['case-managers'],
    ['case-manager-stats'],
    ['workload-analytics'],
    ['requests'],
    ['analytics'],
    ['filter-options'],
    ['users-with-roles'],
    ['cohorts'],
    ['org-admins'],
    ['training-orgs'],
  ];
  for (const k of keys) qc.invalidateQueries({ queryKey: k });
  if (studentId) {
    qc.invalidateQueries({ queryKey: ['student-detail', studentId] });
    qc.invalidateQueries({ queryKey: ['student-progress-report', studentId] });
    qc.invalidateQueries({ queryKey: ['profile', studentId] });
  }
}
