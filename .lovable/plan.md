## Goal
1. Replace the global "Class" filter so it lists **named cohorts** (from the `cohorts` table) and filters by `profiles.cohort_id`.
2. Let admins/org admins assign **case managers to cohorts** (many-to-many), and auto-create student assignments for that cohort's students — both retroactively and for future joiners.

## 1. Database (migration)

**New table `cohort_case_managers`** (junction):
- `cohort_id` → cohorts (cascade)
- `case_manager_id` → auth.users (cascade)
- `assigned_by`, `created_at`
- Unique on (`cohort_id`, `case_manager_id`)
- GRANT to authenticated + service_role
- RLS:
  - SELECT: admins, org admins of the cohort's org, the CM themselves, and students in that cohort
  - INSERT/DELETE: admins, org admins of the cohort's org

**Auto-assign function + trigger** `sync_cohort_case_manager_assignments()`:
- When a row is inserted into `cohort_case_managers`, for every student whose `profiles.cohort_id = NEW.cohort_id`, upsert into `student_assignments (student_id, case_manager_id, assigned_by, notes='Auto-assigned via cohort')`. No-op if assignment already exists.
- Per Data Preservation: deleting a row from `cohort_case_managers` does **not** remove existing student_assignments — staff must remove those manually.

**Profile cohort change trigger** `sync_profile_cohort_assignments()` on `profiles` AFTER UPDATE of `cohort_id`:
- When a student's `cohort_id` changes to a non-null value, upsert student_assignments for each CM linked to the new cohort.
- Same no-op behavior when leaving a cohort (assignments preserved).

## 2. Global "Class" filter → named cohorts

- `src/hooks/useFilterOptions.ts`: stop deriving from `cohort_start_date`. Query the `cohorts` table; return `{ value: cohort.id, label: cohort.name }` (with org name suffix when ambiguous).
- `src/contexts/GlobalFiltersContext.tsx` + `src/lib/applyGlobalFilters.ts`: change client-side cohort matching from year derivation to direct `cohort_id` equality. Keep the filter key name `cohort` to avoid touching every consumer.
- `src/components/filters/GlobalFilterBar.tsx`: relabel chip from "Class of {year}" to the cohort name (looked up from filter options).
- Any direct query that filtered by `cohort_start_date` for the global filter: switch to `cohort_id`. Audit `useStudentFolders`, `useUsers`, dashboards.

## 3. UI for CM ↔ cohort

- Extend `src/components/admin/CohortStudentsDialog.tsx` (or add a sibling tabbed dialog) with a second tab **"Case Managers"**:
  - Lists currently assigned CMs (chips with remove button).
  - Combobox to add a CM (queries `user_roles` for `case_manager`, filtered to those in the cohort's org via memberships).
  - On add → insert into `cohort_case_managers`; trigger handles student_assignments.
  - On remove → delete junction row only; shows a hint that existing student assignments stay until removed manually.
- New hook `src/hooks/useCohortCaseManagers.ts`: `useCohortCaseManagers(cohortId)`, `useAddCohortCM()`, `useRemoveCohortCM()`.
- `CohortManager` table: show a small CM count badge next to the student count.

## 4. Out of scope
- No removal of `cohort_start_date` column or any historical year data.
- No changes to existing student_assignments RLS or reassignment flows.
- No bulk CM removal of inherited student assignments.

## Files
- **New**: migration; `src/hooks/useCohortCaseManagers.ts`.
- **Edit**: `src/hooks/useFilterOptions.ts`, `src/contexts/GlobalFiltersContext.tsx`, `src/lib/applyGlobalFilters.ts`, `src/components/filters/GlobalFilterBar.tsx`, `src/components/admin/CohortStudentsDialog.tsx`, `src/components/admin/CohortManager.tsx`.
