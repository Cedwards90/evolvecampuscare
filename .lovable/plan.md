# Student Certifications Tracking

A new module for staff to track each student's certifications, an admin-managed catalog of predefined options, expiration alerts, and inclusion in student reports.

## Scope

- Staff (Admin / Org Admin / assigned Case Manager) add/edit/delete certifications on a student.
- Students view their own certifications (read-only).
- Org Admins see only certifications for students in their org(s).
- Catalog of predefined certifications managed by Admins (Org Admins can add org-scoped entries).
- Custom (free-text) certifications supported alongside catalog entries.
- File/image upload for the certificate document, stored privately.
- Compliance: dashboard widget + notifications for certs expiring within 30/60/90 days.
- Reports: cert summary added to the student PDF report.

## Database (new tables)

**`certification_catalog`** — predefined options
- `name` (text, unique per org), `category` (text, optional), `default_validity_months` (int, nullable), `issuing_organization` (text, nullable), `organization_id` (uuid, nullable = global), `is_active` (bool), `created_by`.
- RLS: read = any authenticated; write = Admin (global rows) or Org Admin of the org.

**`student_certifications`** — per-student records
- `student_id`, `catalog_id` (nullable, FK to catalog), `custom_name` (text, nullable — required when no catalog_id), `issuing_organization`, `status` (enum: `in_progress` | `completed` | `expired` | `revoked`), `completion_date`, `expiration_date` (nullable), `credential_id` (text, nullable), `notes`, `file_path` (text, nullable), `file_name`, `mime_type`, `file_size`, `created_by`, timestamps.
- CHECK: exactly one of `catalog_id` or `custom_name` is set (via trigger to keep mutability).
- RLS:
  - SELECT: student themselves; assigned Case Manager; Admin; Org Admin via `user_in_org_admin_scope_v2`.
  - INSERT/UPDATE/DELETE: Admin; assigned Case Manager; Org Admin in scope. Students cannot write.

**Storage bucket** `student-certifications` (private). Path: `{student_id}/{cert_id}/{filename}`. Policies mirror table SELECT/INSERT/DELETE rules.

## Backend

- Add `certification_catalog` and `student_certifications` to `REALTIME_TABLES` so the existing realtime bridge invalidates queries automatically.
- New scheduled Edge Function `notify-expiring-certifications` (daily): finds certs expiring in 30/14/3 days and inserts `notifications` rows for the assigned case manager and Org Admins. No new env vars.
- Auto-flip `status` to `expired` via a small SQL function called by the same scheduled function (or computed in UI from `expiration_date < now()`).

## Frontend

**New hooks**
- `useCertificationCatalog()` — list/create/update/deactivate catalog entries (admin/org-admin gated).
- `useStudentCertifications(studentId)` — list/create/update/delete + signed-URL helper for uploaded files.
- `useExpiringCertifications()` — current user's in-scope certs expiring within 90 days (for dashboard widget).

**New components**
- `src/components/certifications/CertificationsSection.tsx` — table on student profile with add/edit buttons.
- `src/components/certifications/CertificationDialog.tsx` — combobox to pick from catalog or "Custom…", status, dates (auto-fills expiration from catalog default), issuing org, credential id, file upload, notes.
- `src/components/certifications/ExpiringCertificationsCard.tsx` — dashboard widget for staff.
- `src/components/admin/CertificationCatalogManager.tsx` — admin page section for catalog CRUD.

**Integrations**
- Add a "Certifications" tab (or section under existing tabs) to `StudentDetail.tsx`.
- Mount `ExpiringCertificationsCard` on staff `Dashboard.tsx` and `AdminDashboard.tsx`.
- Add catalog manager into `Settings.tsx` (Admin) and a scoped version for Org Admin.
- Extend `src/lib/studentProgressExport.ts` (and `GenerateStudentReportCard`) to include a Certifications section.

## Permissions summary

| Action | Student | Case Manager (assigned) | Org Admin (in scope) | Admin |
|---|---|---|---|---|
| View own certs | ✅ | ✅ | ✅ | ✅ |
| Add/edit/delete student certs | ❌ | ✅ | ✅ | ✅ |
| Manage global catalog | ❌ | ❌ | ❌ | ✅ |
| Manage org catalog | ❌ | ❌ | ✅ | ✅ |

## Validation

- Zod schemas: name required (catalog or custom, not both empty), `completion_date` ≤ today, `expiration_date` > `completion_date` if provided, file ≤ 10 MB, mime in {pdf, png, jpg, webp}.
- Server-side enforced via CHECK constraints + RLS; storage size limit on bucket.

## Files touched (new)
- `supabase/migrations/*` (tables, RLS, bucket, policies)
- `supabase/functions/notify-expiring-certifications/index.ts`
- `src/hooks/useCertificationCatalog.ts`, `useStudentCertifications.ts`, `useExpiringCertifications.ts`
- `src/components/certifications/*` (3 components)
- `src/components/admin/CertificationCatalogManager.tsx`

## Files modified (minimal, only as needed for this feature)
- `src/pages/StudentDetail.tsx` — add Certifications tab
- `src/pages/Dashboard.tsx`, `src/pages/AdminDashboard.tsx` — mount expiring widget
- `src/pages/Settings.tsx` — mount catalog manager
- `src/lib/realtimeRouter.ts` — add the two new tables
- `src/lib/studentProgressExport.ts` + `src/components/reports/GenerateStudentReportCard.tsx` — include certs in PDF

No changes to unrelated code, auth, or existing schemas.
