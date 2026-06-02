# Platform-wide Organization-Aware Filtering

## Current state (already in place)

- `GlobalFiltersContext` supports `organizationId`, `cohort`, `yearOfStudy`, `status`, `role`, `assignedCaseManagerId` — persisted to `user_filter_preferences` + URL.
- `GlobalFilterBar` + `FilterMultiSelect` UI exist.
- Adopted on: Reports, AdminDashboard, Dashboard, ManageRequests, StudentFolders, admin/CaseManagers, admin/UserManagement, admin/TrainingOrganizations, admin/AnalyticsDashboard, admin/SurveyResponses, MyStudentsSection, PendingInvitations.

We will **extend, not rewrite**, this system. No changes to unrelated business logic.

## Gaps to close

1. **Missing filter dimensions** the user asked for:
   - `class` → reuse `cohort` (already "Class of YYYY"). Add explicit `class` alias label + ensure shown wherever students appear.
   - `studentStatus` → new key (active/inactive/suspended). Distinct from request `status`.
   - `program` → new key. Source: `profiles.program` (verify column exists; if not, plan adds it as a follow-up question, not built without permission).

2. **Default to user's org context** (currently filters start empty):
   - On hydration, if user is `org_admin` and no saved/URL filter set → seed `organizationId` with their `org_admins` orgs.
   - If user is `case_manager` → seed with org(s) of their assigned students (read-only default; they can clear).
   - Admin → no default (sees all).
   - Students → filter bar hidden (already effectively the case).

3. **Pages still missing the bar** where students/CMs/requests/surveys/notes/assignments are shown:
   - `RequestsList`, `TrackRequests`, `RequestDetail` (read-only badge of active filters), `Messages` (filter conversation list), `StudentProgressReport`, `StudentDetail` (header chip showing active org context), `CaseManagerDetail`, `admin/ImpactDashboard` (already has its own — unify to consume global filters as defaults), `admin/TransitionsDashboard`, file-notes/assignments sub-views inside `StudentDetail`.

4. **Data scoping**: ensure every query hook honors active filters:
   - Audit hooks: `useStudents`, `useStudentFolders`, `useRequests*`, `useStudentAssignments`, `useFileNotes`, `useSurveys`, `useReportStudentFilters`, `useImpactAnalytics`, notifications counts, dashboard KPIs.
   - Pattern: hooks accept `filters` from `useGlobalFilters()` and include them in React Query keys so cache + realtime invalidation recompute automatically.

5. **Exports** (CSV/PDF): pass current filter snapshot into export builders so downloads match on-screen scope; include "Filtered by: …" line in PDF headers (extend existing branding header).

6. **Persistence**: already saved per user. Add per-page `visible` filters (already supported) — no schema change.

7. **Realtime**: existing realtime bridge invalidates query keys; since keys include filter values, recalculation is automatic. Verify no hook uses filters outside its queryKey.

## Implementation steps

1. **Context**: add `studentStatus` and `program` keys to `GlobalFilters`, `URL_KEYS`, `EMPTY_FILTERS`, helpers, and `filterByProfile`.
2. **Filter options hook**: extend `useFilterOptions` to return `programs` + `studentStatuses`.
3. **Default seeding**: in `GlobalFiltersProvider` hydration, when no saved/URL filters exist, seed `organizationId` from role (org_admin → org_admins table; case_manager → distinct orgs of assignments).
4. **GlobalFilterBar**: add Program + Student Status controls; keep role-based hiding.
5. **Mount bar on missing pages** listed above with appropriate `visible` props.
6. **Audit + update query hooks** to consume `filters` and include them in queryKey + WHERE clauses (client-side filter for already-fetched lists; server-side `.in()` where lists are large).
7. **Exports**: thread `filters` into PDF/CSV generators; add filter summary to headers.
8. **Tests / sanity**: verify role-based defaults, URL deep-links, realtime updates recompute counts, and clearing filters restores full scope.

## Out of scope (will ask before doing)

- Adding new DB columns (e.g., if `profiles.program` doesn't exist).
- Changing RLS or unrelated business logic.
- Refactoring the Impact Dashboard's bespoke filter UI beyond reading defaults from global filters.

## Open questions

1. Does `profiles` already have a `program` column, or should `program` map to something existing (e.g., `cohort`/organization)? If not present, do you want me to add it (schema change)?
2. For `studentStatus`, should the values be: Active / Inactive (deactivated) / Org-Suspended — or a different taxonomy?
3. For Case Managers, should the default org context be **locked** (cannot clear) or just **pre-selected** (can clear to see cross-org assigned students)?