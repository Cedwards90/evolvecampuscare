# Cohorts & Case Manager Filtering

Add structured "Classes/Cohorts" inside each organization, an admin UI to manage them, and a "filter by assigned case manager" control on Student Folders and the Admin Users student tab. No changes to unrelated areas.

## 1. Database (migration)

New table `public.cohorts`:
- `id uuid pk`, `organization_id uuid not null references training_organizations(id) on delete cascade`
- `name text not null`
- `start_date date`, `end_date date`
- `description text`
- `created_by uuid`, `created_at`, `updated_at`
- Unique `(organization_id, lower(name))`
- Indexes on `organization_id`

Add `profiles.cohort_id uuid references cohorts(id) on delete set null` (nullable — preserves existing student data; `cohort_start_date` is left intact for backward compatibility).

GRANTs:
- `cohorts`: SELECT/INSERT/UPDATE/DELETE to authenticated; ALL to service_role.

RLS on `cohorts`:
- SELECT: any authenticated user whose profile/membership is in that org, plus admins, org_admins of that org, and case_managers (so they can see cohort labels on their students).
- INSERT/UPDATE/DELETE: admins, or org_admins where `is_org_admin_of(auth.uid(), organization_id)`.

`profiles.cohort_id` update rules: rely on existing profile policies (admins + org_admin scope can update student profiles). No data is hidden or destroyed.

## 2. Cohort management UI

New component `src/components/admin/CohortManager.tsx` mounted inside the existing `OrganizationDetail` page as a "Classes / Cohorts" section:
- List cohorts for that org with name, dates, student count.
- Create / Edit / Delete dialogs (delete only when count = 0, else show "reassign students first").
- Bulk-assign students into a cohort from a multi-select of unassigned/assigned students in that org.

New hook `src/hooks/useCohorts.ts` (list/create/update/delete + assign).

## 3. Assign students to cohorts

- Add a "Cohort" select to the existing student-edit dialog in `UserManagementPage` (admin + org_admin only, scoped to the student's org).
- Add a small "Move to cohort" action in `CohortManager` for one or many students.

## 4. Filters

**Student Folders (`/student-folders`)**:
- Add a "Case Manager" select (visible to admin + org_admin). Selecting one shows only students currently assigned to that CM.
- Add a "Cohort" select (scoped to currently selected org if any, otherwise all visible cohorts).

**Admin Users page (`/admin/users`) student tab**:
- Add the same "Case Manager" and "Cohort" filters next to the existing org filter.

Both filters are pure client-side narrowing on data already fetched under RLS — no destructive queries, no `is_active` side-effects.

## 5. Global filter options

Extend `useFilterOptions` to also return cohorts (id, name, org_id). The existing `GlobalFilterBar` cohort control keeps working off `cohort_start_date` years; the new cohort dropdowns are local to the two pages above to avoid touching unrelated filtering logic.

## Files

**New**
- `supabase/migrations/<ts>_cohorts.sql`
- `src/hooks/useCohorts.ts`
- `src/components/admin/CohortManager.tsx`
- `src/components/admin/CohortDialog.tsx`

**Edited (scoped to this feature only)**
- `src/pages/StudentFolders.tsx` — add CM + cohort filters
- `src/pages/admin/UserManagementPage.tsx` — add CM + cohort filters on student tab; add cohort field to edit student dialog
- `src/pages/admin/OrganizationDetail.tsx` — mount `CohortManager`
- `src/hooks/useStudentFolders.ts` — include `cohort_id` + `cohort_name` in returned rows
- `src/hooks/useFilterOptions.ts` — return cohorts list

## Out of scope (won't touch)
- `cohort_start_date`, existing GlobalFilterBar cohort-year logic, reports, analytics, messaging, requests, MFA, time tracking.
- No deactivation/soft-hide filters added (Data Preservation rule).
- No edits to `src/integrations/supabase/*` auto-gen except the post-migration regeneration.

## Technical notes
- Cohort deletion uses `on delete set null` for `profiles.cohort_id` so deleting a cohort never removes student records.
- `useCohorts` invalidates `['cohorts', orgId]` and `['student-folders']` queries on mutation.
- All new dialogs use existing shadcn primitives and Forest Green / pill UI per brand memory.
