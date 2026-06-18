## Goal
Let admins (and org admins, within scope) create new time entries and edit any existing entry from the Time Reports page.

## Changes

### 1. RLS migration (`time_entries`)
Current INSERT policy requires `case_manager_id = auth.uid()`, blocking admins from logging time for other case managers. Replace with:
- `CM inserts own entries` (unchanged: CM inserts where case_manager_id = auth.uid())
- New: `Admins insert any entry` — allow when `has_role(auth.uid(), 'admin')`
- New: `Org admins insert in scope` — allow when `is_org_admin(auth.uid())` AND the target case_manager_id falls within their org scope (`user_in_org_admin_scope_v2`)

UPDATE policy already permits admin/org_admin, no change needed.

### 2. Hook: `useTimeEntries.ts`
Add `useCreateTimeEntry()` that inserts directly into `time_entries` (relies on `validate_time_entry` trigger for duration/org auto-fill) and invalidates the query.

### 3. `TimeTrackingAdmin.tsx`
- Add an "Add entry" button next to "Export CSV" that opens a new `CreateEntryDialog`.
- `CreateEntryDialog`: fields for case manager (required, from `caseManagers`), student (optional, from `users` filtered to role `student`), date, start time, end time, service type, billable, notes. Submits via the new hook.
- Extend `EditDialog` so admins can also edit: case manager, student (optional), date, and status. (Existing fields stay.) For non-admins this would be locked, but this page is admin-only so all fields editable.

### 4. Out of scope
No change to clock-in/out, audit, case-manager-facing TimeTracking page, or unrelated areas. Per Data Preservation rule, no soft-delete or hiding logic.

## Files
- new migration `time_entries` insert policies
- edit `src/hooks/useTimeEntries.ts`
- edit `src/pages/admin/TimeTrackingAdmin.tsx`
