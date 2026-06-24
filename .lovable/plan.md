# Survey Impact Reports

Add a way to generate impact summaries for each survey type, with filters, an on-screen dashboard, PDF download, and CSV export.

## Scope (surveys)
- Life Skills (pre/post confidence per module + final NPS)
- Wellbeing check-ins (mood trends, wins/blockers volume)
- Intake & Career Intake (response counts, key field distributions)
- Post-graduation plans (status/destination breakdown, completion rate)

## Where it lives
- New page `/admin/surveys/reports` (also reachable from each card on `/admin/surveys` via a new "Impact report" button next to "Completions").
- Access: Admin, Org Admin, Case Manager. Data scoping reuses existing RLS — staff only see what they can already see (CM = assigned students; Org Admin = their orgs; Admin = all).

## Filters
- Date range (preset: 7d / 30d / 90d / custom) applied to `submitted_at`/`created_at`.
- `GlobalFilterBar` (organization, cohort, year of study, assigned case manager) — reuses existing context, same pattern as `Reports.tsx`.
- Survey selector (which survey the report is for).

## On-screen dashboard (per survey)
A `SurveyImpactReport` component renders sections tailored to the selected survey:

- **Header KPIs**: total responses, unique respondents, completion rate (where applicable), date range.
- **Life Skills**: reuse logic from `LifeSkillsImpactCard` — pre vs post avg confidence bar chart per module, delta column, final-survey NPS + n.
- **Wellbeing check-ins**: avg mood over time (line), mood distribution (bar), counts of wins/blockers, top recurring themes (simple word/keyword frequency from text fields).
- **Intake / Career Intake**: response volume over time, breakdowns of structured fields (e.g. goals, top needs, industries) as bar charts; list top free-text themes.
- **Post-grad plans**: status breakdown (employed / continuing ed / seeking / other), destination org/school list, plan-confidence avg if present.
- Empty / loading / error states consistent with existing dashboards.

## Exports
- **PDF**: Evolve-branded report via `jsPDF` + `jspdf-autotable`, mirroring `src/lib/reportExport.ts` styling (Forest Green header, footer with page numbers, "Powered by Evolve Foundation"). One section per chart/table with KPI summary on page 1.
- **CSV**: per-survey row-level export of the filtered responses (respects RLS/global filters). Multi-section CSV for aggregated metrics, same pattern as `exportReportCsv`.

## New / changed files
- `src/pages/admin/SurveyImpactReports.tsx` — page shell, filter bar, survey picker, export buttons.
- `src/components/admin/impact/SurveyImpactReport.tsx` — dispatcher rendering the right section per survey.
- `src/components/admin/impact/sections/` — `LifeSkillsSection.tsx`, `CheckinsSection.tsx`, `IntakeSection.tsx`, `CareerIntakeSection.tsx`, `PostGradSection.tsx`.
- `src/hooks/useSurveyImpact.ts` — one hook per survey kind returning aggregates + raw rows for export, applying date range + global filters via `src/lib/applyGlobalFilters.ts`.
- `src/lib/surveyImpactExport.ts` — `exportSurveyImpactPdf()` and `exportSurveyImpactCsv()`.
- `src/pages/admin/SurveysIndex.tsx` — add "Impact report" button on each `SurveyCard` linking to `/admin/surveys/reports?survey=<source>`.
- `src/App.tsx` — register the new route, gated to admin / org_admin / case_manager.

## Out of scope
- No DB schema changes — all aggregations are client-side over existing tables (`student_checkins`, `intake_responses`, `career_intake_responses`, `post_graduation_plans`, `impact_survey_responses` + templates).
- No new edge functions; PDF generated in the browser like the existing Reports page.
- No new permissions/roles.
