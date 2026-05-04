## Filter & sort by organization on Survey Responses + Reports

### 1. Hydrate organization on student data
Update `useAllCheckIns` and `useAllPostGradPlans` (`src/hooks/useSurveyResponses.ts`) to also fetch `organization_id` on each profile, plus a single lookup of `training_organizations(id, name)`. Add to each row:
- `organization_id: string | null`
- `organization_name: string | null`

### 2. Survey Responses page (`src/pages/admin/SurveyResponses.tsx`)
- Apply the existing `GlobalFilterBar` `organizationId` selection: filter `filteredCheckIns` / `filteredPlans` against `organization_id` using `useGlobalFilters()`.
- Add an **Organization** column to the Check-Ins table and show org name on each Post-Grad plan card header.
- Add a sort header on the Organization column (and Student + Date for consistency) with an asc/desc toggle. Default sort: Date desc (current behavior).
- Sort post-grad plan cards via a small `<Select>` (Date / Student / Organization).

### 3. Reports page (`src/pages/Reports.tsx`)
- The `organizationId` filter is already in the bar but unused. Wire it: in the caseload tab's data flow, narrow `data.opened` / `data.unresolved` rows whose hydrated `student.organization_id` is in the selected set (client-side, in the page's `useMemo` before rendering `ReportPreview`). No hook changes.
- Add an Organization column to ReportPreview's per-student tables only if the underlying row has `student` hydrated — quick add in `ReportPreview` (read-only display, no sort needed there since it's a report snapshot).

### 4. Out of scope
- No DB migration; `profiles.organization_id` and `training_organizations` already exist.
- No changes to AuthContext, RLS, or the GlobalFilterBar component itself.
- Per-student report sub-page untouched.

### Verification
1. Pick an organization in the filter bar on Survey Responses → only that org's students appear in both tabs; Organization column shows correct names.
2. Click the Organization header → rows reorder asc/desc.
3. On Reports, pick an org → caseload tables narrow accordingly; clearing the filter restores full data.
