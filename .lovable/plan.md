
## Goal

Add a structured **Support Request Analytics** experience for admins and org admins, built entirely on data we already have (category, priority, status, is_emergency, requested_amount, approved_amount, timestamps, organization, cohort, assigned case manager, student). No new required fields on the submit form, no schema changes to `support_requests`, no backfill.

## Scope (from your answers)

- Analytics-only on existing data.
- No new required fields on requests.
- No historical backfill.
- Sensitive student PII stays behind the same role/RLS rules already in place — analytics use aggregates and existing joins only.

## What gets built

### 1. New page: `/admin/request-analytics`
- Admin + Org Admin access (Org Admin scoped to their orgs via existing RLS).
- Reuses the existing `GlobalFilterBar` (org, program, cohort, case manager, date range) so filters stay consistent with the rest of the admin app.
- Sections:
  1. **Summary tiles** — total requests, open, resolved, emergency, avg resolution time, repeat-requester rate, financial $ requested vs $ approved.
  2. **Volume & trends** — requests per day/week, stacked by status; new vs resolved line chart.
  3. **Most common needs** — bar chart by category + priority mix.
  4. **Resolution performance** — avg/median hours by category and by case manager (reuses logic from `useAnalyticsData`).
  5. **Repeat requests** — students with >1 request in the range, with counts.
  6. **Unresolved backlog** — count by age bucket (0–3d, 4–7d, 8–14d, 15+d) and by category.
  7. **Financial assistance** — totals requested, approved, pending; approval-rate; breakdown by org and by category.
  8. **Breakdowns table** — pivot by Organization / Cohort / Case Manager / Category with counts, resolved %, avg hours, $ approved.

### 2. New hook: `useRequestAnalytics(filters)`
- Single React Query hook that pulls `support_requests` (respecting RLS) once with the active `GlobalFilters` applied via the existing `applyGlobalFilters` helper.
- Derives every section above in-memory (deterministic, no fabricated data — empty states shown when a slice has 0 rows).
- Joins organization / cohort / case manager labels through the same maps `useFilterOptions` already builds.

### 3. Exports
- **CSV**: one row per request in the filtered set, plus a second CSV of the breakdown pivot.
- **PDF**: summary tiles + charts + breakdowns table, using the existing `reportExport` PDF helpers for visual consistency.
- Both exports honor the currently selected filters.

### 4. Real-time
- Subscribes to `support_requests` via the existing `useRealtimeRequests` bridge and invalidates the analytics query so numbers refresh as requests move through the workflow.

### 5. Navigation & access
- Add a single "Request Analytics" entry under the admin sidebar's Reports group.
- Route guarded by the existing `ProtectedRoute` with `admin` + `org_admin` roles.
- No changes to student, case manager, or submit flows.

## Explicitly NOT in this plan

- No new columns on `support_requests` (no subcategory/urgency/referral source/class/preferred support type).
- No changes to `SubmitRequest.tsx` or the request wizard.
- No admin-managed category tables.
- No historical backfill or reclassification tooling.
- No changes to RLS, roles, or existing dashboards; the existing `AnalyticsDashboard` stays as-is.

If later you want the taxonomy fields + admin-managed dropdowns + backfill, that becomes a separate plan (schema migration + form changes + admin CRUD + backfill script).

## Technical notes

- Files added:
  - `src/pages/admin/RequestAnalytics.tsx`
  - `src/hooks/useRequestAnalytics.ts`
  - `src/lib/requestAnalyticsExport.ts`
  - Small chart components under `src/components/admin/analytics/` (volume, breakdown, financial).
- Files touched (navigation only):
  - `src/App.tsx` — add route.
  - Admin sidebar component — add link.
- Data source: `support_requests` + `profiles` + `training_organizations` + `cohorts` + `user_roles`, all through the existing Supabase client. No SQL migrations.
- All charts use the recharts setup already present in `AnalyticsDashboard`.
- Access control relies on existing RLS: Org Admins automatically only see their orgs' requests; Case Managers are not given access to this page.

## Acceptance

- `/admin/request-analytics` renders for admin + org_admin, honors global filters, updates in real time, and exports CSV + PDF that match what's on screen.
- No student-facing or submit-flow changes.
- No fabricated metrics — every number is derived from rows returned by the query; empty slices show "No data for this filter".
