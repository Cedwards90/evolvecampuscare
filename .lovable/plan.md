## Make global "Class" (cohort) filter apply across the platform

Today, several pages render the cohort selector in `GlobalFilterBar` but ignore the selection. This plan wires the global cohort filter into every page that shows it.

### Pages to update

1. **`src/pages/Reports.tsx`** — `filteredData` only honors `organizationId`. Extend it to also filter `data.unresolved` by `filters.cohort` (and `filters.yearOfStudy`) using `r.student.cohort_id` / `year_of_study`.

2. **`src/pages/admin/SurveyResponses.tsx`** — `filterPending`, `filteredCheckIns`, `filteredPlans` only check `orgFilter`. Add cohort + year filters. Requires `cohort_id` and `year_of_study` on each row; if hooks don't include them, extend `useAllCheckIns` / `useAllPostGradPlans` / `usePendingCheckIns` / `usePendingPostGradPlans` to select those columns from joined profile.

3. **`src/pages/StudentFolders.tsx`** — currently has a local `cohortFilter` Select that's independent of the global filter. Drop the standalone `Select`, and have `gf.cohort` drive the cohort match in `matchesCohort`. Keep org/CM local selects.

4. **`src/pages/admin/UserManagementPage.tsx`** — same: local `cohortFilter` Select runs in parallel with `globalFilters`. Replace its filtering with `applyToProfiles(..., globalFilters)`; remove the duplicate Select. Keep the "Assign cohort" action.

5. **`src/pages/admin/AnalyticsDashboard.tsx`** — wire `useGlobalFilters()` and filter the underlying student / request datasets by `globalFilters.cohort`, `organizationId`, `yearOfStudy`, `assignedCaseManagerId` before computing metrics. Use `applyToRequests` / `applyToProfiles` where shapes match.

6. **`src/pages/CaseManagerDetail.tsx`** — filter the CM's request list with `applyToRequests` and the assigned students list with `applyToProfiles`.

7. **`src/pages/StudentProgressReport.tsx`** — filter `allRequests`, `surveys`, `appointments`, and the student picker by cohort/org/year/CM/status using the same lib helpers.

8. **`src/pages/RequestsList.tsx`** — apply `applyToRequests(rows, globalFilters)` to the fetched list before render.

### Out of scope

- Server-side query changes beyond the SurveyResponses select extensions.
- Adding the cohort selector to pages that don't render `GlobalFilterBar` (e.g. `TrainingOrganizations`, `PendingInvitationsSection` — orgs/invitations have no cohort_id).
- New filter dimensions or UI changes to the bar itself.

### Verification

After edits: open a page (e.g. `StudentFolders`), pick a cohort in the bar, navigate to `ManageRequests`, `Reports`, `AnalyticsDashboard`, `UserManagement`, `SurveyResponses` — the same cohort should narrow each list. Clearing the bar restores full data everywhere.