## Goal

Add three frontend features on top of the existing backend (time_entries, time_entry_audit, profiles.mfa_exempt, mfa_exemption_audit are already in the DB). All changes are additive — no existing data, columns, policies, or UI behavior is altered.

## 1. Admin MFA controls (per-user)

On `/admin/users` (`UserManagementPage.tsx`), add an **MFA** column + action menu for each staff row (Admin / Case Manager / Org Admin only — Students remain excluded per the MFA Access Policy memory).

For each staff user, admin can:
- See current state: `Enrolled` / `Not enrolled` / `Exempt` (badge), plus enrollment count from an edge-function lookup.
- **Toggle "MFA Exempt"** — flips `profiles.mfa_exempt` and writes `mfa_exempt_at` / `mfa_exempt_by` / `mfa_exempt_reason` (reason prompted via dialog). Insert a row into `mfa_exemption_audit`.
- **Force unenroll factors** — destructive on the user's auth factors only (not data); requires typing the user's email to confirm. Done via a new edge function `admin-mfa-manage` using the service role (`auth.admin.mfa.deleteFactor` per factor). Writes to `mfa_exemption_audit` with `action='force_unenroll'`.
- **View audit log** — slide-over panel listing rows from `mfa_exemption_audit` for that user.

Permissions: only `admin` role can see/use these controls (`has_role` check + RLS on `mfa_exemption_audit`). Org Admins do NOT get MFA toggle (out of scope).

No changes to login enforcement logic, no changes to student rows, no changes to existing user-management features.

## 2. Case Manager clock-in / clock-out (`/time-tracking`)

New page `src/pages/TimeTracking.tsx` (route added to `App.tsx` guarded by `case_manager` or `admin`). Existing Case Manager pages are untouched.

UI:
- **Active shift card**: big Clock-In button when no active shift; when active, shows live elapsed timer, start time, optional student/service-type/notes fields, and Clock-Out button.
- **Today / This week** summary (sum of `duration_minutes` from `time_entries` for current user).
- **Recent entries** list with status badges (draft / submitted / approved / rejected) and an Edit button for `draft` rows only.

Data model (additive only — does NOT change `time_entries`):
- New table `public.active_time_sessions` (one row per case manager max) with `case_manager_id` (PK), `start_time`, `student_id`, `service_type`, `notes`, `created_at`. RLS: case manager sees/manages own; service_role full.
- On Clock-Out: insert a row into `time_entries` (status `submitted`, end_time=now, validation trigger computes `duration_minutes` + `organization_id`) and delete the active session. Wrapped in an edge function `time-clock` to keep it atomic.

Offline/edge cases: simple `navigator.onLine` guard with toast; no offline queue (out of scope).

## 3. Admin time reporting (`/admin/time-tracking`)

New page `src/pages/admin/TimeTrackingAdmin.tsx`. Available to `admin` (all entries) and `org_admin` (entries scoped via existing `org_admin_can_access_time_entry`).

Features:
- Filters: case manager, organization, student, date range, status, billable. Uses existing global filter context where applicable.
- Table: date, case manager, student, service type, duration, status, billable, notes preview.
- Row actions: **View details** (drawer with full notes + `time_entry_audit` history), **Edit** (admin/org_admin only — date, times, service type, notes, billable), **Approve** / **Reject** (sets `status` + `review_note`; trigger fills `reviewed_by/at`).
- Bulk approve selected.
- **Export CSV** of current filtered result (client-side; columns: date, case manager email, student email, organization, service_type, start, end, duration_hrs, billable, status, reviewed_by, review_note, notes).

No schema changes for this page — uses existing `time_entries`, `time_entry_audit`, `validate_time_entry`, `audit_time_entry`.

## Files

New:
- `src/pages/TimeTracking.tsx`
- `src/pages/admin/TimeTrackingAdmin.tsx`
- `src/components/time/ActiveShiftCard.tsx`, `TimeEntryRow.tsx`, `TimeEntryEditDialog.tsx`, `TimeEntryDetailDrawer.tsx`
- `src/components/admin/MFAUserControls.tsx`, `MFAAuditDrawer.tsx`
- `src/hooks/useActiveShift.ts`, `useTimeEntries.ts`, `useAdminMFA.ts`
- `supabase/functions/time-clock/index.ts` (clock-in / clock-out)
- `supabase/functions/admin-mfa-manage/index.ts` (set exempt, force unenroll, list factor count)

Edited (minimal, scoped):
- `src/App.tsx` — add 2 routes
- `src/pages/admin/UserManagementPage.tsx` — add MFA column + open dialog (no changes to existing row rendering logic beyond the new column)
- Sidebar/nav — add "Time Tracking" link for case_manager, "Time Reports" for admin/org_admin

Migrations (additive only):
- `CREATE TABLE public.active_time_sessions` + GRANTs + RLS + policies (case manager owns own; service_role all)

## Out of scope (won't touch)

- Existing time_entries / time_entry_audit / mfa_exemption_audit schema, triggers, policies, RLS
- Login MFA enforcement flow
- Student data, organization data, request/messaging/intake features
- No `is_active`/soft-hide filters added anywhere (per Data Preservation rule)

## Verification

- Build passes; routes load; clock-in then clock-out creates a `time_entries` row with correct duration; admin approve flips status; CSV downloads; MFA toggle writes audit row; force-unenroll removes auth factors only.
