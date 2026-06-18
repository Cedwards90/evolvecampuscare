## Goal
Let admins (and org admins, within scope) assign students to cohorts from the **Student Detail** page and **in bulk** from the Cohort Manager.

## Scope
- No schema changes — `profiles.cohort_id` and `useAssignStudentCohort` already exist.
- No changes to existing assign flow on Admin → Users.
- Respect Data Preservation: clearing a cohort sets `cohort_id = NULL`; no student records are deleted/hidden.

## 1. Student Detail page (`src/pages/StudentDetail.tsx`)
- Add a **Cohort** card/row (admin + org_admin-in-scope only).
- Shows current cohort name (or "Not assigned").
- Edit button opens a Select listing cohorts filtered to the student's organization (uses `useOrgCohorts(student.organization_id)`), with a "No cohort" option.
- Save calls `useAssignStudentCohort` and invalidates queries.
- If student has no organization, show a disabled state with hint to assign an organization first.

## 2. Bulk assignment from Cohort Manager
- Add a **"Manage students"** button on each cohort row in `src/components/admin/CohortManager.tsx` (admin / scoped org_admin only).
- Opens a new `CohortStudentsDialog` (new file `src/components/admin/CohortStudentsDialog.tsx`) showing:
  - Left list: students in the organization not currently in this cohort (with search).
  - Right list: students currently in this cohort.
  - Checkbox multi-select + **Add selected** / **Remove selected** buttons.
  - Each action runs a batched `Promise.all` of `useAssignStudentCohort` mutations (cohortId for add, `null` for remove).
- Data source: query `profiles` joined with `user_roles` for `student` role within the org (reuse pattern from `useOrgCohorts`); or add a small `useOrgStudents(orgId)` hook in `src/hooks/useCohorts.ts`.

## 3. Hook additions (`src/hooks/useCohorts.ts`)
- Add `useOrgStudents(orgId)` returning `{ user_id, full_name, email, cohort_id }` for students in the org (active memberships + profile-org fallback, mirroring `admin_student_data_health` logic on the client side: simple `profiles` query where `organization_id = orgId` and role = student).
- Existing `useAssignStudentCohort` already invalidates relevant queries — no change.

## Out of scope
- Bulk assign across organizations.
- Moving cohorts between orgs.
- Any change to filtering, RLS, or existing UserManagementPage cohort dropdown.

## Files
- **Edit**: `src/pages/StudentDetail.tsx`, `src/components/admin/CohortManager.tsx`, `src/hooks/useCohorts.ts`
- **New**: `src/components/admin/CohortStudentsDialog.tsx`
