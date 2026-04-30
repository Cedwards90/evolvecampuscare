# Add Generate Report button to Case Manager detail page

## Problem
When an admin opens a case manager's profile at `/case-managers/:id`, there is no way to generate an interaction report for that specific case manager. The report generator only lives on the Dashboard and the standalone `/reports` page, and even there it does not accept a target case manager via URL.

## Goal
Give admins a one-click way to generate an interaction report for the case manager whose profile they are viewing, with the same daily/weekly/monthly presets already used elsewhere.

## Changes (frontend only, scoped to reports surface)

### 1. `src/pages/Reports.tsx` — accept `caseManagerId` from URL
- Read `caseManagerId` (or `cm`) from `useSearchParams`.
- If present and the current user is admin, use it as the initial `selectedCmId` instead of defaulting to the first case manager in the list.
- Non-admin behavior unchanged (always locked to their own id).

### 2. `src/components/reports/GenerateReportCard.tsx` — optional target CM
- Add an optional prop `caseManagerId?: string`.
- When provided, append it to the navigation URL: `/reports?preset=<preset>&caseManagerId=<id>` (and the "More options" link).
- Existing Dashboard usage stays unchanged (no prop = current behavior).

### 3. `src/pages/CaseManagerDetail.tsx` — surface the action
- Import `GenerateReportCard`.
- Render it in the right side of the header area (next to the "High Workload" badge) OR as a new card row directly under the stats grid — whichever fits the existing layout best. Pass `caseManagerId={id}`.
- Card is shown for any viewer of this page (admins are the primary audience; the page is already admin-gated by routing).

## Out of scope
- No changes to `useInteractionReport`, `reportExport`, or any data hooks.
- No changes to permissions/RLS — `useInteractionReport` already enforces that only admins can pull another user's report.
- No edits to Dashboard, sidebar, routing, or non-report pages.

## Technical notes
- Pure presentation/routing wiring; no new dependencies.
- URL contract: `/reports?preset=daily|weekly|monthly&caseManagerId=<uuid>`.
- Defensive: if URL `caseManagerId` is present but the viewer is not admin, ignore it (already covered by the existing effect that forces non-admins to their own id).
