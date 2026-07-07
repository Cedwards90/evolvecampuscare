## Goal

Enrich reports with real Life Skills progress and expanded impact metrics without fabricating data. Everything is computed from existing tables (`impact_survey_responses`, `impact_survey_templates`, `survey_invitations`, `student_checkins`, `appointments`, `file_notes`, `support_requests`, `post_graduation_plans`, `student_certifications`, `resource_recommendations`, `participant_outcomes`). If a signal has no data in scope, the section renders "No data on file" instead of a fabricated number.

## What's added

### 1. Life Skills progress block (per-student and per-org)
For each of the 7 existing modules (`lifeskillsTemplates.ts`):
- Pre confidence avg, Post confidence avg, delta, n for each
- Sparkline of the delta across modules
- Final wrap-up NPS if present

Skills from the user's list that map directly to existing modules are labelled with the module name (Communication → M02, Financial Literacy → M04, Digital Literacy → M06, Career Readiness → M05 Workforce Readiness). The other requested skills (attendance, accountability, problem-solving, teamwork, confidence, goal completion) are shown as **derived indicators** with a small "derived" tag and the source called out:

| Requested skill | Derived from |
|---|---|
| Attendance | `appointments` completed vs scheduled in range |
| Accountability | `student_checkins` cadence vs expected (3-week) |
| Confidence | Average of latest post-module `confidence` responses |
| Goal completion | `post_graduation_plans` milestones marked complete |
| Problem-solving / Teamwork | Omitted with a "not tracked" note — no data source |

### 2. Expanded impact metrics block
- Case-note summary: count by `note_type` + last note date (already partly present, extended with type breakdown)
- Survey results: sent/completed/response rate, pre→post deltas
- Certifications earned in range (`student_certifications` filtered by `earned_at`) + expiring-soon count
- Support needs: open requests by category & priority
- Referrals: `resource_recommendations` created in range
- Milestones: `post_graduation_plans` progress deltas
- Engagement: messages sent/received, distinct-day activity
- Employment-readiness: `participant_outcomes.employment_status` + M05 post confidence

### 3. Trends, risk areas, next steps
Extend `src/lib/studentProgressRules.ts` with new rules:
- Life-skills post < pre by ≥0.5 → risk
- Attendance rate < 60% in range → risk
- No check-in in ≥21 days → risk
- Certification expiring in ≤30 days → next step
- Post-grad milestone stalled ≥30 days → next step

All rules deterministic; `deriveActionItems` extended to produce next steps.

### 4. Optional AI narrative
Reuse the existing `AISummaryPanel` + `aiEligible` gate. Add a second gated panel on the org report that summarizes trends/improvements/risk areas from the deterministic payload only (no raw student PII beyond IDs in the prompt). Clearly labelled "AI-generated summary — verify against data above". Skipped when evidence is insufficient.

### 5. New Organization Report
New route `/reports/organization` (admin + org_admin only):
- Filters: date range (daily/weekly/monthly/custom) + existing `GlobalFilterBar` (org, cohort, program, CM, student status)
- Sections: caseload roll-up, Life Skills progress block (org-wide averages), expanded impact metrics block, trends & risks, top unresolved requests, top action items
- Exports: PDF + CSV via a new `orgReportExport.ts` mirroring `reportExport.ts` structure
- Data assembled by a new `useOrganizationReport` hook that runs the same aggregations as per-student across the filtered student set

### 6. Per-CM and per-student report additions
- New "Life Skills & Impact" tabbed section in `ReportPreview` and `StudentReportPreview`
- CSV/PDF exports extended in `reportExport.ts` and `studentProgressExport.ts` with new sections in the same style

## Guarantees

- **No fabricated data**: every metric is computed from an existing query. Empty sections render "No data on file" and are omitted from CSV/PDF when empty.
- **No unrelated changes**: only files listed below are touched; no schema changes, no changes to other pages, no business logic changed for existing metrics.
- **RLS-safe**: all new queries go through existing hooks/patterns; org report reuses `useReportStudentFilters` scoping so org_admin only sees their orgs.
- **Perf**: aggregations run client-side over the already-scoped student set, same pattern as `LifeSkillsImpactCard`.

## Files

New:
- `src/hooks/useOrganizationReport.ts`
- `src/hooks/useLifeSkillsProgress.ts` (shared per-student + org aggregation)
- `src/pages/OrganizationReport.tsx`
- `src/components/reports/LifeSkillsProgressBlock.tsx`
- `src/components/reports/ImpactMetricsBlock.tsx`
- `src/lib/orgReportExport.ts`

Edited:
- `src/lib/studentProgressRules.ts` — new rules + action items
- `src/hooks/useStudentProgressReport.ts` — pull certifications, referrals, milestones, participant_outcomes for the student
- `src/hooks/useInteractionReport.ts` — pull certifications + referrals aggregate for the CM's caseload
- `src/components/reports/ReportPreview.tsx` — insert new blocks
- `src/components/reports/StudentReportPreview.tsx` — insert new blocks
- `src/lib/reportExport.ts` + `src/lib/studentProgressExport.ts` — new CSV/PDF sections
- `src/App.tsx` — route for `/reports/organization`
- `src/pages/Reports.tsx` — tab link to Organization report (admin/org_admin only)

## Out of scope (explicit)

- No new survey questions or template changes
- No new database tables/migrations
- No changes to how notifications, invitations, or dashboards render
- No edits to unrelated pages
