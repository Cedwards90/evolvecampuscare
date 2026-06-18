# Case Manager Hour Tracking

Add time tracking so case managers log billable/non-billable hours against students, and admins (plus org_admins, scoped to their orgs) can review, edit, approve, reject, and export.

## 1. Database (new migration)

New enum and tables:

- `time_entry_status` enum: `pending` | `approved` | `rejected`
- `service_type` enum: `direct_service` | `case_management` | `documentation` | `meeting` | `outreach` | `travel` | `other`
- `time_entries` table:
  - `case_manager_id` (uuid → profiles.user_id)
  - `student_id` (nullable uuid → profiles.user_id, so non-client time can also be logged)
  - `organization_id` (nullable uuid, auto-filled from student/case manager for org_admin scoping)
  - `entry_date` (date)
  - `start_time`, `end_time` (timetz) + computed `duration_minutes` (int, stored via trigger)
  - `service_type` (enum), `notes` (text), `billable` (boolean, default true)
  - `status` (enum, default `pending`)
  - `reviewed_by`, `reviewed_at`, `review_note`
  - timestamps + `updated_at` trigger
- `time_entry_audit` table: every create/edit/status change with actor + diff (jsonb) for compliance.

Validation trigger (not CHECK, per project rule):
- `end_time > start_time`
- `entry_date <= current_date`
- Only admin/org_admin may set `status` to `approved`/`rejected`; case managers may only edit their own `pending` entries.

GRANTs: `authenticated` SELECT/INSERT/UPDATE/DELETE on `time_entries`; SELECT on audit. `service_role` ALL. No `anon` access.

RLS policies (use existing `has_role`, `is_org_admin`, `user_in_org_admin_scope_v2`):
- Case managers: SELECT/INSERT/UPDATE/DELETE only `WHERE case_manager_id = auth.uid()` AND `status = 'pending'` for UPDATE/DELETE.
- Admins: full access.
- Org admins: SELECT + UPDATE (approval) limited to entries whose case_manager_id or student_id falls in their org scope.
- Students: no access.

## 2. Hooks (new)

- `src/hooks/useTimeEntries.ts` — list with filters (caseManagerId, studentId, dateFrom, dateTo, status, billable), grouped weekly totals.
- `src/hooks/useTimeEntryMutations.ts` — create / update / delete / approve / reject (single + bulk).

## 3. Case manager screen — `src/pages/TimeTracking.tsx`

- Route `/time-tracking`, sidebar entry for `case_manager` and `admin`.
- "Log Time" dialog: student picker (their assigned students via existing `useMyStudents`, plus "No client / internal"), date picker, start/end time, service type select, billable switch, notes textarea. Zod validation.
- Table of own entries with weekly totals header, status badges, edit/delete on pending only.
- Filters: date range, status, billable.
- Empty state + offline-friendly toast (no offline draft sync in v1, out of scope).

## 4. Admin screen — `src/pages/admin/TimeTrackingAdmin.tsx`

- Route `/admin/time-tracking`, sidebar entry for `admin` and `org_admin`.
- Filters bar: case manager (multi), student (multi), date range, status, billable, organization (reuse `GlobalFilterBar` patterns).
- Weekly totals summary cards (total hrs, billable hrs, pending count, approved hrs this week).
- Table with bulk-select → Approve / Reject (with reason). Inline edit dialog (admins only).
- Export: CSV download client-side using existing pattern from `reportExport.ts` — columns: date, case manager, student, org, service type, hours, billable, status, approved by, notes.

## 5. Navigation

- Add nav items in `src/components/layouts/AppLayout.tsx`:
  - `Time Tracking` → `/time-tracking` for `case_manager`, `admin`.
  - `Hours Review` → `/admin/time-tracking` for `admin`, `org_admin`.
- Wire routes in `src/App.tsx` inside `<ProtectedRoute>`.

## 6. Types

- Extend `src/types/database.ts` with `TimeEntry`, `TimeEntryStatus`, `ServiceType`. Supabase `types.ts` regenerates after migration approval.

## 7. Memory

- New `mem://features/time-tracking-v1` describing schema, roles, approval workflow, export format. Update `mem://index.md`.

## Out of scope
- No payroll integration, no invoice generation, no offline drafts, no calendar auto-import, no PDF export (CSV only in v1), no edits to existing files beyond `App.tsx` routes, `AppLayout.tsx` nav, `types/database.ts`, and the memory index — flagged here for explicit permission.

## Files to touch
- New: migration, `src/pages/TimeTracking.tsx`, `src/pages/admin/TimeTrackingAdmin.tsx`, `src/hooks/useTimeEntries.ts`, `src/hooks/useTimeEntryMutations.ts`, `src/components/timetracking/TimeEntryDialog.tsx`, `src/components/timetracking/TimeEntryTable.tsx`, `src/components/timetracking/WeeklyTotalsCards.tsx`, memory files.
- Edited (with permission requested by this plan): `src/App.tsx`, `src/components/layouts/AppLayout.tsx`, `src/types/database.ts`, `mem://index.md`.
