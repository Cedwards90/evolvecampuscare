
# Global Filters & Sorting

A single, app-wide filter bar that controls every staff list, table, dashboard, report, and count. Selections persist per user across devices and survive refreshes. RLS continues to enforce permissions — filters only narrow what a user is already allowed to see.

## Filters included

- **Cohort** — derived from `profiles.cohort_start_date` year (e.g. "Class of 2025")
- **Year of study** — `profiles.year_of_study` (Freshman, Sophomore, Junior, Senior, Other)
- **Organization** — `training_organizations`
- **Status** — `support_requests.status` (submitted, in_progress, escalated, resolved, etc.)
- **Role** — `user_roles.role` (student, case_manager, admin) — only shown on user-list pages
- **Assigned Case Manager** — `support_requests.assigned_case_manager_id` / `student_assignments.case_manager_id`

Each filter is multi-select with a "Clear" chip. A "Reset all" button clears the bar.

## Where the bar appears

Admin Dashboard, Manage Requests, Reports, Analytics Dashboard, Student Folders, Case Managers, Case Manager Detail, User Management, Training Organizations, Survey Responses, Pending Invitations, and the case-manager-facing My Students view. Each page only shows the subset of filters that's relevant to its data (e.g. Users page hides Status; Reports hides Role).

## Persistence

Three layers, in priority order:
1. **URL query string** (e.g. `?org=abc&status=submitted,escalated`) — shareable, deep-linkable, wins on load
2. **Per-user database row** — saved to a new `user_filter_preferences` table so the bar restores on any device
3. **In-memory React context** — keeps state synced as the user navigates between pages

When a user changes a filter: URL updates immediately; a debounced write (~500ms) syncs the preference to the database.

## Permissions

- RLS is the source of truth — filters are layered on top of what the user can already query.
- Case Managers see Organization/Cohort/Year/Status filters scoped to their assigned students. The Role filter and "all case managers" picker are hidden for them.
- Admins see every filter, every value.
- Students do not see this bar (out of scope per your answer).

## Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ [Cohort ▾] [Year ▾] [Org ▾] [Status ▾] [CM ▾]   Reset all  │
├─────────────────────────────────────────────────────────────┤
│ active chips: × Class of 2025  × Submitted  × Acme Corp     │
└─────────────────────────────────────────────────────────────┘
```

Pill-shaped, Forest Green active state, collapses to a single "Filters (3)" button under 768px that opens a sheet.

---

## Technical details

**New table** `user_filter_preferences`
- `user_id uuid PK` (FK to auth.users implicit via RLS)
- `filters jsonb` — `{ cohort: [...], yearOfStudy: [...], organizationId: [...], status: [...], role: [...], assignedCaseManagerId: [...] }`
- `updated_at timestamptz`
- RLS: users can select/insert/update/delete only their own row.

**New module** `src/contexts/GlobalFiltersContext.tsx`
- Hydrates from URL → DB → defaults on mount.
- Exposes `{ filters, setFilter, clearFilter, resetAll, activeCount }`.
- Debounces DB writes; updates URL via `useSearchParams`.

**New components**
- `src/components/filters/GlobalFilterBar.tsx` — desktop bar + mobile sheet. Accepts a `visible` prop listing which filters to render per page.
- `src/components/filters/FilterMultiSelect.tsx` — generic multi-select popover used by every dimension.
- `src/components/filters/ActiveFilterChips.tsx` — removable chips below the bar.

**New hook** `src/hooks/useFilteredQuery.ts`
- Wraps React Query keys with the current filter object so caches don't bleed across filter states.
- Provides helpers `applyToSupportRequests(query, filters)`, `applyToProfiles(query, filters)`, `applyToInvitations(query, filters)` that translate the filter object into Supabase `.in()` / `.eq()` clauses.

**Touched files** (existing data hooks updated to consume `useGlobalFilters` and forward to query keys):
- `src/hooks/useRequests.ts`
- `src/hooks/useUsers.ts`
- `src/hooks/useStudentAssignments.ts`
- `src/hooks/useMyStudents.ts`
- `src/hooks/useCaseManagerStats.ts`
- `src/hooks/useAnalyticsData.ts`
- `src/hooks/useStudentProgressReport.ts`
- `src/hooks/useInvitations.ts`
- `src/hooks/useSurveyInvitations.ts` / `useSurveyResponses.ts`
- `src/hooks/useStudentFolders.ts`

**Pages updated** to mount `<GlobalFilterBar />` with the appropriate `visible` set:
- `Dashboard.tsx`, `AdminDashboard.tsx`, `ManageRequests.tsx`, `Reports.tsx`
- `admin/AnalyticsDashboard.tsx`, `admin/UserManagementPage.tsx`, `admin/CaseManagersPage.tsx`, `admin/TrainingOrganizations.tsx`, `admin/SurveyResponses.tsx`
- `StudentFolders.tsx`, `CaseManagerDetail.tsx`
- `components/admin/PendingInvitationsSection.tsx`, `components/casemanager/MyStudentsSection.tsx`

**Existing per-page filters** (priority chip on Manage Requests, status filter on Folders, etc.) are migrated into the global bar so behavior stays identical but the state is shared.

**Migration**: one new table + RLS policies. No changes to existing tables.

## Out of scope
- Sort controls inside this rollout — the request mentions sorting, but each page keeps its existing column-sort UI. If you want a global default-sort selector too, I'll add it as a follow-up.
- Student-facing pages.
