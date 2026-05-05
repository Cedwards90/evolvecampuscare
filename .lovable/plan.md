## Problem

When an Admin assigns students to a Case Manager, those students do not appear on the Case Manager's dashboard / caseload until she manually reloads. Reason:

1. `useAssignStudent` / `useBulkAssignStudents` invalidate React Query caches **only inside the admin's browser**. The Case Manager is a different session — nothing tells her client to refetch.
2. `student_assignments` is **not** in the `supabase_realtime` publication, so we can't subscribe to live changes today.
3. A few mutations also miss invalidating related caches (`my-students`, `student-folders`, `my-assignment`).

## Fix

### 1. Enable realtime on `student_assignments`
Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.student_assignments;` and set `REPLICA IDENTITY FULL` so we get the new row's `case_manager_id` on insert/update/delete.

### 2. New hook `useRealtimeStudentAssignments(caseManagerId)`
Subscribes to `postgres_changes` on `student_assignments` filtered by `case_manager_id=eq.<currentCM>`. On any event, invalidates:
- `['my-students', caseManagerId]`
- `['student-folders']`
- `['case-manager-stats', caseManagerId]`
- `['my-assignment']`
- `['requests']`

Also listens to DELETE/UPDATE without filter (since a reassignment away from the CM removes a row whose new `case_manager_id` no longer matches her). Use `event: '*'` then check payload's `old.case_manager_id` to decide whether to invalidate.

### 3. Mount the subscription in the Case Manager surfaces
Add the hook to `Dashboard.tsx` (case_manager branch) and `StudentFolders.tsx` so it's active wherever the caseload is shown. Dropping into `SidebarLayout` (gated to `role === 'case_manager'`) would cover the entire app — preferred.

### 4. Tighten invalidations in existing mutations
In `useAssignStudent`, `useBulkAssignStudents`, `useRemoveStudentAssignment`, `useReassignStudent`: also invalidate `['my-students']`, `['student-folders']`, `['my-assignment']`. This fixes the admin's own UI being stale across pages.

### 5. Verify
After approval, manually trigger an assignment from admin and confirm the CM's open dashboard updates within ~1s without reload (using preview / two browser windows).

## Out of scope
- No schema changes to `student_assignments` columns.
- No notification/email to the CM (already handled by `send-assignment-notification`).