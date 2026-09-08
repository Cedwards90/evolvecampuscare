import type { StudentCrmRow } from '@/hooks/useStudentCrm';

export interface CrmColumn {
  key: string;
  label: string;
  /** Shown by default in the table. */
  default: boolean;
  /** Contains sensitive personal data (date of birth, address). */
  sensitive?: boolean;
  align?: 'right';
}

export const CRM_COLUMNS: CrmColumn[] = [
  { key: 'name', label: 'Student', default: true },
  { key: 'student_id', label: 'Student ID', default: false },
  { key: 'email', label: 'Email', default: true },
  { key: 'phone', label: 'Phone', default: true },
  { key: 'organization', label: 'Organization', default: true },
  { key: 'cohort', label: 'Class', default: true },
  { key: 'case_manager', label: 'Case manager', default: true },
  { key: 'status', label: 'Enrollment', default: true },
  { key: 'age', label: 'Age', default: false, sensitive: true },
  { key: 'date_of_birth', label: 'Date of birth', default: false, sensitive: true },
  { key: 'address', label: 'Address', default: false, sensitive: true },
  { key: 'cohort_start_date', label: 'Class start', default: false },
  { key: 'graduation_date', label: 'Graduation', default: false },
  { key: 'placement_date', label: 'Placement', default: false },
  { key: 'open_requests', label: 'Open requests', default: true, align: 'right' },
  { key: 'dispersed', label: 'Money dispersed', default: true, align: 'right' },
  { key: 'last_activity', label: 'Last activity', default: false },
  { key: 'joined', label: 'Joined', default: false },
];

export const DEFAULT_VISIBLE_COLUMNS = CRM_COLUMNS.filter((c) => c.default).map((c) => c.key);

export function fullAddress(row: StudentCrmRow): string {
  return [row.address_line1, row.address_line2, row.city, row.state_region, row.postal_code, row.country]
    .filter(Boolean)
    .join(', ');
}

export function displayName(row: StudentCrmRow): string {
  return row.preferred_name || row.full_name || row.email;
}

export function legalName(row: StudentCrmRow): string | null {
  const parts = [row.legal_first_name, row.legal_last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}
