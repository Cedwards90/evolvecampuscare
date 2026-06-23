## Problem
We already have client-side code that writes to `student_assignments` from multiple places (assign dialog, bulk assign, reassign, cohort UI, invitations) and a realtime bridge that re-queries assignments. But assignments still get out of sync because:

1. The DB functions `sync_profile_cohort_assignments` and `sync_cohort_case_manager_assignments` exist but **no triggers are attached** — so adding a CM to a cohort, or moving a student into a cohort, does **not** propagate to `student_assignments`.
2. `sync_profile_organization` likewise has no trigger — moving a student between orgs via `organization_memberships` does not update `profiles.organization_id`.
3. `cohort_case_managers` is **not** in the `supabase_realtime` publication, so cohort-driven changes don't push to other sessions.
4. Several mutation hooks (`useAssignStudent`, `useBulkAssignStudents`, `useRemoveStudentAssignment`, invitation acceptance) invalidate slightly different query keys, so some surfaces (folders / analytics / workload / filter options) lag behind.

## Fix: make the database the source of truth, then mirror to every client

### 1. DB triggers (single migration)

Wire up the existing sync functions and add new ones so every assignment path runs the same logic:

- `trg_sync_profile_org_on_membership` — `AFTER INSERT/UPDATE ON organization_memberships` → `sync_profile_organization()`
- `trg_sync_cohort_cm_to_students` — `AFTER INSERT ON cohort_case_managers` → `sync_cohort_case_manager_assignments()`
- `trg_sync_student_to_cohort_cms` — `AFTER UPDATE OF cohort_id ON profiles` → `sync_profile_cohort_assignments()`
- New `sync_org_admin_visibility()` no-op refresher (touches `updated_at` on related profiles) so realtime fan-out fires when an `org_admins` row changes.
- New `enforce_one_assignment_per_student` constraint check (unique on `student_id`) if not already enforced — guarantees `onConflict: 'student_id'` upserts behave the same everywhere.
- `updated_at` triggers on `student_assignments` and `organization_memberships` for change detection.

### 2. Realtime publication

`ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_case_managers, public.cohorts;` so cohort-driven changes propagate to every signed-in session.

### 3. Realtime router

In `src/lib/realtimeRouter.ts`, add cases for `cohort_case_managers` and `cohorts`. Both invalidate: `['student-assignments']`, `['my-students']`, `['student-folders']`, `['my-assignment']`, `['cohorts']`, `['case-manager-stats']`, `['workload-analytics']`, `['unassigned-students']`. Append both tables to `REALTIME_TABLES`.

Also expand the existing `student_assignments` case to invalidate `['unassigned-students']`, `['filter-options']`, `['analytics']`, and `['users-with-roles']` so admin pages stay in sync.

### 4. Unify mutation invalidations

Create `src/lib/assignmentInvalidations.ts` exporting one helper `invalidateAssignmentSurfaces(qc, studentId?)`. Replace the ad-hoc lists in:
- `useAssignStudent` / `useBulkAssignStudents` / `useRemoveStudentAssignment` (`useStudentAssignments.ts`)
- `useReassignStudent`
- Any other place that writes assignments (audit via grep first; current hits: `useSubmitRequest`, invitation acceptance handled by DB trigger — no client invalidation needed there).

The helper invalidates: `student-assignments`, `unassigned-students`, `my-students`, `my-assignment`, `student-folders`, `case-managers`, `case-manager-stats`, `workload-analytics`, `requests`, `analytics`, `filter-options`, `users-with-roles`, and per-student `student-detail` / `student-progress-report` keys.

### 5. No UI changes
This is plumbing — existing assign dialogs, reassign dialog, cohort manager, and invitation flow keep their current UX. They'll just stay consistent automatically.

## Files touched
- `supabase/migrations/<new>.sql` — attach triggers, add cohort tables to realtime publication.
- `src/lib/realtimeRouter.ts` — new cases + expanded invalidations.
- `src/lib/assignmentInvalidations.ts` — new helper.
- `src/hooks/useStudentAssignments.ts` — use helper.
- `src/hooks/useReassignStudent.ts` — use helper.

## Out of scope
No edge function changes. No new pages. Existing RLS policies stay the same.
