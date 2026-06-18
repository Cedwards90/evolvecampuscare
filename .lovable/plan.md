## Organization sorting on /admin/impact

Two additions to `src/pages/admin/ImpactDashboard.tsx`:

### 1. Promote the Organization filter
Move the existing top-right `FilterMultiSelect` into its own filter bar row directly under the page header (alongside the date range), styled like other admin filter bars (`rounded-full`, sage outline). Add:
- A count badge ("3 of 12 selected") and a "Clear" pill when any orgs are selected.
- Make it visible to **Org Admins** too — for them, options auto-restrict to their `org_admins` orgs (already RLS-scoped via `useTrainingOrganizations`).
- Persist selection in the URL (`?orgs=id1,id2`) so the view is shareable/deep-linkable.

### 2. Per-organization breakdown table
New `<OrgBreakdownTable />` rendered in a collapsible Card titled "Compare organizations" beneath the existing KPI grid.

Columns (sortable by clicking the header, default desc by Students):
- Organization
- Active students
- Requests opened / resolved
- Approved $ (sum)
- Certifications earned
- Placement rate (%)
- Avg wage lift ($)
- SROI

Data: call `useImpactAnalytics` once per org via `useQueries` with `{ ...filters, organizationIds: [org.id] }` for each org the admin/org-admin can see (respects the active multi-select — if none selected, all visible orgs; if some, just those). Show a small spinner per row while loading; render `—` for null metrics.

Also: a "Totals" row at the bottom summing numeric columns (rates shown as weighted averages, not summed).

### Export
Extend the existing CSV export with an "Organization breakdown" section (one row per org with the same columns).

### Files
- `src/pages/admin/ImpactDashboard.tsx` — relocate filter, add URL sync, render new component, extend CSV.
- `src/components/impact/OrgBreakdownTable.tsx` — new component (uses `useQueries` + existing hook).

### Out of scope
No DB/RLS changes, no new endpoints, no changes to charts.