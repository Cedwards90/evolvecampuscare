import type { QueryClient } from '@tanstack/react-query';

type Row = Record<string, any> | null | undefined;

export interface RouteContext {
  userId?: string;
  role?: string | null;
}

/**
 * Maps a Postgres-changes payload (table, new/old row) to React Query keys
 * that should be invalidated. Centralized so every realtime channel uses
 * the same source of truth.
 */
export function invalidateForChange(
  qc: QueryClient,
  table: string,
  newRow: Row,
  oldRow: Row,
  ctx: RouteContext,
) {
  const row: any = newRow || oldRow || {};
  const inv = (key: any[]) => qc.invalidateQueries({ queryKey: key });
  const studentIds = new Set<string>();
  if (newRow?.student_id) studentIds.add(newRow.student_id);
  if (oldRow?.student_id) studentIds.add(oldRow.student_id);

  switch (table) {
    case 'support_requests': {
      inv(['requests']);
      inv(['my-requests']);
      inv(['request', row.id]);
      inv(['my-students']);
      inv(['case-manager-stats']);
      inv(['analytics']);
      inv(['workload-analytics']);
      inv(['filter-options']);
      inv(['student-progress-report']);
      studentIds.forEach((id) => inv(['student-detail', id]));
      studentIds.forEach((id) => inv(['student-progress-report', id]));
      break;
    }
    case 'request_updates': {
      inv(['request', row.request_id]);
      inv(['requests']);
      inv(['interaction-report']);
      inv(['student-progress-report']);
      break;
    }
    case 'request_attachments': {
      inv(['request', row.request_id]);
      inv(['request-attachments', row.request_id]);
      break;
    }
    case 'request_share_links': {
      inv(['request-shares', row.request_id]);
      inv(['request', row.request_id]);
      break;
    }
    case 'student_assignments': {
      inv(['my-students']);
      inv(['student-folders']);
      inv(['my-assignment']);
      inv(['student-assignments']);
      inv(['case-manager-stats']);
      inv(['workload-analytics']);
      inv(['requests']);
      studentIds.forEach((id) => inv(['student-detail', id]));
      break;
    }
    case 'appointments': {
      inv(['appointments']);
      if (row.case_manager_id) inv(['appointments', row.case_manager_id]);
      if (row.student_id) inv(['appointments', row.student_id]);
      studentIds.forEach((id) => inv(['student-detail', id]));
      studentIds.forEach((id) => inv(['student-progress-report', id]));
      inv(['interaction-report']);
      break;
    }
    case 'file_notes': {
      inv(['file-notes']);
      studentIds.forEach((id) => inv(['file-notes', id]));
      studentIds.forEach((id) => inv(['student-detail', id]));
      studentIds.forEach((id) => inv(['student-progress-report', id]));
      inv(['interaction-report']);
      break;
    }
    case 'student_checkins': {
      inv(['student-checkins']);
      studentIds.forEach((id) => inv(['student-checkins', id]));
      studentIds.forEach((id) => inv(['student-detail', id]));
      studentIds.forEach((id) => inv(['student-progress-report', id]));
      break;
    }
    case 'intake_responses': {
      inv(['intake']);
      studentIds.forEach((id) => inv(['intake', id]));
      studentIds.forEach((id) => inv(['student-detail', id]));
      break;
    }
    case 'post_graduation_plans': {
      inv(['post-grad-plan']);
      studentIds.forEach((id) => inv(['post-grad-plan', id]));
      studentIds.forEach((id) => inv(['student-detail', id]));
      break;
    }
    case 'profiles': {
      inv(['profile', row.user_id]);
      inv(['users']);
      inv(['student-folders']);
      inv(['my-students']);
      if (row.user_id) inv(['student-detail', row.user_id]);
      break;
    }
    case 'organization_memberships':
    case 'org_admins': {
      inv(['org-admins']);
      inv(['users']);
      inv(['student-folders']);
      inv(['training-orgs']);
      break;
    }
    case 'training_organizations': {
      inv(['training-orgs']);
      inv(['org', row.id]);
      inv(['org-name', row.id]);
      break;
    }
    case 'qr_codes': {
      inv(['qr-codes']);
      inv(['qr-code', row.code]);
      break;
    }
    case 'qr_scan_events': {
      inv(['qr-analytics']);
      inv(['qr-codes']);
      break;
    }
    case 'site_settings': {
      inv(['site-settings']);
      break;
    }
    case 'user_invitations': {
      inv(['invitations']);
      inv(['pending-invitations']);
      inv(['users-with-roles']);
      inv(['users']);
      break;
    }
    case 'scheduled_survey_distributions': {
      inv(['scheduled-surveys']);
      inv(['survey-responses']);
      break;
    }
    case 'staff_messages': {
      inv(['messages']);
      inv(['conversations']);
      inv(['messages-unread']);
      if (row.student_id) inv(['student-progress-report', row.student_id]);
      break;
    }
    case 'notifications': {
      if (row.user_id) inv(['notifications', row.user_id]);
      if (row.user_id) inv(['notifications-unread-count', row.user_id]);
      inv(['notifications']);
      break;
    }
    case 'nda_documents':
    case 'nda_acceptances': {
      inv(['nda']);
      inv(['nda-acceptances']);
      inv(['nda-current']);
      break;
    }
    case 'certification_catalog': {
      inv(['certification-catalog']);
      break;
    }
    case 'student_certifications': {
      inv(['student-certifications']);
      studentIds.forEach((id) => inv(['student-certifications', id]));
      studentIds.forEach((id) => inv(['student-detail', id]));
      studentIds.forEach((id) => inv(['student-progress-report', id]));
      inv(['expiring-certifications']);
      break;
    }
  }
}

export const REALTIME_TABLES = [
  'support_requests',
  'request_updates',
  'request_attachments',
  'request_share_links',
  'student_assignments',
  'appointments',
  'file_notes',
  'student_checkins',
  'intake_responses',
  'post_graduation_plans',
  'profiles',
  'organization_memberships',
  'org_admins',
  'training_organizations',
  'qr_codes',
  'qr_scan_events',
  'site_settings',
  'user_invitations',
  'scheduled_survey_distributions',
  'staff_messages',
  'notifications',
  'nda_documents',
  'nda_acceptances',
] as const;
