## Goal

Add a filter panel to the Student Progress Reports page (`/reports/student/...`) that scopes which students appear in the picker and bulk export. Filters: **Organization**, **Class (cohort)**, **Year of Study**, **Assigned Case Manager**, **Student Status (Active/Inactive)**, and **Date Range** (already exists for report period). All filters respect existing RLS and update counts, picker, and export in real time.

Scope is limited to the Reports area — no changes to other pages, hooks, RLS, or business logic outside this feature.

## Changes

### 1. New filter hook — `src/hooks/useReportStudentFilters.ts`
- Build the filterable student pool by joining `student_assignments` (already cached via `useStudentAssignments`) with `profiles` fields: `organization_id`, `cohort_start_date`, `year_of_study`, `deactivated_at`.
- Pull the assigned student's organization from `profiles.organization_id` (already maintained by `sync_profile_organization` trigger).
- Apply filters client-side over the RLS-scoped result. No new DB queries beyond fetching the needed profile columns (extend existing fetch in `useStudentAssignments` — read-only, additive).
- Returns: `{ filteredStudents, counts: { total, matching } }`.

### 2. New UI component — `src/components/reports/ReportFilters.tsx`
- Local filter state (not the global filter context — keeps this page self-contained and avoids side effects on other pages).
- Controls (using existing `FilterMultiSelect` + shadcn primitives):
  - Organization (from `useFilterOptions().organizations`)
  - Class / Cohort
  - Year of Study
  - Assigned Case Manager (admin/org_admin only; case managers are auto-scoped to themselves)
  - Student Status: Active / Inactive / All (default Active)
  - Date Range — reuses existing preset + custom popover (moved into this component for cohesion)
- Active-filter chips with individual remove + "Reset filters" button.
- Permission-aware: case managers see only their own caseload (CM picker hidden); org admins see only orgs they administer (filtered against `org_admin_orgs`).

### 3. Update `src/pages/StudentProgressReport.tsx`
- Replace the inline preset bar with `<ReportFilters />`.
- Replace `myStudents` derivation with `filteredStudents` from the new hook.
- Update the bulk-export label/count to reflect filtered count in real time.
- Keep single-student picker (`StudentPicker`) but feed it the filtered list (extend `StudentPicker` props to accept an optional pre-filtered student list — backward compatible).
- Bulk export iterates only over `filteredStudents`. Range and per-student fetch logic unchanged.
- Hard guard: if a filter produces 0 students, disable bulk buttons with a helpful empty state.

### 4. Real-time sync
- No new subscriptions needed. The existing `realtimeRouter` already invalidates `['student-assignments']`, `['profiles']`, and `['global-filter-options']` on relevant table changes. Counts and filtered list will refresh automatically when assignments, profile org/cohort, or deactivation status change.

### 5. URL persistence (lightweight)
- Serialize filter selections into `searchParams` (e.g. `?org=...&cohort=...&cm=...&status=active`) so deep links and back-navigation preserve the filtered view. Reuses the existing `useSearchParams` already in the page.

## Out of Scope (per user's "no other changes" rule)
- No edits to `GlobalFiltersContext`, RLS policies, edge functions, or other report types.
- No schema changes — all needed fields already exist on `profiles`.
- No changes to single-report fetch logic or export formats.

## Files
- **Create:** `src/hooks/useReportStudentFilters.ts`, `src/components/reports/ReportFilters.tsx`
- **Modify:** `src/pages/StudentProgressReport.tsx`, `src/components/reports/StudentPicker.tsx` (additive prop only)
