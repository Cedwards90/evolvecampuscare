## Goal
Wire up the already-built Impact Analytics module so staff and students can reach it from the sidebar, generate metrics, and download PDF/CSV reports.

## Changes (frontend + nav only — no business logic edits)

### 1. `src/App.tsx` — register 6 new routes
- `/impact` → `ImpactDashboardPage` (roles: case_manager, admin, org_admin)
- `/impact/funding` → `FundingGoalsPage` (admin, org_admin)
- `/impact/reports` → `DonorReportsPage` (admin, org_admin)
- `/impact/surveys` → `SurveyTemplatesPage` (admin)
- `/surveys/impact` → `StudentImpactSurveysPage` (student)
- `/surveys/impact/:slug` → `StudentImpactSurveyTakePage` (student)

### 2. `src/components/layouts/SidebarLayout.tsx` — add nav entries
Add an "Impact" group with icon `TrendingUp` (lucide):
- **Impact Dashboard** → `/impact` (case_manager, admin, org_admin)
- **Funding Goals** → `/impact/funding` (admin, org_admin)
- **Donor Reports** → `/impact/reports` (admin, org_admin)
- **Impact Surveys** (templates) → `/impact/surveys` (admin)
- **My Impact Surveys** → `/surveys/impact` (student)

### 3. `src/lib/realtimeRouter.ts` — register new tables
Add: `participant_outcomes`, `impact_survey_templates`, `impact_survey_responses`, `impact_survey_assignments`, `participant_demographics`, `funding_goals`, `donor_report_templates`, `impact_report_audit` so React Query caches refresh in real time.

### 4. Quick verification
- Build passes (no TS errors).
- Navigate to `/impact` as admin → dashboard renders with KPI tiles and export buttons.
- Click "Export PDF" / "Export CSV" → file downloads (PDF via `jspdf`, CSV via blob).
- `/impact/funding` shows "New goal" button → create/edit/delete works.

## Out of scope
No edits to existing pages (Dashboard, Settings, StudentDetail, AdminDashboard) beyond the additions above. No new business logic, no schema changes — the migration, edge function, hooks, components, and pages are already in place.