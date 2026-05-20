# Platform Impact Analytics & Outcomes Tracking

Build a comprehensive impact tracking system layered on existing data (certifications, support requests, check-ins, appointments, profiles) plus new periodic surveys, demographics, and funding goals. Role-scoped dashboards with PDF/CSV exports and donor-ready report templates.

## Scope guardrails
- New module only. No edits to existing pages, hooks, or RLS beyond minimal additions described below. Existing certification/folder-summary/check-in flows untouched.
- All new tables, all new edge functions, all new routes.

---

## 1. Data model (new tables)

```text
participant_outcomes        one-time/updated milestones per student
  student_id, employment_status, job_title, employer, placement_date,
  hourly_wage, weekly_hours, retention_30/60/90/180/365 (bool + date),
  program_completed (bool + date), completion_reason

impact_survey_templates     admin-defined periodic surveys
  id, slug, title, description, cadence_days, questions (jsonb),
  is_active, created_by

impact_survey_responses     student answers
  id, student_id, template_id, responses (jsonb), score_summary (jsonb),
  submitted_at

impact_survey_assignments   who gets prompted and when
  student_id, template_id, next_due_at, last_completed_at

participant_demographics    optional, consent-gated
  student_id (pk), gender, age_range, ethnicity (array),
  veteran_status, justice_involved, disability_status,
  consent_at, consent_version

funding_goals               admin-managed quantitative targets
  id, organization_id (nullable=global), title, description,
  metric_key (enum: job_placements|certifications|completions|requests_resolved|survey_score:<slug>|custom),
  target_value, period_start, period_end, created_by

donor_report_templates      admin-curated report shells
  id, title, sections (jsonb), branding (jsonb), is_active

impact_report_audit         export log
  id, actor_id, scope (jsonb: org/cohort/cm/date), format (pdf|csv),
  template_id (nullable), created_at
```

Built-in survey slugs (seeded): `housing_stability`, `transportation_access`, `digital_literacy`, `confidence_self_efficacy`, `mentorship_participation`, `community_engagement`, `recidivism_check`, `career_progression`. Each is a versioned JSON schema editable by admins.

## 2. RLS model

- `participant_outcomes`, `participant_demographics`, `impact_survey_*`, `impact_report_audit`:
  - Student: read/write own (demographics & survey responses); outcomes read-only.
  - Staff: gated by existing `can_staff_manage_student(actor, student)`.
- `impact_survey_templates`, `funding_goals` (global), `donor_report_templates`: admin manage; org_admin can manage org-scoped funding goals; all staff read.
- Demographics consent required before any write; UI enforces and a CHECK ensures `consent_at IS NOT NULL` when any field is set.

## 3. Edge functions

- `impact-metrics-aggregate` — single endpoint returning aggregated KPIs for a scope `{ organization_id?, cohort?, case_manager_id?, demographic_filters?, date_range }`. Server-side computation only; clients never get raw PII rows. Returns: participant growth (certs earned, placements, wage growth %, retention curves, attendance, engagement freq, avg resolution time, completion rate) and social impact rollups (avg survey scores, % stable housing, etc.).
- `impact-export-csv` — streams CSV for the same scope, staff-only, logs to `impact_report_audit`.
- `impact-export-pdf` — generates donor/grant report via `jspdf` (already a dep) using `donor_report_templates`, logs to audit.
- `assign-impact-surveys` — cron (pg_cron + pg_net) that refreshes `impact_survey_assignments.next_due_at` based on `cadence_days`.

All follow existing edge-function security pattern (CORS, `auth.getUser()`, sanitizeError, role checks).

## 4. Frontend (all new files)

Routes (added to `App.tsx` only — no other page edits):
- `/impact` — main dashboard (staff)
- `/impact/funding` — funding goals manager (admin/org_admin)
- `/impact/surveys` — survey template manager (admin)
- `/impact/reports` — generate & export donor reports (staff)
- `/surveys/impact/:slug` — student survey-taking page

Components (`src/components/impact/`):
- `ImpactDashboard.tsx` — KPI grid, trend charts (Recharts, already used), filter bar (org / cohort / CM / date / demographics), funding-goal progress, drill-downs.
- `ParticipantGrowthPanel.tsx`, `SocialImpactPanel.tsx`, `FundingGoalsPanel.tsx`, `DemographicsBreakdownPanel.tsx`, `TrendChart.tsx`.
- `FundingGoalDialog.tsx`, `SurveyTemplateEditor.tsx`, `DonorReportBuilder.tsx`.
- `student/ImpactSurveyCard.tsx` (shown on Student Dashboard ONLY via a new opt-in slot — requires permission to touch `Dashboard.tsx`; otherwise expose at `/surveys/impact` student index).
- `DemographicsConsentDialog.tsx`.

Hooks (`src/hooks/`):
- `useImpactMetrics.ts`, `useFundingGoals.ts`, `useImpactSurveyTemplates.ts`, `useImpactSurveyResponses.ts`, `useParticipantOutcomes.ts`, `useDemographics.ts`.

Lib:
- `impactReportPdf.ts` (mirrors `folderSummaryPdf.ts` patterns), `impactCsv.ts`.

Realtime: add `participant_outcomes`, `impact_survey_responses`, `funding_goals` to `REALTIME_TABLES` in `src/lib/realtimeRouter.ts` (sole edit to an existing file besides `App.tsx`).

## 5. Role scoping

| Role | Sees |
|---|---|
| Admin | All orgs, all metrics, manages global surveys/funding/templates |
| Org Admin | Their org(s) only, manages org-scoped funding goals |
| Case Manager | Filter pre-locked to assigned students, KPIs only across that set |
| Student | Takes assigned surveys, views own outcomes summary (read-only) |

Demographic filters available only to Admin and Org Admin; suppress segments with fewer than 5 participants to prevent re-identification.

## 6. Donor-ready reports

Admin builds templates with selectable sections: cover (org logo + period), executive summary, KPI snapshot, funding-goal progress, outcome stories (anonymized survey aggregates only — no free text), demographic breakdown (≥5 threshold), methodology footer. PDF rendered server-side via `jspdf`; CSV via plain stream.

## 7. Out of scope (explicit)
- No edits to Dashboard, Settings, StudentDetail, or any existing page beyond `App.tsx` route registration and `realtimeRouter.ts` table list. Will request permission separately if Dashboard surfacing of student survey prompts is desired.
- No new auth provider, no new external integration.
- No automatic recidivism data ingestion — captured only via self-report survey.

## Technical notes
- All aggregation server-side via single edge function to enforce RLS and avoid the 1000-row Supabase limit.
- Charts use existing Recharts `ChartContainer` wrapper.
- Cadence cron uses existing pg_cron pattern (insert tool, not migration).
- All inputs validated with zod both client- and server-side.

## Deliverables checklist
1. One migration: 7 tables + RLS + helper `is_demographic_visible(count int)` function returning bool when count ≥ 5.
2. Seed insert for 8 built-in survey templates.
3. 4 edge functions.
4. ~6 hooks, ~12 components, 5 new routes, 2 lib helpers.
5. Cron schedule for `assign-impact-surveys` (daily).
6. Memory entry: `mem://features/impact-analytics-v1`.
